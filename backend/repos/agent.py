import json
import os
import re
import time

import requests

from .models import Chunk, RepoFile
from .search import search_chunks

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
MODEL = 'openai/gpt-oss-120b'
MAX_STEPS = 6

SYSTEM = (
    'You are Sift, a code assistant answering questions about one repository. '
    'You cannot see the code until you use tools. Use search_code to find relevant code, '
    'read_file to open exact lines (for example a function that a search result calls or imports), '
    'and find_references to see where a name is used. Follow the code across files until you can '
    'answer: usually 2 to 5 tool calls. Then answer concisely. Every claim must cite a numbered '
    'excerpt like [3]; only numbers shown in tool results are valid. If the repository does not '
    'contain the answer, say so. Never invent files, functions or behavior. '
    'Write citations exactly like [3], never in any other format.'
)


def _tool(name, description, props, required):
    return {
        'type': 'function',
        'function': {
            'name': name,
            'description': description,
            'parameters': {'type': 'object', 'properties': props, 'required': required},
        },
    }


TOOLS = [
    _tool('search_code', 'Search the repository by meaning and keywords. Returns numbered excerpts.',
          {'query': {'type': 'string'}}, ['query']),
    _tool('read_file', 'Open a file by its path and return the given line range (max 80 lines).',
          {'path': {'type': 'string'}, 'start_line': {'type': 'integer'}, 'end_line': {'type': 'integer'}},
          ['path']),
    _tool('find_references', 'List the lines where a function, class or variable name appears.',
          {'name': {'type': 'string'}}, ['name']),
]


class Session:
    """Holds the repo and every excerpt shown to the model, so citations can be checked."""

    def __init__(self, repo):
        self.repo = repo
        self.sources = []

    def cite(self, path, start, end):
        for i, s in enumerate(self.sources, 1):
            if (s['path'], s['start_line'], s['end_line']) == (path, start, end):
                return i
        self.sources.append({'path': path, 'start_line': start, 'end_line': end})
        return len(self.sources)

    def search_code(self, query='', **_):
        hits = search_chunks(self.repo, query, mode='hybrid', limit=5)
        if not hits:
            return 'No results.'
        return '\n\n'.join(
            f"[{self.cite(h['path'], h['start_line'], h['end_line'])}] "
            f"{h['path']}:{h['start_line']}-{h['end_line']}\n{h['text'][:1500]}"
            for h in hits
        )

    def read_file(self, path='', start_line=None, end_line=None, line_start=None, line_end=None, **_):
        start_line = start_line or line_start or 1
        end_line = end_line or line_end
        f = RepoFile.objects.filter(repo=self.repo, path=path).first()
        if not f:
            name = path.split('/')[-1]
            close = RepoFile.objects.filter(repo=self.repo, path__icontains=name)[:5]
            hint = ', '.join(c.path for c in close) or 'none'
            return f'No file at {path}. Similar paths: {hint}'
        lines = {}
        for c in f.chunks.all():
            for i, line in enumerate(c.text.split('\n')):
                lines[c.start_line + i] = line
        try:
            start = max(1, int(start_line or 1))
            end = min(int(end_line or start + 79), start + 79)
        except (TypeError, ValueError):
            return 'start_line and end_line must be numbers.'
        got = [(n, lines[n]) for n in range(start, end + 1) if n in lines]
        if not got:
            return f'No lines in that range. The file has lines 1-{max(lines) if lines else 0}.'
        a, b = got[0][0], got[-1][0]
        body = '\n'.join(f'{n}: {text}' for n, text in got)
        return f'[{self.cite(path, a, b)}] {path}:{a}-{b}\n{body}'

    def find_references(self, name='', **_):
        if len(name) < 2:
            return 'Give a longer name.'
        out, seen = [], set()
        qs = Chunk.objects.filter(file__repo=self.repo, text__icontains=name).select_related('file')[:60]
        for c in qs:
            for i, line in enumerate(c.text.split('\n')):
                key = (c.file.path, c.start_line + i)
                if name.lower() in line.lower() and key not in seen:
                    seen.add(key)
                    out.append(f'{key[0]}:{key[1]}: {line.strip()[:160]}')
        if not out:
            return 'No matches.'
        return '\n'.join(out[:25]) + '\n(Use read_file on a location to cite it.)'

    def run(self, name, raw_args):
        try:
            args = json.loads(raw_args or '{}')
        except json.JSONDecodeError:
            return {}, 'Invalid arguments: send valid JSON.'
        fn = {'search_code': self.search_code, 'read_file': self.read_file,
              'find_references': self.find_references}.get(name)
        if not fn:
            return args, f'Unknown tool {name}.'
        return args, fn(**args)


def _chat(messages, tools=True):
    body = {'model': MODEL, 'temperature': 0.1, 'messages': messages}
    if tools:
        body['tools'] = TOOLS
        body['tool_choice'] = 'auto'
    for attempt in range(2):
        r = requests.post(
            GROQ_URL,
            headers={'Authorization': f"Bearer {os.environ['GROQ_API_KEY']}"},
            json=body,
            timeout=90,
        )
        if r.status_code == 429 and attempt == 0:
            time.sleep(20)
            continue
        break
    if r.status_code != 200:
        raise RuntimeError(f'LLM error {r.status_code}: {r.text[:300]}')
    return r.json()['choices'][0]['message']


def run_agent(repo, question):
    session = Session(repo)
    messages = [
        {'role': 'system', 'content': SYSTEM},
        {'role': 'user', 'content': question},
    ]
    steps, answer = [], None

    for _ in range(MAX_STEPS):
        try:
            msg = _chat(messages)
        except RuntimeError:
            if not steps:
                raise
            break  # a bad tool call mid-way: answer from what we have
        calls = msg.get('tool_calls') or []
        if not calls:
            answer = msg.get('content') or ''
            break
        messages.append({'role': 'assistant', 'content': msg.get('content') or '', 'tool_calls': calls})
        for call in calls:
            name = call['function']['name']
            args, result = session.run(name, call['function'].get('arguments'))
            steps.append({'tool': name, 'args': args})
            messages.append({'role': 'tool', 'tool_call_id': call['id'], 'content': result[:8000]})

    if answer is None:
        messages.append({'role': 'user', 'content': 'Stop using tools. Answer now from what you have, with citations.'})
        for _ in range(2):
            try:
                answer = _chat(messages, tools=False).get('content') or ''
                break
            except RuntimeError:
                messages.append({'role': 'user', 'content': 'Do not call any tool. Reply in plain text only.'})
        if answer is None:
            answer = 'I could not finish this question within the step limit.'

    answer = re.sub(r'\u3010(\d+)[^\u3011]*\u3011', r'[\1]', answer)
    used = sorted({int(n) for n in re.findall(r'\[(\d+)\]', answer) if 1 <= int(n) <= len(session.sources)})
    sources = []
    for n in used:
        s = session.sources[n - 1]
        sources.append({
            'n': n, **s,
            'url': f"{repo.url}/blob/HEAD/{s['path']}#L{s['start_line']}-L{s['end_line']}",
        })
    return {'answer': answer, 'sources': sources, 'steps': steps}