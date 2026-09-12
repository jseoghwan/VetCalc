/* VECC — 접근 확인 (Cloudflare Access)
   앱을 열 때, 그리고 앱으로 돌아올 때마다 로그인 상태를 서버에 확인합니다.
   - 인증됨(200 + email): 아무것도 표시하지 않고 확인 시각만 저장합니다.
   - 인증 끊김(명단 제외·Revoke): 화면을 덮고 로그인 버튼만 남깁니다.
   - 진짜 오프라인: 마지막 확인이 GRACE_DAYS 안이면 그대로 씁니다.

   오프라인 판정은 navigator.onLine을 쓰지 않습니다(iOS 설치형에서 부정확).
   no-cors 요청이 서버에 닿는지로 직접 확인합니다.

   sw.js에서 /cdn-cgi/ 요청과 ?login= 주소를 가로채지 않아야 동작합니다. */
(function () {
  const ENDPOINT = '/cdn-cgi/access/get-identity';
  const KEY = 'auth:lastok';
  const GRACE_DAYS = 7;

  const base = new URL(document.currentScript ? document.currentScript.src : 'js/auth-gate.js', location.href);
  const root = new URL('../', base).href;

  const lastOk = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } };
  const markOk = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };

  function lock(title, body, kind) {
    if (document.getElementById('ag-veil')) return;
    const v = document.createElement('div');
    v.id = 'ag-veil';
    v.setAttribute('role', 'alertdialog');
    v.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg,#F3F4F7);display:grid;place-items:center;padding:24px';
    const s = 'margin-top:18px;font:inherit;font-size:15px;font-weight:600;border:0;border-radius:10px;padding:11px 20px;cursor:pointer';
    const btn = kind === 'login'
      ? '<button id="ag-login" style="' + s + ';color:#fff;background:var(--venous,#4453A3)">로그인</button>'
      : '<button id="ag-retry" style="' + s + ';color:var(--ink,#1A1D26);background:var(--surface-2,#E9EBF1)">다시 시도</button>';
    v.innerHTML =
      '<div style="width:min(340px,100%);text-align:center;color:var(--ink,#1A1D26)">' +
      '<p style="margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em">' + title + '</p>' +
      '<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:var(--muted,#6F7588)">' + body + '</p>' +
      btn + '</div>';
    document.body.appendChild(v);
    const a = v.querySelector('#ag-login');
    if (a) a.addEventListener('click', () => { location.href = root + '?login=1'; });
    const b = v.querySelector('#ag-retry');
    if (b) b.addEventListener('click', () => { location.reload(); });
  }

  const lockLogin = () => lock('로그인이 필요합니다',
    '이메일로 코드를 받아 다시 로그인해 주세요. 접근 권한이 해지된 경우에는 담당자에게 문의해 주세요.', 'login');

  function lockOffline() {
    const t = lastOk();
    if (!t || Date.now() - t > GRACE_DAYS * 864e5) {
      lock('접근 확인이 필요합니다',
           '인터넷에 연결한 뒤 다시 열어 주세요. 마지막 확인 후 ' + GRACE_DAYS + '일이 지났습니다.', 'retry');
    }
  }

  /* 서버에 닿기만 하면 성공하는 요청. 성공=온라인, 실패=오프라인. */
  async function online() {
    try {
      await fetch(ENDPOINT + '?probe=' + Date.now(), { mode: 'no-cors', cache: 'no-store' });
      return true;
    } catch (e) { return false; }
  }

  async function identityOk() {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return false;
      const id = await res.json();
      return !!(id && id.email);
    } catch (e) { return false; }
  }

  let running = false;
  async function check() {
    if (running || document.getElementById('ag-veil')) return;
    running = true;
    try {
      if (await identityOk()) { markOk(); return; }
      if (await online()) lockLogin();
      else lockOffline();
    } finally { running = false; }
  }

  check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('pageshow', () => check());
})();
