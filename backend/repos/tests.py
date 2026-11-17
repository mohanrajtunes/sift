"""Unit tests for the parts of Sift that don't need a live database or AI model."""
import time
from types import SimpleNamespace
from unittest import mock

from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase

from . import search
from .agent import Session
from .indexer.chunker import MAX_LINES, OVERLAP, WINDOW, chunk_python, chunk_text
from .indexer.filters import language_for, should_index
from .limits import client_ip, hit


class ChunkerTests(SimpleTestCase):
    def test_python_splits_on_functions_and_classes(self):
        src = 'import os\n\n\ndef a():\n    return 1\n\n\nclass B:\n    x = 2\n'
        spans = [(s, e) for s, e, _ in chunk_python(src)]
        self.assertIn((4, 5), spans)   # def a
        self.assertIn((8, 9), spans)   # class B
        self.assertEqual(spans[0][0], 1)  # imports kept as their own chunk

    def test_decorator_stays_with_its_function(self):
        src = 'x = 1\n\n@cache\ndef f():\n    pass\n'
        self.assertIn((3, 5), [(s, e) for s, e, _ in chunk_python(src)])

    def test_long_function_gets_overlapping_windows(self):
        body = '\n'.join(f'    v{i} = {i}' for i in range(MAX_LINES + 40))
        chunks = chunk_python('def big():\n' + body + '\n')
        self.assertGreater(len(chunks), 1)
        first, second = chunks[0], chunks[1]
        self.assertEqual(first[1] - first[0] + 1, WINDOW)
        self.assertEqual(second[0], first[1] - OVERLAP + 1)

    def test_broken_python_falls_back_to_windows(self):
        chunks = chunk_python('def broken(:\n    pass\n')
        self.assertEqual(chunks[0][:2], (1, 2))

    def test_other_languages_use_windows(self):
        text = '\n'.join(f'line {i}' for i in range(10))
        self.assertEqual(chunk_text(text, 'javascript'), [(1, 10, text)])

    def test_blank_file_gives_no_chunks(self):
        self.assertEqual(chunk_text('\n\n   \n', 'python'), [])


class FilterTests(SimpleTestCase):
    def test_skips_vendor_and_lock_files(self):
        self.assertFalse(should_index('node_modules/react/index.js', 100))
        self.assertFalse(should_index('app/migrations/0001_initial.py', 100))
        self.assertFalse(should_index('package-lock.json', 100))
        self.assertFalse(should_index('static/app.min.js', 100))

    def test_skips_empty_and_huge_files(self):
        self.assertFalse(should_index('app/views.py', 0))
        self.assertFalse(should_index('app/views.py', 10_000_000))

    def test_indexes_source_files(self):
        self.assertTrue(should_index('app/views.py', 500))
        self.assertTrue(should_index('Dockerfile', 50))
        self.assertEqual(language_for('src/App.TSX'), 'typescript')
        self.assertEqual(language_for('photo.png'), '')


class SearchTests(SimpleTestCase):
    def test_terms_drop_stop_words_and_short_words(self):
        self.assertEqual(search.terms_from('Where is the JWT login checked?'), ['jwt', 'login', 'checked'])

    def test_hybrid_ranks_chunks_found_by_both_methods_first(self):
        def chunk(i, path):
            return SimpleNamespace(id=i, file=SimpleNamespace(path=path), start_line=1, end_line=5, text='x')
        a, b, c = chunk(1, 'auth.py'), chunk(2, 'views.py'), chunk(3, 'models.py')
        with mock.patch.object(search, 'keyword_rank', return_value=[a, c]), \
             mock.patch.object(search, 'vector_rank', return_value=[b, c]):
            out = search.search_chunks(repo=None, q='login', mode='hybrid')
        self.assertEqual(out[0]['path'], 'models.py')  # in both lists, so it wins
        self.assertEqual({r['path'] for r in out}, {'auth.py', 'views.py', 'models.py'})

    def test_keyword_mode_skips_embeddings(self):
        with mock.patch.object(search, 'keyword_rank', return_value=[]), \
             mock.patch.object(search, 'vector_rank') as vec:
            search.search_chunks(repo=None, q='login', mode='keyword')
        vec.assert_not_called()


class SessionTests(SimpleTestCase):
    def test_same_excerpt_reuses_its_citation_number(self):
        s = Session(repo=None)
        self.assertEqual(s.cite('a.py', 1, 10), 1)
        self.assertEqual(s.cite('b.py', 3, 4), 2)
        self.assertEqual(s.cite('a.py', 1, 10), 1)
        self.assertEqual(len(s.sources), 2)

    def test_bad_tool_calls_are_reported_not_raised(self):
        s = Session(repo=None)
        self.assertIn('Invalid arguments', s.run('search_code', '{not json')[1])
        self.assertIn('Unknown tool', s.run('delete_repo', '{}')[1])
        self.assertIn('longer name', s.run('find_references', '{"name": "x"}')[1])


class RateLimitTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.rf = RequestFactory()

    def test_uses_first_forwarded_ip(self):
        req = self.rf.get('/', HTTP_X_FORWARDED_FOR='1.2.3.4, 10.0.0.1')
        self.assertEqual(client_ip(req), '1.2.3.4')

    def test_blocks_after_limit_per_ip(self):
        req = self.rf.get('/', REMOTE_ADDR='5.5.5.5')
        self.assertEqual([hit(req, 'ask', 2) for _ in range(2)], [0, 0])
        self.assertGreater(hit(req, 'ask', 2), 0)
        other = self.rf.get('/', REMOTE_ADDR='6.6.6.6')
        self.assertEqual(hit(other, 'ask', 2), 0)

    def test_window_expires(self):
        req = self.rf.get('/', REMOTE_ADDR='7.7.7.7')
        hit(req, 'ask', 1, window=60)
        with mock.patch('repos.limits.time.time', return_value=time.time() + 61):
            self.assertEqual(hit(req, 'ask', 1, window=60), 0)
