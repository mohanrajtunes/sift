from django.shortcuts import render
import threading

from django.db import close_old_connections
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .answer import answer_question
from .indexer.download import parse_github_url
from .indexer.run import index_repo
from .models import Repo
from .search import search_chunks
from .serializers import RepoSerializer


def _run(repo_id):
    try:
        index_repo(repo_id)
    finally:
        close_old_connections()


@api_view(['POST'])
def create_repo(request):
    url = (request.data.get('url') or '').strip()
    try:
        owner, name = parse_github_url(url)
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)

    canonical = f'https://github.com/{owner}/{name}'
    repo, created = Repo.objects.get_or_create(
        url=canonical, defaults={'name': f'{owner}/{name}'}
    )
    if created or repo.status == 'failed':
        repo.status = 'queued'
        repo.save()
        threading.Thread(target=_run, args=(repo.id,), daemon=True).start()
    return Response(RepoSerializer(repo).data, status=201 if created else 200)


class RepoDetail(generics.RetrieveAPIView):
    queryset = Repo.objects.all()
    serializer_class = RepoSerializer


@api_view(['GET'])
def search(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'detail': 'q is required'}, status=400)
    mode = request.query_params.get('mode', 'hybrid')
    return Response(search_chunks(repo, q, mode=mode))

@api_view(['POST'])
def ask(request, repo_id):
    repo = get_object_or_404(Repo, id=repo_id)
    if repo.status != 'ready':
        return Response({'detail': 'Repo is not ready yet'}, status=409)
    question = (request.data.get('question') or '').strip()
    if not question:
        return Response({'detail': 'question is required'}, status=400)
    try:
        return Response(answer_question(repo, question))
    except Exception as e:
        return Response({'detail': str(e)}, status=502)