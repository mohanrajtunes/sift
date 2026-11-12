from pgvector.django import VectorField
from django.db import models
from django.db import models


class Repo(models.Model):
    STATUS = [
        ('queued', 'Queued'),
        ('indexing', 'Indexing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    url = models.URLField(unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=10, choices=STATUS, default='queued')
    error = models.TextField(blank=True)
    file_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RepoFile(models.Model):
    repo = models.ForeignKey(Repo, related_name='files', on_delete=models.CASCADE)
    path = models.CharField(max_length=500)
    language = models.CharField(max_length=30, blank=True)
    size = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('repo', 'path')

    def __str__(self):
        return f'{self.repo.name}:{self.path}'


class Chunk(models.Model):
    file = models.ForeignKey(RepoFile, related_name='chunks', on_delete=models.CASCADE)
    start_line = models.PositiveIntegerField()
    end_line = models.PositiveIntegerField()
    text = models.TextField()
    embedding = VectorField(dimensions=768, null=True, blank=True)
    class Meta:
        ordering = ['file_id', 'start_line']

    def __str__(self):
        return f'{self.file.path}:{self.start_line}-{self.end_line}'