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
    'Write citations exactly like [3], never in any other format. '
    'End every sentence that makes a claim with its [n]; an answer with no [n] is wrong. '
    'Format: short plain paragraphs, or a list with one item per line starting with "- ". '
    'No numbered lists, no nested bullets, no headings, no tables.'
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
        self.touched = []  # files the last tool call looked at, for the live map

    def cite(self, path, start, end):
        for i, s in enumerate(self.sources, 1):
            if (s['path'], s['start_line'], s['end_line']) == (path, start, end):
                return i
        self.sources.append({'path': path, 'start_line': start, 'end_line': end})
        return len(self.sources)

    def search_code(self, query='', **_):
        hits = search_chunks(self.repo, query, mode='hybrid', limit=5)
        self.touched = list(dict.fromkeys(h['path'] for h in hits))
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
        if end < start:
            end = start + 79
        got = [(n, lines[n]) for n in range(start, end + 1) if n in lines]
        if not got and lines:  # a bad range: show the top of the file instead of failing
            start = min(lines)
            got = [(n, lines[n]) for n in range(start, start + 80) if n in lines]
        if not got:
            return f'No lines in that range. The file has lines 1-{max(lines) if lines else 0}.'
        a, b = got[0][0], got[-1][0]
        self.touched = [path]
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
        self.touched = list(dict.fromkeys(o.split(':')[0] for o in out))[:12]
        if not out:
            return 'No matches.'
        return '\n'.join(out[:25]) + '\n(Use read_file on a location to cite it.)'

    def run(self, name, raw_args):
        self.touched = []
        try:
            args = json.loads(raw_args or '{}')
        except json.JSONDecodeError:
            return {}, 'Invalid arguments: send valid JSON.'
        fn = {'search_code': self.search_code, 'read_file': self.read_file,
              'find_references': self.find_references}.get(name)
        if not fn:
            return args, f'Unknown tool {name}.'
        return args, fn(**args)


def _post(body, stream=False):
    for attempt in range(2):
        r = requests.post(
            GROQ_URL,
            headers={'Authorization': f"Bearer {os.environ['GROQ_API_KEY']}"},
            json=body,
            timeout=90,
            stream=stream,
        )
        if r.status_code == 429 and attempt == 0:
            time.sleep(20)
            continue
        break
    if r.status_code != 200:
        raise RuntimeError(f'LLM error {r.status_code}: {r.text[:300]}')
    return r


def _body(messages, tools):
    body = {'model': MODEL, 'temperature': 0.1, 'messages': messages}
    if tools:
        body['tools'] = TOOLS
        body['tool_choice'] = 'auto'
    return body


def _chat_stream(messages, tools=True):
    """Stream one model turn. Yields ('token', text) while it writes,
    then ('message', full_message) at the end."""
    body = _body(messages, tools)
    body['stream'] = True
    r = _post(body, stream=True)
    content, calls = [], {}
    for raw in r.iter_lines():
        raw = raw.decode('utf-8') if raw else raw
        if not raw or not raw.startswith('data: '):
            continue
        data = raw[6:]
        if data == '[DONE]':
            break
        delta = (json.loads(data).get('choices') or [{}])[0].get('delta') or {}
        if delta.get('content'):
            content.append(delta['content'])
            yield 'token', delta['content']
        for tc in delta.get('tool_calls') or []:
            c = calls.setdefault(tc.get('index', 0), {
                'id': '', 'type': 'function', 'function': {'name': '', 'arguments': ''}})
            if tc.get('id'):
                c['id'] = tc['id']
            fn = tc.get('function') or {}
            c['function']['name'] += fn.get('name') or ''
            c['function']['arguments'] += fn.get('arguments') or ''
    msg = {'role': 'assistant', 'content': ''.join(content)}
    if calls:
        msg['tool_calls'] = [calls[k] for k in sorted(calls)]
    yield 'message', msg


def _note(tool, result):
    if result.startswith(('No ', 'Invalid', 'Unknown', 'Give ')):
        return result.split('\n')[0][:80]
    if tool == 'search_code':
        return f"found {result.count(chr(10) + chr(10)) + 1} excerpts"
    if tool == 'read_file':
        first = result.split('\n')[0]
        return 'lines ' + first.rsplit(':', 1)[-1].replace('-', ' to ')
    if tool == 'find_references':
        return f"{len([l for l in result.split(chr(10)) if l and not l.startswith('(')])} matches"
    return ''


def agent_events(repo, question):
    """Run the agent and yield events as they happen:
    step (running/done), token, reset, done."""
    session = Session(repo)
    messages = [
        {'role': 'system', 'content': SYSTEM},
        {'role': 'user', 'content': question},
    ]
    steps, answer = [], None

    for _ in range(MAX_STEPS):
        msg, streamed = None, False
        try:
            for kind, val in _chat_stream(messages):
                if kind == 'token':
                    streamed = True
                    yield {'type': 'token', 't': val}
                else:
                    msg = val
        except RuntimeError:
            if streamed:
                yield {'type': 'reset'}
            if not steps:
                raise
            break  # a bad tool call mid-way: answer from what we have
        calls = msg.get('tool_calls') or []
        if not calls:
            answer = (msg.get('content') or '').strip() or None  # empty reply: force an answer below
            break
        if streamed:
            yield {'type': 'reset'}  # text before a tool call was thinking aloud, not the answer
        messages.append({'role': 'assistant', 'content': msg.get('content') or '', 'tool_calls': calls})
        for call in calls:
            name = call['function']['name']
            i = len(steps) + 1
            try:
                preview = json.loads(call['function'].get('arguments') or '{}')
            except json.JSONDecodeError:
                preview = {}
            yield {'type': 'step', 'i': i, 'status': 'running', 'tool': name, 'args': preview}
            args, result = session.run(name, call['function'].get('arguments'))
            steps.append({'tool': name, 'args': args, 'files': session.touched, 'note': _note(name, result)})
            yield {'type': 'step', 'i': i, 'status': 'done', **steps[-1]}
            messages.append({'role': 'tool', 'tool_call_id': call['id'], 'content': result[:8000]})

    if answer is None:
        messages.append({'role': 'user', 'content': 'Stop using tools. Answer now from what you have, with citations.'})
        for _ in range(2):
            try:
                parts = []
                for kind, val in _chat_stream(messages, tools=False):
                    if kind == 'token':
                        parts.append(val)
                        yield {'type': 'token', 't': val}
                answer = ''.join(parts)
                break
            except RuntimeError:
                yield {'type': 'reset'}
                messages.append({'role': 'user', 'content': 'Do not call any tool. Reply in plain text only.'})
        if answer is None:
            answer = 'I could not finish this question within the step limit.'

    answer = re.sub(r'[【\[](\d+)\s*†[^】\]]*[】\]]', r'[\1]', answer)
    answer = re.sub(r'【(\d+)[^】]*】', r'[\1]', answer)
    used = sorted({int(n) for n in re.findall(r'\[(\d+)\]', answer) if 1 <= int(n) <= len(session.sources)})
    sources = []
    for n in used:
        s = session.sources[n - 1]
        sources.append({
            'n': n, **s,
            'url': f"{repo.url}/blob/HEAD/{s['path']}#L{s['start_line']}-L{s['end_line']}",
        })
    yield {'type': 'done', 'answer': answer, 'sources': sources, 'steps': steps}


def run_agent(repo, question):
    """Same agent, no streaming: returns the final result (used by evals and /agent/)."""
    for event in agent_events(repo, question):
        if event['type'] == 'done':
            return {k: event[k] for k in ('answer', 'sources', 'steps')}
