import os
import re

import requests

from .search import search_chunks

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
MODEL = 'openai/gpt-oss-120b'

SYSTEM = (
    'You answer questions about a code repository using ONLY the numbered excerpts '
    'provided. Cite every claim with the excerpt number in square brackets, like [2]. '
    'If the excerpts do not contain the answer, say so plainly. Never invent files, '
    'functions or behavior that is not in the excerpts. Be concise: a short explanation, '
    'then the key files involved.'
)


def answer_question(repo, question):
    hits = search_chunks(repo, question, mode='hybrid', limit=10)
    if not hits:
        return {'answer': 'I could not find anything relevant in this repo.', 'sources': []}

    context = '\n\n'.join(
        f"[{i}] {h['path']}:{h['start_line']}-{h['end_line']}\n{h['text'][:3000]}"
        for i, h in enumerate(hits, 1)
    )
    r = requests.post(
        GROQ_URL,
        headers={'Authorization': f"Bearer {os.environ['GROQ_API_KEY']}"},
        json={
            'model': MODEL,
            'temperature': 0.1,
            'messages': [
                {'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': f'Excerpts:\n\n{context}\n\nQuestion: {question}'},
            ],
        },
        timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f'LLM error {r.status_code}: {r.text[:200]}')

    text = r.json()['choices'][0]['message']['content']
    used = sorted({int(n) for n in re.findall(r'\[(\d+)\]', text) if 1 <= int(n) <= len(hits)})
    sources = []
    for n in used:
        h = hits[n - 1]
        sources.append({
            'n': n,
            'path': h['path'],
            'start_line': h['start_line'],
            'end_line': h['end_line'],
            'url': f"{repo.url}/blob/HEAD/{h['path']}#L{h['start_line']}-L{h['end_line']}",
        })
    return {'answer': text, 'sources': sources}