import re
from .common import EvaluationError,scope,provenance
def check_structure(markdown,template):
    expected=[{'number':c['number'],'title':c['title']} for c in template['chapters']]
    expected=[h for c in template['chapters'] for h in [{'number':c['number'],'title':c['title']}]+[{'number':s['number'],'title':s['title']} for s in c['subsections'] if s['required']]]
    found=set();fence=None
    for line in re.split(r'\r\n|\r|\n',markdown):
        delimiter=re.match(r'^ {0,3}(`{3,}|~{3,})(.*)$',line)
        was_fenced=bool(fence)
        if delimiter:
            token,tail=delimiter.groups()
            if not fence:fence=(token[0],len(token))
            elif token[0]==fence[0] and len(token)>=fence[1] and not tail.strip():fence=None
        if was_fenced or delimiter:continue
        heading=re.match(r'^(#{1,2})[ \t]+([0-9]+(?:\.[0-9]+)*)(?:\.)?[ \t]+(.+?)[ \t]*$',line)
        if not heading:continue
        level,number,_=heading.groups()
        if (len(level)==1)!=('.' not in number):raise EvaluationError('markdown_heading_level')
        if number in found:raise EvaluationError('markdown_duplicate_section')
        found.add(number)
    missing=[h for h in expected if h['number'] not in found]
    # JavaScript Math.round is floor(x+.5) for nonnegative completeness.
    return {'percentage':int((len(expected)-len(missing))/len(expected)*100+.5) if expected else 0,'missing':missing}
def evaluate(data):
    return {'schema_version':1,'kind':'structure','data_scope':scope(data),'result':check_structure(data['markdown'],data['template']),'provenance':provenance(data)}
