from django.contrib import admin
from .models import Repo, RepoFile, Chunk

admin.site.register(Repo)
admin.site.register(RepoFile)
admin.site.register(Chunk)