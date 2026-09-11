/* VECC Calculation Tools — 데이터 자동 업데이트
   data/manifest.json(배포 때 GitHub Actions가 만드는 파일별 지문 목록)과 이 기기에 저장된 목록을 비교해서
   새로 올라오거나 바뀐 파일만 내려받아 캐시(kuvecc-data)에 넣습니다. 그 뒤로는 모든 파일이 기기에서 바로 열립니다.

   사용: DataSync.run({ prefix: 'saccm/' })  → prefix를 비우면 data/ 전체
   반환: { ok, changed:[경로], removed:[경로], failed:[경로] }  (경로는 data/ 기준, 예: 'saccm/toc.json')

   - 내려받는 동안에만 "업데이트 중" 화면을 띄웁니다. 바뀐 게 없으면 아무것도 표시하지 않습니다.
   - 받은 파일은 하나씩 즉시 저장하므로, 중간에 끊겨도 다음 접속 때 나머지만 이어서 받습니다.
   - 내려받은 내용의 지문이 목록과 다르면(배포 직후 CDN 반영 전 등) 저장하지 않고 다음 접속 때 다시 시도합니다.
   - 저장소는 sw.js의 VERSION과 별개라, 계산기 업데이트로 VERSION을 올려도 데이터를 다시 받지 않습니다. */
window.DataSync = (function () {
  const CACHE = 'kuvecc-data';
  const KEY = 'datasync:installed';
  const WORKERS = 6;

  const base = new URL(document.currentScript ? document.currentScript.src : 'js/data-sync.js', location.href);
  const DATA = new URL('../data/', base).href;              // .../VetCalc/data/
  const url = (rel) => DATA + rel.split('/').map(encodeURIComponent).join('/');

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  };

  async function sha(buf) {
    const d = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  /* ---------- 진행 화면 ---------- */
  let ui = null;
  function show() {
    if (ui) return ui;
    if (!document.getElementById('datasync-style')) {
      const st = document.createElement('style'); st.id = 'datasync-style';
      st.textContent = `
.ds-veil{position:fixed;inset:0;z-index:1000;background:var(--bg,#F3F4F7);display:grid;place-items:center;padding:24px;opacity:0}
.ds-veil.show{opacity:1}
@media (prefers-reduced-motion:no-preference){.ds-veil{transition:opacity .18s}}
.ds-box{width:min(360px,100%);text-align:center;color:var(--ink,#1A1D26)}
.ds-t{font-size:16px;font-weight:700;letter-spacing:-.01em}
.ds-s{margin-top:6px;font-size:13px;color:var(--muted,#6F7588);font-variant-numeric:tabular-nums;min-height:1.4em}
.ds-bar{margin:16px auto 0;height:6px;border-radius:999px;background:var(--surface-2,#E9EBF1);overflow:hidden}
.ds-bar i{display:block;height:100%;width:0;border-radius:999px;background:var(--accent,var(--venous,#4453A3))}
@media (prefers-reduced-motion:no-preference){.ds-bar i{transition:width .15s}}`;
      document.head.appendChild(st);
    }
    const v = document.createElement('div'); v.className = 'ds-veil'; v.setAttribute('role', 'status'); v.setAttribute('aria-live', 'polite');
    v.innerHTML = '<div class="ds-box"><p class="ds-t">업데이트 중</p><p class="ds-s"></p><div class="ds-bar"><i></i></div></div>';
    document.body.appendChild(v);
    requestAnimationFrame(() => v.classList.add('show'));
    ui = { v, s: v.querySelector('.ds-s'), b: v.querySelector('.ds-bar i') };
    return ui;
  }
  function progress(done, total, bytesDone, bytesTotal) {
    const u = show();
    u.s.textContent = `${done} / ${total}` + (bytesTotal > 300000 ? ` · ${(bytesDone / 1e6).toFixed(1)} / ${(bytesTotal / 1e6).toFixed(1)} MB` : '');
    u.b.style.width = (total ? Math.round(done / total * 100) : 100) + '%';
  }
  function hide(msg) {
    if (ui) { const v = ui.v; ui = null; v.classList.remove('show'); setTimeout(() => v.remove(), 220); }
    if (msg) toast(msg);
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'sw-toast'; t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3600);
  }

  /* ---------- 동기화 ---------- */
  let running = null;
  async function run(opt) {
    if (running) return running;
    running = sync(opt || {}).finally(() => { running = null; });
    return running;
  }

  async function sync({ prefix = '', quiet = false } = {}) {
    const result = { ok: false, changed: [], removed: [], failed: [] };
    if (!('caches' in window) || !window.isSecureContext) return result;

    let manifest;
    try {
      const r = await fetch(DATA + 'manifest.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      manifest = await r.json();
    } catch (e) { return result; }                       // 오프라인·배포 전: 조용히 저장된 것으로 계속

    const files = manifest.files || {};
    const installed = store.get();
    const cache = await caches.open(CACHE);

    const want = Object.keys(files).filter((p) => p.startsWith(prefix));
    const todo = [];
    for (const p of want) {
      if (installed[p] === files[p].h && await cache.match(url(p))) continue;   // 저장돼 있고 지문도 같음
      todo.push(p);
    }
    for (const p of Object.keys(installed)) {            // 목록에서 사라진 파일은 지움
      if (p.startsWith(prefix) && !files[p]) { await cache.delete(url(p)); delete installed[p]; result.removed.push(p); }
    }
    if (result.removed.length) store.set(installed);
    if (!todo.length) { result.ok = true; return result; }

    const total = todo.length, bytesTotal = todo.reduce((n, p) => n + (files[p].s || 0), 0);
    let done = 0, bytesDone = 0;
    if (!quiet) progress(0, total, 0, bytesTotal);

    const queue = todo.slice();
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        try {
          const r = await fetch(url(p) + '?v=' + files[p].h, { cache: 'no-cache' });
          if (!r.ok) throw new Error(r.status);
          const buf = await r.arrayBuffer();
          if (await sha(buf) !== files[p].h) throw new Error('hash');   // CDN에 이전 버전이 남아 있음 → 다음에 다시
          const type = r.headers.get('content-type') || (p.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/octet-stream');
          await cache.put(url(p), new Response(buf, { headers: { 'Content-Type': type, 'Content-Length': String(buf.byteLength) } }));
          installed[p] = files[p].h; store.set(installed);
          result.changed.push(p);
        } catch (e) { result.failed.push(p); }
        done++; bytesDone += files[p].s || 0;
        if (!quiet) progress(done, total, bytesDone, bytesTotal);
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, total) }, worker));

    result.ok = !result.failed.length;
    if (!quiet) hide(result.ok ? '' : `${result.failed.length}개 파일을 받지 못했습니다. 다음 접속 때 이어서 받습니다.`);
    return result;
  }

  return { run, toast, CACHE };
})();
