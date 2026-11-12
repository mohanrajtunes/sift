import re

from django.db.models import Q
from pgvector.django import CosineDistance

from .embeddings import embed_query
from .models import Chunk

STOP = {
    'the', 'and', 'for', 'how', 'what', 'where', 'which', 'does', 'this', 'that',
    'with', 'from', 'are', 'was', 'who', 'why', 'when', 'can', 'into', 'about',
}


def terms_from(q):
    words = re.findall(r'[A-Za-z0-9_]+', q.lower())
    return [w for w in words if len(w) > 2 and w not in STOP]


def keyword_rank(repo, q, limit=20):
    terms = terms_from(q)
    if not terms:
        return []
    cond = Q()
    for t in terms:
        cond |= Q(text__icontains=t) | Q(file__path__icontains=t)

    scored = []
    qs = Chunk.objects.filter(file__repo=repo).filter(cond).select_related('file')
    for c in qs:
        text = c.text.lower()
        path = c.file.path.lower()
        score = (
            sum(text.count(t) for t in terms)
            + 2 * sum(1 for t in terms if t in text)
            + 5 * sum(1 for t in terms if t in path)
        )
        scored.append((score, c))
    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:limit]]


def vector_rank(repo, q, limit=20):
    qv = embed_query(q)
    return list(
        Chunk.objects.filter(file__repo=repo, embedding__isnull=False)
        .annotate(dist=CosineDistance('embedding', qv))
        .order_by('dist')
        .select_related('file')[:limit]
    )


def search_chunks(repo, q, mode='hybrid', limit=8):
    """mode: keyword | vector | hybrid (reciprocal rank fusion)."""
    rankings = []
    if mode in ('keyword', 'hybrid'):
        rankings.append(keyword_rank(repo, q))
    if mode in ('vector', 'hybrid'):
        rankings.append(vector_rank(repo, q))

    scores, chunks = {}, {}
    for ranked in rankings:
        for rank, c in enumerate(ranked):
            chunks[c.id] = c
            scores[c.id] = scores.get(c.id, 0) + 1 / (60 + rank + 1)

    best = sorted(scores, key=scores.get, reverse=True)[:limit]
    return [
        {
            'path': chunks[i].file.path,
            'start_line': chunks[i].start_line,
            'end_line': chunks[i].end_line,
            'score': round(scores[i], 4),
            'text': chunks[i].text,
        }
        for i in best
    ]