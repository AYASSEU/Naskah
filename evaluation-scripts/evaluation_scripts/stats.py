"""Participant means are the independent units; never treat case rows as subjects."""
import math,statistics
import numpy as np
from scipy import stats
from .common import EvaluationError,scope,provenance
DIMENSIONS=['unambiguous','complete','correct','verifiable']
def describe(values):
    return {'n':len(values),'mean':statistics.mean(values) if values else None,'median':statistics.median(values) if values else None,'sd':statistics.stdev(values) if len(values)>1 else None}
def rank_effect(differences):
    d=np.asarray(differences);d=d[d!=0]
    if not len(d):return 0.0
    ranks=stats.rankdata(abs(d));return float((ranks[d>0].sum()-ranks[d<0].sum())/ranks.sum())
def cliff_effect(a,b):
    a,b=np.asarray(a),np.asarray(b)
    return float(np.sign(a[:,None]-b[None,:]).mean())
def effect_ci(a,b,paired,seed):
    if min(len(a),len(b))<5:return None,'at_least_5_participants_per_group_required'
    if np.var(a-b if paired else np.concatenate([a,b]))==0:return None,'degenerate_sample'
    rng=np.random.default_rng(seed);values=[]
    for _ in range(2000):
        indices=rng.integers(0,len(a),len(a));x=a[indices]
        y=b[indices] if paired else b[rng.integers(0,len(b),len(b))]
        values.append(rank_effect(np.round(x-y,12)) if paired else cliff_effect(x,y))
    lo,hi=np.quantile(values,[.025,.975]);return {'low':float(lo),'high':float(hi),'level':.95,'method':'participant_percentile_bootstrap_2000'},None
def evaluate(data):
    selected=scope(data);design=data.get('design')
    if design not in ['paired','independent']:raise EvaluationError('study_design_required')
    rows=data.get('reviews',[])
    if not isinstance(rows,list) or not rows or len(rows)>2000:raise EvaluationError('insufficient_samples')
    if any(not isinstance(r,dict) for r in rows):raise EvaluationError('invalid_input')
    if selected=='research' and any(row.get('is_thesis_run') is not True or row.get('dev_seed') or row.get('dataset_source')=='dev_seed' for row in rows):raise EvaluationError('dev_seed_excluded')
    seen=set();grouped={'system':{},'human':{}};case_sets={'system':{},'human':{}}
    for row in rows:
        participant,case,source=row.get('participant'),row.get('case_id'),row.get('source')
        ratings=row.get('ratings')
        if not isinstance(participant,str) or not participant or not isinstance(case,str) or not case or source not in grouped:raise EvaluationError('invalid_input')
        if not isinstance(ratings,list) or len(ratings)!=4 or any(type(v) is not int or not 1<=v<=5 for v in ratings):raise EvaluationError('invalid_ratings')
        key=(participant,case,source)
        if key in seen:raise EvaluationError('duplicate_observation')
        seen.add(key);grouped[source].setdefault(participant,[]).append(ratings);case_sets[source].setdefault(participant,set()).add(case)
    a_ids,b_ids=set(grouped['system']),set(grouped['human'])
    paired=design=='paired'
    if paired and (a_ids!=b_ids or any(case_sets['system'][p]!=case_sets['human'][p] for p in a_ids)):raise EvaluationError('pairing_mismatch')
    if not paired and a_ids&b_ids:raise EvaluationError('independent_groups_overlap')
    if min(len(a_ids),len(b_ids))<2:raise EvaluationError('insufficient_samples')
    if max(len(a_ids),len(b_ids))>200:raise EvaluationError('evaluation_too_large')
    seed=data.get('seed',20261110)
    if type(seed) is not int or not 0<=seed<=2147483647:raise EvaluationError('invalid_input')
    means={source:{p:np.mean(ratings,axis=0) for p,ratings in subjects.items()} for source,subjects in grouped.items()}
    results=[]
    for index,dimension in enumerate(DIMENSIONS):
        a=np.array([means['system'][p][index] for p in sorted(a_ids)]);b=np.array([means['human'][p][index] for p in sorted(b_ids)])
        warnings=[]
        if min(len(a),len(b))<5:warnings.append('tiny_sample_low_power')
        if paired:
            d=np.round(a-b,12);nonzero=d[d!=0];ties=len(set(abs(nonzero)))!=len(nonzero);zeros=len(d)!=len(nonzero)
            if not len(nonzero):statistic,p=0.0,1.0;method='all_zero_differences';warnings.append('all_differences_zero')
            else:
                if not ties and not zeros and len(d)<=50:method='exact';config='exact'
                else:
                    exhaustive=len(d)<=12;method='exhaustive_sign_permutation' if exhaustive else 'monte_carlo_sign_permutation_9999'
                    config=stats.PermutationMethod(n_resamples=np.inf if exhaustive else 9999,batch=100,rng=np.random.default_rng(seed+index))
                answer=stats.wilcoxon(d,zero_method='wilcox',alternative='two-sided',method=config);statistic,p=float(answer.statistic),float(answer.pvalue)
            effect=rank_effect(d);effect_name='paired_rank_biserial';n=len(a)
        else:
            ties=len(set(np.concatenate([a,b])))!=len(a)+len(b);zeros=False
            if not ties and min(len(a),len(b))<=8:method='exact';config='exact'
            else:
                exhaustive=math.comb(len(a)+len(b),len(a))<=50000;method='exhaustive_label_permutation' if exhaustive else 'monte_carlo_label_permutation_9999'
                config=stats.PermutationMethod(n_resamples=np.inf if exhaustive else 9999,batch=100,rng=np.random.default_rng(seed+index))
            answer=stats.mannwhitneyu(a,b,alternative='two-sided',method=config);statistic,p=float(answer.statistic),float(answer.pvalue)
            effect=cliff_effect(a,b);effect_name='cliffs_delta';n=len(a)+len(b)
        ci,ci_reason=effect_ci(a,b,paired,seed+index+100)
        if not math.isfinite(p):raise EvaluationError('statistics_undefined')
        results.append({'test':'wilcoxon' if paired else 'mann_whitney','dimension':dimension,'n':n,'n_system':len(a),'n_human':len(b),'statistic':statistic,'p_value':min(1,max(0,p)),'effect_size':effect,'effect_name':effect_name,'effect_ci':ci,'ci_unavailable_reason':ci_reason,'method':method,'ties':ties,'zeros':zeros,'warnings':warnings,'descriptive':{'system':describe(a.tolist()),'human':describe(b.tolist())}})
    rows=sorted(rows,key=lambda r:(r['participant'],r['case_id'],r['source']))
    previous=0
    for rank,index in enumerate(sorted(range(4),key=lambda i:results[i]['p_value'])):
        previous=max(previous,min(1,results[index]['p_value']*(4-rank)));results[index]['p_adjusted']=previous;results[index]['significant']=previous<.05
    return {'schema_version':1,'kind':'statistics','data_scope':selected,'design':design,'unit':'participant_mean_across_cases','alternative':'two-sided','correction':'holm_4_dimensions','alpha':.05,'seed':seed,'results':results,'provenance':provenance({'data_scope':selected,'reviews':rows,'design':design,'seed':seed}),'limitations':['Wilcoxon location interpretation requires symmetric paired differences.','Mann-Whitney tests distributions; a median shift interpretation needs comparable shapes.','Percentile effect confidence intervals are approximate and not multiplicity-adjusted.']}
