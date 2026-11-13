import shutil

from repos.embeddings import embed_documents
from repos.models import Chunk, Repo, RepoFile

from .chunker import chunk_text
from .download import download_repo
from .filters import MAX_FILES, language_for, should_index


def embed_chunks(repo):
    chunks = list(
        Chunk.objects.filter(file__repo=repo, embedding__isnull=True).select_related('file')
    )
    for i in range(0, len(chunks), 40):
        part = chunks[i:i + 40]
        vecs = embed_documents([f'{c.file.path}\n{c.text[:6000]}' for c in part])
        for c, v in zip(part, vecs):
            c.embedding = v
        Chunk.objects.bulk_update(part, ['embedding'])


def index_repo(repo_id):
    repo = Repo.objects.get(id=repo_id)
    repo.status = 'indexing'
    repo.error = ''
    repo.save()
    root = None
    try:
        root = download_repo(repo.url)
        repo.files.all().delete()
        count = 0
        for path in sorted(root.rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(root)
            size = path.stat().st_size
            if not should_index(rel, size):
                continue
            try:
                text = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            if '\0' in text or not text.strip():
                continue

            language = language_for(rel)
            f = RepoFile.objects.create(
                repo=repo, path=rel.as_posix(), language=language, size=size
            )
            Chunk.objects.bulk_create([
                Chunk(file=f, start_line=s, end_line=e, text=t)
                for s, e, t in chunk_text(text, language)
            ])
            count += 1
            if count % 10 == 0:  # lets the live map show progress
                Repo.objects.filter(id=repo.id).update(file_count=count)
            if count >= MAX_FILES:
                break
        embed_chunks(repo)
        repo.file_count = count
        repo.status = 'ready'
    except Exception as exc:
        repo.status = 'failed'
        repo.error = str(exc)[:500]
    finally:
        if root:
            shutil.rmtree(root.parent, ignore_errors=True)
        repo.save()