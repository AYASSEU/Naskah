import unittest
import tempfile
from pathlib import Path
from .chunking import assign_split, chunk_document, token_count, detect_section
from .dev_seed import documents
from .io import retry_delay, read_embedding_cache


class PipelineTests(unittest.TestCase):
    def test_split_stable_and_project_disjoint(self):
        rows = [{'doc_id':f'p{i}','dataset_source':'PROMISE_exp'} for i in range(50)]
        first = assign_split(rows,'fixed')
        self.assertEqual(first,assign_split(list(reversed(rows)),'fixed'))
        self.assertEqual(10,list(first.values()).count('ground_truth'))
        self.assertNotEqual(first,assign_split(rows,'other'))

    def test_seed_has_provenance_and_bounded_whole_requirements(self):
        docs = documents();chunks = [c for d in docs for c in chunk_document(d)]
        self.assertEqual(len(chunks),150)
        self.assertEqual({d['dataset_source'] for d in docs},{'dev_seed'})
        self.assertTrue(all(300<=c['token_count']<=600 for c in chunks))
        self.assertEqual(len(chunks),len({c['content_hash'] for c in chunks}))
        self.assertTrue(all(c['metadata']['synthetic'] for c in chunks))
        self.assertEqual({'kb'},set(assign_split(docs,'test').values()))
        for c in chunks:
            self.assertTrue(c['content'].startswith('REQ-F-'))
            self.assertTrue(c['content'].endswith('.'))

    def test_unknown_headings_are_not_guessed(self):
        self.assertEqual(detect_section('1 Project participants'),('unknown',0.0))
        self.assertIsNone(detect_section('The system security shall enforce authorization.'))

    def test_long_atomic_requirement_rejected(self):
        with self.assertRaisesRegex(ValueError,'oversize_requirement'):
            chunk_document({'doc_id':'x','dataset_source':'dev_seed','language':'en','content':'REQ-01: '+'word '*700})

    def test_retry_after_is_honored_and_bounded(self):
        self.assertEqual(retry_delay('9',0),9)
        self.assertEqual(retry_delay('999',0),60)
        self.assertEqual(retry_delay(None,2),4)

    def test_interrupted_cache_append_recovers_only_last_row(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'cache.jsonl'
            path.write_text('{"content_hash":"first"}\n{"incomplete":')
            self.assertEqual(read_embedding_cache(path),[{'content_hash':'first'}])
            self.assertEqual(read_embedding_cache(path),[{'content_hash':'first'}])
            path.write_text('{broken}\n{"content_hash":"second"}\n')
            with self.assertRaisesRegex(ValueError,'cache_corrupted'):
                read_embedding_cache(path)


if __name__=='__main__':
    unittest.main()
