"""Repo map: one node per file, one edge per import between two files in the repo."""
import posixpath
import re

from .models import Chunk, RepoFile

PY_FROM = re.compile(r'^\s*from\s+(\.*)([\w.]*)\s+import\s+([\w, ]+)', re.M)
PY_IMPORT = re.compile(r'^\s*import\s+([\w.]+)', re.M)
JS_IMPORT = re.compile(r'''(?:import\s[^'"]*?from\s*|import\s*\(?\s*|require\(\s*)['"]([^'"]+)['"]''')
JS_EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.css', '/index.js', '/index.jsx', '/index.ts', '/index.tsx']


def _python_targets(path, text, paths, by_suffix):
    here = posixpath.dirname(path)
    out = set()
    for dots, module, names in PY_FROM.findall(text):
        if dots:
            base = here
            for _ in range(len(dots) - 1):
                base = posixpath.dirname(base)
            mod = posixpath.join(base, module.replace('.', '/')) if module else base
            candidates = [mod + '.py', mod + '/__init__.py']
            # "from . import views" -> sibling files
            candidates += [posixpath.join(mod, n.strip()) + '.py' for n in names.split(',')]
            out.update(c for c in candidates if c in paths)
        else:
            out.update(by_suffix.get(module.replace('.', '/'), []))
    for module in PY_IMPORT.findall(text):
        out.update(by_suffix.get(module.replace('.', '/'), []))
    return out


def _js_targets(path, text, paths):
    here = posixpath.dirname(path)
    out = set()
    for spec in JS_IMPORT.findall(text):
        if not spec.startswith('.'):
            continue  # packages from npm are not files in the repo
        base = posixpath.normpath(posixpath.join(here, spec))
        for ext in JS_EXT:
            if base + ext in paths:
                out.add(base + ext)
                break
    return out


def build_graph(repo):
    files = list(RepoFile.objects.filter(repo=repo).values('id', 'path', 'language', 'size'))
    paths = {f['path'] for f in files}
    # python modules can be imported by any path suffix: "repos.models" -> ".../repos/models.py"
    by_suffix = {}
    for p in paths:
        if p.endswith('.py'):
            stem = p[:-3]
            if stem.endswith('/__init__'):
                stem = stem[:-9]
            parts = stem.split('/')
            for i in range(len(parts)):
                by_suffix.setdefault('/'.join(parts[i:]), []).append(p)

    texts, lines = {}, {}
    for c in Chunk.objects.filter(file__repo=repo).values('file__path', 'text', 'end_line'):
        p = c['file__path']
        texts.setdefault(p, []).append(c['text'])
        lines[p] = max(lines.get(p, 0), c['end_line'])

    edges = set()
    for p, parts in texts.items():
        text = '\n'.join(parts)
        if p.endswith('.py'):
            targets = _python_targets(p, text, paths, by_suffix)
        elif p.endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs')):
            targets = _js_targets(p, text, paths)
        else:
            continue
        edges.update((p, t) for t in targets if t != p)

    nodes = [{
        'id': f['path'],
        'folder': posixpath.dirname(f['path']) or '.',
        'language': f['language'],
        'lines': lines.get(f['path'], 0),
    } for f in files]
    return {
        'nodes': nodes,
        'edges': [{'source': a, 'target': b} for a, b in sorted(edges)],
    }
