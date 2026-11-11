"""Descriptive expert ratings without inventing inference for tiny samples."""
import statistics
from .common import EvaluationError,scope,provenance
DIMENSIONS=['unambiguous','complete','correct','verifiable']
def describe(values):
    return {'n':len(values),'mean':statistics.mean(values) if values else None,'median':statistics.median(values) if values else None,'sd':statistics.stdev(values) if len(values)>1 else None}
def evaluate(data):
    selected=scope(data);design=data.get('design');rows=data.get('reviews')
    if design not in ['paired','independent']:raise EvaluationError('study_design_required')
    if not isinstance(rows,list) or not rows or len(rows)>2000:raise EvaluationError('insufficient_samples')
    if any(not isinstance(r,dict) for r in rows):raise EvaluationError('invalid_input')
    grouped={'system':{},'human':{}};cases={'system':{},'human':{}};seen=set()
    for row in rows:
        if selected=='research' and (row.get('is_thesis_run') is not True or row.get('dev_seed') or row.get('dataset_source')=='dev_seed'):raise EvaluationError('dev_seed_excluded')
        participant,case,source=row.get('participant'),row.get('case_id'),row.get('source');ratings=row.get('ratings')
        if not isinstance(participant,str) or not participant or not isinstance(case,str) or not case or source not in grouped:raise EvaluationError('invalid_input')
        if not isinstance(ratings,list) or len(ratings)!=4 or any(type(v) is not int or not 1<=v<=5 for v in ratings):raise EvaluationError('invalid_ratings')
        key=(participant,case,source)
        if key in seen:raise EvaluationError('duplicate_observation')
        seen.add(key);grouped[source].setdefault(participant,[]).append(ratings);cases[source].setdefault(participant,set()).add(case)
    if design=='paired' and cases['system']!=cases['human']:raise EvaluationError('pairing_mismatch')
    if design=='independent' and set(grouped['system'])&set(grouped['human']):raise EvaluationError('independent_groups_overlap')
    results=[]
    for source,people in grouped.items():
        for index,dimension in enumerate(DIMENSIONS):
            values=[statistics.mean(r[index] for r in ratings) for ratings in people.values()]
            results.append({'source':source,'dimension':dimension,**describe(values)})
    return {'schema_version':1,'kind':'expert','data_scope':selected,'design':design,'unit':'participant_mean_across_cases','results':results,'provenance':provenance(data)}
