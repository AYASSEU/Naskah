import hmac,json,os,subprocess,sys,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from importlib.metadata import version
token=os.environ.get('EVALUATION_SERVICE_TOKEN','')
if len(token)<32:raise RuntimeError('evaluation token missing')
slots=threading.BoundedSemaphore(2)
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send_json(self,status,data):
        content=json.dumps(data,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store');self.end_headers()
        try:self.wfile.write(content)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        if self.path!='/health':return self.send_json(404,{'error':'not_found'})
        self.send_json(200,{'ok':True,'engine':os.environ.get('EVALUATION_ID','b8.1'),'scipy':version('scipy'),'numpy':version('numpy'),'rouge_score':version('rouge-score')})
    def do_POST(self):
        self.connection.settimeout(15)
        if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):return self.send_json(401,{'error':'unauthorized'})
        if self.path!='/evaluate':return self.send_json(404,{'error':'not_found'})
        if not slots.acquire(blocking=False):return self.send_json(503,{'error':'evaluation_busy'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=2*1024*1024:return self.send_json(413,{'error':'evaluation_too_large'})
            payload=self.rfile.read(length)
            if len(payload)!=length:return self.send_json(400,{'error':'invalid_input'})
            result=subprocess.run([sys.executable,'-m','evaluation_scripts','worker'],input=payload,capture_output=True,timeout=45)
            if len(result.stdout)>4*1024*1024:return self.send_json(413,{'error':'evaluation_too_large'})
            try:output=json.loads(result.stdout)
            except ValueError:return self.send_json(500,{'error':'evaluation_failed'})
            self.send_json(200 if result.returncode==0 else 422,output)
        except subprocess.TimeoutExpired:self.send_json(504,{'error':'evaluation_timeout'})
        except (ValueError,TimeoutError,OSError):self.send_json(400,{'error':'invalid_input'})
        finally:slots.release()
ThreadingHTTPServer(('0.0.0.0',8010),Handler).serve_forever()
