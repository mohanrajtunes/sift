import math
import os
import time

import requests

MODEL = 'gemini-embedding-001'
DIMS = 768
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:batchEmbedContents'
BATCH = 20


def _normalize(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def _post(body, retries=6):
    key = os.environ['GOOGLE_API_KEY']
    wait = 15
    for _ in range(retries):
        r = requests.post(
            URL, headers={'x-goog-api-key': key}, json={'requests': body}, timeout=60
        )
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(wait)
            wait = min(wait * 2, 60)
            continue
        r.raise_for_status()
        return r.json()['embeddings']
    raise RuntimeError(f'Embedding API error {r.status_code}: {r.text[:300]}')


def embed(texts, task):
    out = []
    for i in range(0, len(texts), BATCH):
        body = [
            {
                'model': f'models/{MODEL}',
                'content': {'parts': [{'text': t}]},
                'taskType': task,
                'outputDimensionality': DIMS,
            }
            for t in texts[i:i + BATCH]
        ]
        out += [_normalize(e['values']) for e in _post(body)]
        time.sleep(1)
    return out


def embed_documents(texts):
    return embed(texts, 'RETRIEVAL_DOCUMENT')


def embed_query(text):
    return embed([text], 'CODE_RETRIEVAL_QUERY')[0]