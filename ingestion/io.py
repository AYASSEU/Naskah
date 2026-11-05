import json
import os
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]


def load_env():
    path = ROOT / 'apps/web/.env.local'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line.strip()]


def read_embedding_cache(path):
    path = Path(path)
    if not path.exists():
        return []
    lines = path.read_text(encoding='utf-8').splitlines()
    rows = []
    for index,line in enumerate(lines):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            if index != len(lines)-1:
                raise ValueError('embedding_cache_corrupted') from None
            write_jsonl(path,rows)
    return rows


def write_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def write_jsonl(path, rows):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf-8')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def retry_delay(value, attempt):
    try:
        seconds = float(value)
    except (ValueError, TypeError):
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError):
            seconds = 2 ** attempt
    return min(60, max(0, seconds))


def request(url, method='GET', body=None, headers=None, attempts=4):
    """Never echo provider response bodies/headers or follow secret-bearing redirects."""
    for attempt in range(attempts):
        try:
            req = Request(url, data=None if body is None else json.dumps(body).encode(), method=method,
                          headers={'Content-Type': 'application/json', **(headers or {})})
            with build_opener(NoRedirect).open(req, timeout=40) as response:
                raw = response.read(20 * 1024 * 1024 + 1)
                if len(raw) > 20 * 1024 * 1024:
                    raise ValueError('response_too_large')
                return json.loads(raw) if raw else None
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt + 1 < attempts:
                time.sleep(retry_delay(error.headers.get('Retry-After'), attempt))
                continue
            raise RuntimeError(f'http_{error.code}') from None
        except (URLError, TimeoutError):
            if attempt + 1 == attempts:
                raise RuntimeError('service_unreachable') from None
            time.sleep(2 ** attempt)


class Database:
    def __init__(self):
        self.url = os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/'
        key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        self.headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
        self.owner = os.environ['LOCAL_OWNER_ID']

    def call(self, path, method='GET', body=None, prefer='return=minimal'):
        return request(self.url + path, method, body, {**self.headers, 'Prefer': prefer})

    def rows(self, table, columns='*'):
        result = []
        while True:
            batch = self.call(f'{table}?owner_id=eq.{self.owner}&select={columns}&order=created_at.asc&limit=1000&offset={len(result)}')
            result.extend(batch)
            if len(batch) < 1000:
                return result
