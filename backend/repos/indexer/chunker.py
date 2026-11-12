import ast

MAX_LINES = 80
WINDOW = 60
OVERLAP = 10


def _windows(lines, start, end):
    """Split lines[start-1:end] (1-indexed, inclusive) into overlapping windows."""
    out = []
    s = start
    while s <= end:
        e = min(s + WINDOW - 1, end)
        text = '\n'.join(lines[s - 1:e])
        if text.strip():
            out.append((s, e, text))
        if e == end:
            break
        s = e - OVERLAP + 1
    return out


def _segment(lines, start, end):
    if end < start:
        return []
    text = '\n'.join(lines[start - 1:end])
    if not text.strip():
        return []
    if end - start + 1 <= MAX_LINES:
        return [(start, end, text)]
    return _windows(lines, start, end)


def chunk_python(text):
    lines = text.splitlines()
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return _windows(lines, 1, len(lines))

    nodes = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start = min([node.lineno] + [d.lineno for d in node.decorator_list])
            nodes.append((start, node.end_lineno))

    chunks = []
    cursor = 1
    for start, end in nodes:
        chunks += _segment(lines, cursor, start - 1)  # imports, constants, etc.
        chunks += _segment(lines, start, end)
        cursor = end + 1
    chunks += _segment(lines, cursor, len(lines))
    return chunks


def chunk_text(text, language):
    if language == 'python':
        return chunk_python(text)
    lines = text.splitlines()
    return _windows(lines, 1, len(lines))