from pathlib import Path

SKIP_DIRS = {
    '.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build',
    '.next', 'staticfiles', 'migrations', 'vendor', '.idea', '.vscode',
}
SKIP_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Pipfile.lock',
}
LANGS = {
    '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript', '.java': 'java', '.go': 'go',
    '.rs': 'rust', '.rb': 'ruby', '.php': 'php', '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.cs': 'csharp', '.html': 'html', '.css': 'css',
    '.md': 'markdown', '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml',
    '.toml': 'toml', '.sql': 'sql', '.sh': 'shell',
}
MAX_SIZE = 200_000
MAX_FILES = 1500


def language_for(rel_path):
    return LANGS.get(Path(rel_path).suffix.lower(), '')


def should_index(rel_path, size):
    rel_path = Path(rel_path)
    if any(part in SKIP_DIRS for part in rel_path.parts):
        return False
    if rel_path.name in SKIP_FILES or rel_path.name.endswith('.min.js'):
        return False
    if size == 0 or size > MAX_SIZE:
        return False
    return rel_path.suffix.lower() in LANGS or rel_path.name in {'Dockerfile', 'Makefile'}