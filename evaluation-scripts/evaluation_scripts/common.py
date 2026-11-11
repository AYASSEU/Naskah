import hashlib,json,platform
from importlib.metadata import version
from . import VERSION
class EvaluationError(ValueError):
    pass
def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def provenance(value):
    return {'engine':VERSION,'input_digest':digest(value),'python':platform.python_version(),'numpy':version('numpy'),'scipy':version('scipy'),'rouge_score':version('rouge-score')}
def scope(value):
    selected=value.get('data_scope','dev')
    if selected not in ['dev','research']:raise EvaluationError('invalid_input')
    return selected
