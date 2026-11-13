"""Small per-IP rate limits so a public demo can't burn the API keys."""
import time

from django.core.cache import cache


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR', 'unknown')


def hit(request, scope, limit, window=3600):
    """Count one request. Returns seconds to wait if over the limit, else 0."""
    key = f'rl:{scope}:{client_ip(request)}'
    now = time.time()
    stamps = [t for t in cache.get(key, []) if now - t < window]
    if len(stamps) >= limit:
        return int(window - (now - stamps[0])) + 1
    stamps.append(now)
    cache.set(key, stamps, window)
    return 0
