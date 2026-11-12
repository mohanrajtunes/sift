import io
import re
import tempfile
import zipfile
from pathlib import Path

import requests

MAX_ZIP_BYTES = 50 * 1024 * 1024


def parse_github_url(url):
    m = re.match(r'https?://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?$', url.strip())
    if not m:
        raise ValueError('Use a GitHub repo URL like https://github.com/user/repo')
    return m.group(1), m.group(2)


def download_repo(url):
    owner, name = parse_github_url(url)
    resp = requests.get(
        f'https://api.github.com/repos/{owner}/{name}/zipball',
        timeout=60,
        stream=True,
    )
    if resp.status_code == 404:
        raise ValueError('Repo not found, or it is private')
    resp.raise_for_status()

    buf = io.BytesIO()
    for part in resp.iter_content(1024 * 256):
        buf.write(part)
        if buf.tell() > MAX_ZIP_BYTES:
            raise ValueError('Repo is too large (limit 50 MB)')

    tmp = tempfile.mkdtemp(prefix='sift_')
    with zipfile.ZipFile(buf) as z:
        z.extractall(tmp)
    # GitHub zips contain one top folder
    return next(Path(tmp).iterdir())