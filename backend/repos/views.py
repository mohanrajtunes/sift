import json
import os
import threading
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import generics
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .agent import agent_events, run_agent
from .answer import answer_question
from .graph import build_graph
from .indexer.download import parse_github_url
from .indexer.run import index_repo
from .limits import hit
from .models import Repo, RepoFile
from .search import search_chunks
from .serializers import RepoSerializer

MAX_REPOS = int(os.environ.get('SIFT_MAX_REPOS', 50))     # total repos the server will index
REPOS_PER_HOUR = int(os.environ.get('SIFT_REPOS_PER_HOUR', 5))
QUESTIONS_PER_HOUR = int(os.environ.get('SIFT_QUESTIONS_PER_HOUR', 30))
MAX_QUESTION = 500


def _too_many(wait):
    return {'detail': f'Too many requests. Try again in {max(1, wait // 60)} min.'}


def _run(repo_id):
    try:
        index_repo(repo_id)
    finally:
        close_old_connections()


@api_view(['GET', 'POST'])
def repos(request):
    if request.method == 'GET':
        # ?ids=1,2,3 -> those repos (the browser remembers which ones you added); else recent ready ones
        ids = [int(i) for i in request.query_params.get('ids', '').split(',') if i.isdigit()]
        qs = Repo.objects.filter(id__in=ids) if ids else Repo.objects.filter(status='ready')
        return Response(RepoSerializer(qs.order_by('-created_at')[:24], many=True).data)

    url = (request.data.get('url') or '').strip()
    try:
        owner, name = parse_github_url(url)
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)

    canonical = f'https://github.com/{owner}/{name}'
    repo = Repo.objects.filter(url=canonical).first()
    if repo and repo.status != 'failed':
        return Response(RepoSerializer(repo).data)  # already indexed: free, no limit

    if not repo and Repo.objects.count() >= MAX_REPOS:
        return Response({'detail': 'This demo is full. Try one of the repos already indexed.'}, status=503)
    wait = hit(request, 'repo', REPOS_PER_HOUR)
    if wait:
        return Response(_too_many(wait), status=429)

    created = repo is None
    if created:
        repo = Repo.objects.create(url=canonical, name=f'{owner}/{name}')
    repo.status = 'queued'
    repo.error = ''
    repo.save()
    threading.Thread(target=_run, args=(repo.id,), daemon=True).start()
    return Response(RepoSerializer(repo).data, status=201 if created else 200)


class RepoDetail(generics.RetrieveAPIView):
    queryset = Repo.objects.all()
    serializer_class = RepoSerializer


@api_view(['GET'])
def graph(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    return Response({'status': repo.status, **build_graph(repo)})


@api_view(['GET'])
def search(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'detail': 'q is required'}, status=400)
    mode = request.query_params.get('mode', 'hybrid')
    return Response(search_chunks(repo, q, mode=mode))


def _check_question(request, repo, question):
    if repo.status != 'ready':
        return {'detail': 'Repo is not ready yet'}, 409
    if not question:
        return {'detail': 'question is required'}, 400
    if len(question) > MAX_QUESTION:
        return {'detail': f'Keep the question under {MAX_QUESTION} characters.'}, 400
    wait = hit(request, 'ask', QUESTIONS_PER_HOUR)
    if wait:
        return _too_many(wait), 429
    return None, 200


@api_view(['POST'])
def ask(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    question = (request.data.get('question') or '').strip()
    err, code = _check_question(request, repo, question)
    if err:
        return Response(err, status=code)
    try:
        return Response(answer_question(repo, question))
    except Exception as e:
        return Response({'detail': str(e)}, status=502)


@api_view(['POST'])
def agent(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    question = (request.data.get('question') or '').strip()
    err, code = _check_question(request, repo, question)
    if err:
        return Response(err, status=code)
    try:
        return Response(run_agent(repo, question))
    except Exception as e:
        return Response({'detail': str(e)}, status=502)


@csrf_exempt
@require_POST
def agent_stream(request, repo_id):
    """Server-sent events: each step as it runs, the answer as it is written, then 'done'."""
    repo = get_object_or_404(Repo, id=repo_id)
    try:
        question = (json.loads(request.body or '{}').get('question') or '').strip()
    except json.JSONDecodeError:
        question = ''
    err, code = _check_question(request, repo, question)
    if err:
        return JsonResponse(err, status=code)

    def events():
        try:
            for event in agent_events(repo, question):
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)[:300]})}\n\n"
        finally:
            close_old_connections()

    response = StreamingHttpResponse(events(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


@api_view(['GET'])
def evals(request):
    path = Path(settings.BASE_DIR) / 'evals' / 'last_run.json'
    if not path.exists():
        return Response({'detail': 'No eval run yet'}, status=404)
    return Response(json.loads(path.read_text()))


@api_view(['GET'])
def file_lines(request, repo_id):
    """Lines of one file, for the code panel next to a cited answer."""
    repo = get_object_or_404(Repo, id=repo_id)
    f = get_object_or_404(RepoFile, repo=repo, path=request.query_params.get('path', ''))
    lines = {}
    for c in f.chunks.all():
        for i, line in enumerate(c.text.split('\n')):
            lines[c.start_line + i] = line
    try:
        start = max(1, int(request.query_params.get('start', 1)))
        end = min(int(request.query_params.get('end', start + 60)), start + 200)
    except ValueError:
        return Response({'detail': 'start and end must be numbers'}, status=400)
    return Response({
        'path': f.path, 'language': f.language, 'total': max(lines) if lines else 0,
        'lines': [{'n': n, 'text': lines[n]} for n in range(start, end + 1) if n in lines],
    })
