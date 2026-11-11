from rouge_score import rouge_scorer,tokenizers,scoring
from .common import EvaluationError,scope,provenance
def rolling_lcs(reference,prediction):
    if len(reference)>len(prediction):reference,prediction=prediction,reference
    row=[0]*(len(reference)+1)
    for token in prediction:
        previous=0
        for index,other in enumerate(reference,1):
            saved=row[index]
            row[index]=previous+1 if token==other else max(row[index],row[index-1])
            previous=saved
    return row[-1]
def evaluate(data):
    selected=scope(data);pairs=data.get('pairs')
    if not isinstance(pairs,list) or not 1<=len(pairs)<=10:raise EvaluationError('invalid_input')
    if any(not isinstance(p,dict) for p in pairs):raise EvaluationError('invalid_input')
    results=[]
    for pair in pairs:
        language,reference_language=pair.get('language'),pair.get('reference_language')
        if language not in ['id','en'] or reference_language not in ['id','en']:raise EvaluationError('invalid_input')
        mismatch=language!=reference_language
        reason=pair.get('override_reason','').strip()
        if mismatch and (not data.get('allow_language_mismatch') or len(reason)<12):raise EvaluationError('language_mismatch')
        if mismatch and selected=='research':raise EvaluationError('language_mismatch')
        if selected=='research' and (pair.get('is_thesis_run') is not True or pair.get('dev_seed') or pair.get('dataset_source')=='dev_seed'):raise EvaluationError('dev_seed_excluded')
        stem=bool(data.get('use_stemmer',False))
        if stem and (language!='en' or reference_language!='en'):raise EvaluationError('invalid_stemmer_language')
        prediction,reference=pair.get('prediction',''),pair.get('reference','')
        if not isinstance(prediction,str) or not isinstance(reference,str) or not prediction.strip() or not reference.strip():raise EvaluationError('invalid_input')
        if len(prediction)>100000 or len(reference)>100000:raise EvaluationError('evaluation_too_large')
        tokenizer=tokenizers.DefaultTokenizer(use_stemmer=stem)
        prediction_tokens,reference_tokens=tokenizer.tokenize(prediction),tokenizer.tokenize(reference)
        if max(len(prediction_tokens),len(reference_tokens))>5000:raise EvaluationError('evaluation_too_large')
        scorer=rouge_scorer.RougeScorer(['rouge1','rouge2'],tokenizer=tokenizer)
        scores=scorer.score(reference,prediction)
        length=rolling_lcs(reference_tokens,prediction_tokens)
        precision=length/len(prediction_tokens) if prediction_tokens else 0
        recall=length/len(reference_tokens) if reference_tokens else 0
        scores['rougeL']=scoring.Score(precision,recall,scoring.fmeasure(precision,recall))
        results.append({'scenario':pair.get('scenario','Comparison'),'case_id':pair.get('case_id'),
          **{key:{'precision':value.precision,'recall':value.recall,'f1':value.fmeasure} for key,value in scores.items()},
          'language':language,'reference_language':reference_language,'valid_comparison':not mismatch,
          'override_reason':reason if mismatch else None,'use_stemmer':stem,'tokenizer':'rouge_score.default_ascii_lowercase'})
    return {'schema_version':1,'kind':'rouge','data_scope':selected,'results':results,'provenance':provenance(data)}
