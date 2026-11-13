import json
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from repos.agent import run_agent
from repos.models import Repo
from repos.search import search_chunks

MODES = ['keyword', 'vector', 'hybrid']


class Command(BaseCommand):
    help = 'Score search (and optionally agent answers) against a file of questions.'

    def add_arguments(self, parser):
        parser.add_argument('--repo', type=int, default=1)
        parser.add_argument('--file', default='evals/hirelens.json')
        parser.add_argument('--answers', action='store_true', help='also run the agent and grade answers')

    def handle(self, *args, **o):
        repo = Repo.objects.get(id=o['repo'])
        path = Path(settings.BASE_DIR) / o['file']
        questions = json.loads(path.read_text(encoding='utf-8'))
        n = len(questions)
        out = {'repo': repo.name, 'questions': n}

        self.stdout.write('\nRETRIEVAL: is the right file in the top 5 results?\n')
        self.stdout.write('keyword  vector  hybrid\n')
        hits = {m: 0 for m in MODES}
        for q in questions:
            expect = set(q['files'])
            marks = []
            for m in MODES:
                results = search_chunks(repo, q['q'], mode=m, limit=5)
                ok = any(r['path'] in expect for r in results)
                hits[m] += ok
                marks.append('  Y   ' if ok else '  -   ')
            self.stdout.write(f"{''.join(marks)}  {q['q']}")
        out['retrieval'] = {m: round(hits[m] / n * 100) for m in MODES}
        self.stdout.write('')
        for m in MODES:
            self.stdout.write(f'{m:8} {hits[m]}/{n} = {out["retrieval"][m]}%')

        if o['answers']:
            self.stdout.write('\nANSWERS: correct = key fact in answer, grounded = cites the right file\n')
            correct = grounded = done = 0
            for q in questions:
                expect = set(q['files'])
                try:
                    res = run_agent(repo, q['q'])
                except Exception as e:
                    self.stdout.write(f"error   {q['q']}  ({str(e)[:80]})")
                    time.sleep(10)
                    continue
                done += 1
                text = res['answer'].lower()
                c = any(k.lower() in text for k in q['any'])
                g = any(s['path'] in expect for s in res['sources'])
                correct += c
                grounded += g
                self.stdout.write(f"{'correct' if c else 'WRONG  '} {'grounded' if g else 'UNGROUNDED'}  {q['q']}")
                time.sleep(4)
            out['answers'] = {
                'asked': done,
                'correct_pct': round(correct / max(done, 1) * 100),
                'grounded_pct': round(grounded / max(done, 1) * 100),
            }
            self.stdout.write(f"\ncorrect {correct}/{done}   grounded {grounded}/{done}")

        (Path(settings.BASE_DIR) / 'evals' / 'last_run.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
        self.stdout.write('\nSaved to evals/last_run.json')