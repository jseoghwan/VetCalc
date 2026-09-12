/* VECC — 접근 확인 (Cloudflare Access)
   앱을 열 때 로그인 상태를 서버에 한 번 물어봅니다.
   - 인증됨(200 + email): 아무것도 표시하지 않고 확인 시각만 저장합니다.
   - 인증 끊김(명단 제외·Revoke): 화면을 덮고 로그인 버튼만 남깁니다.
   - 진짜 오프라인: 마지막 확인이 GRACE_DAYS 안이면 그대로 씁니다.

   iOS 설치형 앱에서는 확인 요청이 예외로 실패하는 경우가 있어,
   인터넷이 살아 있으면(navigator.onLine) 실패를 차단으로 봅니다.
   일시적 오류를 걸러내기 위해 한 번 재시도합니다.

   sw.js에서 /cdn-cgi/ 요청과 ?login= 주소를 가로채지 않아야 동작합니다. */
(function () {
  const ENDPOINT = '/cdn-cgi/access/get-identity';
  const KEY = 'auth:lastok';
  const GRACE_DAYS = 7;

  const base = new URL(document.currentScript ? document.currentScript.src : 'js/auth-gate.js', location.href);
  const root = new URL('../', base).href;

  const lastOk = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } };
  const markOk = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function lock(title, body, kind) {
    if (document.getElementById('ag-veil')) return;
    const v = document.createElement('div');
    v.id = 'ag-veil';
    v.setAttribute('role', 'alertdialog');
    v.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg,#F3F4F7);display:grid;place-items:center;padding:24px';
    const style = 'margin-top:18px;font:inherit;font-size:15px;font-weight:600;border:0;border-radius:10px;padding:11px 20px;cursor:pointer';
    const btn = kind === 'login'
      ? '<button id="ag-login" style="' + style + ';color:#fff;background:var(--venous,#4453A3)">로그인</button>'
      : '<button id="ag-retry" style="' + style + ';color:var(--ink,#1A1D26);background:var(--surface-2,#E9EBF1)">다시 시도</button>';
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
    const age = Date.now() - lastOk();
    if (!lastOk() || age > GRACE_DAYS * 864e5) {
      lock('접근 확인이 필요합니다',
           '인터넷에 연결한 뒤 다시 열어 주세요. 마지막 확인 후 ' + GRACE_DAYS + '일이 지났습니다.', 'retry');
    }
  }

  async function authorized(res) {
    if (!res || !res.ok) return false;
    try { const id = await res.json(); return !!(id && id.email); } catch (e) { return false; }
  }

  async function check() {
    for (let i = 0; i < 2; i++) {
      try {
        const res = await fetch(ENDPOINT, { redirect: 'manual', cache: 'no-store', credentials: 'same-origin' });
        if (await authorized(res)) { markOk(); return; }
        lockLogin();
        return;
      } catch (e) {
        if (navigator.onLine === false) { lockOffline(); return; }
        if (i === 0) await wait(1200);
      }
    }
    lockLogin();
  }

  if (location.search.indexOf('login=') === -1) check();
  else markOk();
})();
