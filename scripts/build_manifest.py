#!/usr/bin/env python3
"""data/ 아래 모든 파일의 지문(sha256 앞 16자)과 크기를 data/manifest.json으로 만든다.
GitHub Actions가 배포 때마다 실행하므로 직접 돌릴 일은 없다."""
import hashlib, json, os, datetime

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data'))
OUT = os.path.join(ROOT, 'manifest.json')
files = {}
for dp, dn, fn in os.walk(ROOT):
    dn.sort()
    for name in sorted(fn):
        p = os.path.join(dp, name)
        rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
        if rel == 'manifest.json' or name.startswith('.'):
            continue
        with open(p, 'rb') as f:
            data = f.read()
        files[rel] = {'h': hashlib.sha256(data).hexdigest()[:16], 's': len(data)}

manifest = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'count': len(files), 'files': files}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
print(f'manifest: {len(files)} files, {sum(v["s"] for v in files.values())} bytes -> {OUT}')
