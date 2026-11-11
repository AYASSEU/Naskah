"""Use the local owner API; no Supabase key is needed in an analysis script."""
import csv,http.cookiejar,json,urllib.request,urllib.parse
from pathlib import Path
from .common import EvaluationError
def export(base,scope,output):
    url=urllib.parse.urlparse(base)
    if url.scheme!='http' or url.hostname not in ['127.0.0.1','localhost','::1'] or url.port!=3000 or url.username or url.query or url.fragment:raise EvaluationError('local_access_only')
    if not output:raise EvaluationError('output_directory_required')
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    opener.open(urllib.request.Request(base+'/api/auth/session',headers={'X-Naskah-Client':'web'}),timeout=30).close()
    with opener.open(base+'/api/evaluation/export?scope='+scope+'&format=json',timeout=30) as response:data=json.load(response)
    folder=Path(output);folder.mkdir(parents=True,exist_ok=True)
    (folder/'snapshot.json').write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,indent=2)+'\n',encoding='utf8',newline='\n')
    for name,rows in data['datasets'].items():
        fields=sorted({key for row in rows for key in row})
        with (folder/(name+'.csv')).open('w',encoding='utf-8-sig',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader()
            for row in rows:
                cells={k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in row.items()}
                cells={k:"'"+v if isinstance(v,str) and v[:1] in ['=','+','-','@','\t','\r'] else v for k,v in cells.items()};writer.writerow(cells)
    (folder/'README.txt').write_text('Naskah '+scope+' export. Participant/project/case keys are pseudonymized. Free text and source documents are excluded. Do not mix dev and research snapshots. Statistical unit: participant means across cases. Use the stats_input field in snapshot.json for analysis.\n',encoding='utf8')
    print('Exported anonymized '+scope+' snapshot and CSV files.')
