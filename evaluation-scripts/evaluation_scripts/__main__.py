import argparse,json,sys
from pathlib import Path
from .common import EvaluationError
def run(operation,data):
    if not isinstance(data,dict):raise EvaluationError('invalid_input')
    if operation=='sus':from .sus import evaluate
    elif operation=='expert':from .expert import evaluate
    elif operation=='structure':from .structure_check import evaluate
    elif operation=='bertscore':from .bertscore import evaluate
    elif operation=='rouge':from .rouge_eval import evaluate
    elif operation=='stats':from .stats import evaluate
    else:raise EvaluationError('invalid_operation')
    return evaluate(data)
def main():
    parser=argparse.ArgumentParser(description='Local Naskah evaluation; no provider calls.')
    parser.add_argument('operation',choices=['sus','expert','structure','rouge','bertscore','stats','export','worker'])
    parser.add_argument('--input');parser.add_argument('--output');parser.add_argument('--scope',choices=['dev','research'],default='research');parser.add_argument('--base-url',default='http://127.0.0.1:3000');parser.add_argument('--allow-language-mismatch',action='store_true')
    args=parser.parse_args()
    try:
        if args.operation=='export':
            from .export_from_supabase import export
            export(args.base_url,args.scope,args.output);return
        data=json.loads(Path(args.input).read_text(encoding='utf-8-sig')) if args.input else json.load(sys.stdin)
        if args.operation in ['stats','expert'] and 'stats_input' in data:data=data['stats_input']
        if args.allow_language_mismatch:data['allow_language_mismatch']=True
        result=run(data['operation'],data['input']) if args.operation=='worker' else run(args.operation,data)
        text=json.dumps(result,ensure_ascii=False,allow_nan=False,indent=2)+'\n'
        if args.output:Path(args.output).write_text(text,encoding='utf-8',newline='\n')
        else:sys.stdout.write(text)
    except (ValueError,KeyError,TypeError) as error:
        code=str(error) if isinstance(error,EvaluationError) else 'invalid_input'
        sys.stdout.write(json.dumps({'error':code})+'\n');sys.exit(1)
if __name__=='__main__':main()
