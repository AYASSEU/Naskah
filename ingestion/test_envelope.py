import json
import unittest
from pathlib import Path
from envelope import seal, unseal

class EnvelopeTests(unittest.TestCase):
    def test_shared_node_vector(self):
        v=json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/envelope.json').read_text())
        self.assertEqual(unseal(v['envelope'],v['provider'],v['owner'],{1:v['key']}),v['plaintext'])
        with self.assertRaises(Exception):
            unseal(v['envelope'],v['provider'],'different-owner',{1:v['key']})
        generated=seal(v['plaintext'],v['provider'],v['owner'],v['key'])
        self.assertEqual(unseal(generated,v['provider'],v['owner'],{1:v['key']}),v['plaintext'])

if __name__=='__main__': unittest.main()
