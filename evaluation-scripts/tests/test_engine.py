import json,os,unittest
from pathlib import Path
from evaluation_scripts.sus import score_sus,evaluate as sus
from evaluation_scripts.structure_check import check_structure
from evaluation_scripts.rouge_eval import evaluate as rouge
from evaluation_scripts.stats import evaluate as stats
from evaluation_scripts.common import EvaluationError
from evaluation_scripts.expert import evaluate as expert
from rouge_score.rouge_scorer import RougeScorer
import random
def observations(a,b,paired=True,cases=1):
    return [{'participant':str(i) if paired or source=='system' else 'human-'+str(i),'case_id':str(case),'source':source,'ratings':[value]*4,'is_thesis_run':False} for source,values in [('system',a),('human',b)] for i,value in enumerate(values) for case in range(cases)]
class EngineTests(unittest.TestCase):
    def test_retired_operation_is_rejected(self):
        from evaluation_scripts.__main__ import run
        with self.assertRaisesRegex(EvaluationError, 'invalid_operation'):
            run('bertscore', {})

    @classmethod
    def setUpClass(cls):cls.golden=json.loads(Path(os.environ.get('GOLDEN_FILE','/fixtures/golden.json')).read_text())
    def test_shared_sus_vectors(self):
        for vector in self.golden['sus']:self.assertEqual(score_sus(vector['answers']),vector['score'])
    def test_shared_structure_vectors(self):
        for vector in self.golden['structure']:
            if 'error' in vector:
                with self.assertRaisesRegex(EvaluationError,vector['error']):check_structure(vector['markdown'],self.golden['template'])
            else:
                result=check_structure(vector['markdown'],self.golden['template']);self.assertEqual(result['percentage'],vector['percentage']);self.assertEqual([h['number'] for h in result['missing']],vector['missing'])
    def test_sus_rejects_non_integer_missing_boolean(self):
        for answers in [[1]*9,[1.5]*10,[True]*10,[6]*10,['1']*10]:
            with self.assertRaises(EvaluationError):score_sus(answers)
    def test_sus_ignores_forged_score(self):self.assertEqual(sus({'responses':[{'answers':[1]*10,'score':100}]})['results'][0]['score'],50)
    def test_known_rouge_scores(self):
        r=rouge({'pairs':[{'case_id':None,'scenario':'Known','prediction':'alpha beta','reference':'alpha beta gamma','language':'en','reference_language':'en'}]})['results'][0]
        self.assertAlmostEqual(r['rouge1']['f1'],.8);self.assertAlmostEqual(r['rouge2']['f1'],2/3);self.assertAlmostEqual(r['rougeL']['recall'],2/3)
    def test_language_guard_and_override(self):
        data={'pairs':[{'prediction':'sistem harus menyimpan','reference':'system shall save','language':'id','reference_language':'en','override_reason':'Synthetic language mismatch test'}]}
        with self.assertRaisesRegex(EvaluationError,'language_mismatch'):rouge(data)
        data['allow_language_mismatch']=True;self.assertFalse(rouge(data)['results'][0]['valid_comparison'])
        data['data_scope']='research'
        with self.assertRaisesRegex(EvaluationError,'language_mismatch'):rouge(data)
    def test_no_indonesian_stemming(self):
        with self.assertRaisesRegex(EvaluationError,'invalid_stemmer_language'):rouge({'use_stemmer':True,'pairs':[{'prediction':'sistem harus','reference':'sistem harus','language':'id','reference_language':'id'}]})
    def test_exact_paired(self):
        r=stats({'design':'paired','reviews':observations([2,3,4,5],[1,1,1,1])})['results'][0]
        self.assertEqual(r['method'],'exact');self.assertEqual(r['statistic'],0);self.assertAlmostEqual(r['p_value'],.125);self.assertEqual(r['effect_size'],1)
    def test_ties_use_exhaustive_sign_permutations(self):
        r=stats({'design':'paired','reviews':observations([5,4,4],[3,3,2])})['results'][0]
        self.assertEqual(r['method'],'exhaustive_sign_permutation');self.assertAlmostEqual(r['p_value'],.25);self.assertIsNone(r['effect_ci'])
    def test_all_zero_differences_are_finite(self):
        r=stats({'design':'paired','reviews':observations([3,3],[3,3])})['results'][0]
        self.assertEqual(r['p_value'],1);self.assertEqual(r['effect_size'],0);self.assertEqual(r['method'],'all_zero_differences')
    def test_independent_known_statistic_and_ties(self):
        r=stats({'design':'independent','reviews':observations([5,5],[1,1],False)})['results'][0]
        self.assertEqual(r['statistic'],4);self.assertAlmostEqual(r['p_value'],1/3);self.assertEqual(r['effect_size'],1);self.assertEqual(r['method'],'exhaustive_label_permutation')
    def test_repeated_cases_are_not_extra_participants(self):
        r=stats({'design':'paired','reviews':observations([4,5],[2,3],cases=3)})['results'][0];self.assertEqual(r['n'],2)
    def test_design_pairing_and_sample_refusals(self):
        for data,code in [({'reviews':[]},'study_design_required'),({'design':'paired','reviews':observations([4],[2])},'insufficient_samples'),({'design':'independent','reviews':observations([4,5],[2,3])},'independent_groups_overlap'),({'design':'paired','reviews':observations([4,5],[2])},'pairing_mismatch')]:
            with self.assertRaisesRegex(EvaluationError,code):stats(data)
    def test_duplicate_subject_case_source_refused(self):
        rows=observations([4,5],[2,3]);rows.append(rows[0])
        with self.assertRaisesRegex(EvaluationError,'duplicate_observation'):stats({'design':'paired','reviews':rows})
    def test_bootstrap_is_deterministic_and_holm_monotonic(self):
        data={'design':'paired','reviews':observations([5,4,4,3,5,4],[3,3,4,2,4,2]),'seed':42}
        a=stats(data);self.assertEqual(a,stats(data));self.assertIsNotNone(a['results'][0]['effect_ci'])
        for r in a['results']:self.assertGreaterEqual(r['p_adjusted'],r['p_value']);self.assertLessEqual(r['effect_ci']['low'],r['effect_ci']['high'])
    def test_expert_descriptive_one_participant(self):
        result=expert({'design':'paired','reviews':observations([4],[2],cases=3)})
        self.assertEqual(result['unit'],'participant_mean_across_cases')
        self.assertEqual(result['results'][0],{'source':'system','dimension':'unambiguous','n':1,'mean':4,'median':4,'sd':None})
    def test_rolling_rouge_l_matches_reference(self):
        rng=random.Random(42);scorer=RougeScorer(['rougeL'])
        for _ in range(100):
            prediction=' '.join(rng.choices(['alpha','beta','gamma','delta'],k=rng.randint(1,25)))
            reference=' '.join(rng.choices(['alpha','beta','gamma','delta'],k=rng.randint(1,25)))
            actual=rouge({'pairs':[{'prediction':prediction,'reference':reference,'language':'en','reference_language':'en'}]})['results'][0]['rougeL']
            expected=scorer.score(reference,prediction)['rougeL']
            self.assertEqual(actual,{'precision':expected.precision,'recall':expected.recall,'f1':expected.fmeasure})
    def test_research_rejects_synthetic_records(self):
        for field,value in [('is_thesis_run',False),('dev_seed',True),('dataset_source','dev_seed')]:
            rows=observations([4,5],[2,3])
            for row in rows:row.update({'is_thesis_run':True,field:value})
            for operation in [stats,expert]:
                with self.assertRaisesRegex(EvaluationError,'dev_seed_excluded'):operation({'data_scope':'research','design':'paired','reviews':rows})
            with self.assertRaisesRegex(EvaluationError,'dev_seed_excluded'):sus({'data_scope':'research','responses':[{'answers':[3]*10,'is_thesis_run':True,field:value}]})
            with self.assertRaisesRegex(EvaluationError,'dev_seed_excluded'):rouge({'data_scope':'research','pairs':[{'prediction':'alpha','reference':'alpha','language':'en','reference_language':'en','is_thesis_run':True,field:value}]})
    def test_sus_duplicate_subject_refused(self):
        with self.assertRaisesRegex(EvaluationError,'invalid_sus_subjects'):sus({'responses':[{'participant':'same','answers':[3]*10}]*2})
if __name__=='__main__':unittest.main()
