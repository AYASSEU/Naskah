import statistics
from .common import EvaluationError,scope,provenance
def score_sus(answers):
    if not isinstance(answers,list) or len(answers)!=10 or any(type(n) is not int or not 1<=n<=5 for n in answers):raise EvaluationError('invalid_sus_answers')
    return sum(n-1 if i%2==0 else 5-n for i,n in enumerate(answers))*2.5
def evaluate(data):
    responses=data.get('responses',[{'answers':data.get('answers')}])
    if not isinstance(responses,list) or not 1<=len(responses)<=5000:raise EvaluationError('invalid_input')
    if any(not isinstance(r,dict) for r in responses):raise EvaluationError('invalid_input')
    if len(responses)>1 and (any(not isinstance(r.get('participant'),str) or not r['participant'] for r in responses) or len({r['participant'] for r in responses})!=len(responses)):raise EvaluationError('invalid_sus_subjects')
    if scope(data)=='research' and any(r.get('is_thesis_run') is not True or r.get('dev_seed') or r.get('dataset_source')=='dev_seed' for r in responses):raise EvaluationError('dev_seed_excluded')
    rows=[{'participant':r.get('participant'), 'answers':r['answers'],'score':score_sus(r['answers'])} for r in responses]
    scores=[r['score'] for r in rows]
    summary={'n':len(scores),'mean':statistics.mean(scores),'median':statistics.median(scores),'sd':statistics.stdev(scores) if len(scores)>1 else None}
    return {'summary':summary,'schema_version':1,'kind':'sus','data_scope':scope(data),'results':rows,'provenance':provenance(data)}
