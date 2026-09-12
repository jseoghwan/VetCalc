/* VECC — 접근 확인 (Cloudflare Access)
   앱을 열 때 로그인 상태를 서버에 한 번 물어봅니다.
   - 인증됨: 아무것도 표시하지 않고 확인 시각만 저장합니다.
   - 인증 끊김(명단에서 제외·Revoke): 화면을 덮고 로그인 버튼만 남깁니다.
   - 오프라인: 마지막 확인이 GRACE_DAYS 안이면 그대로 씁니다. 그보다 오래되면 잠급니다.

   Access는 서비스워커보다 앞에 있어서, 캐시된 화면은 인증이 끊겨도 열립니다.
   이 파일이 그 구멍을 막습니다. sw.js에서 /cdn-cgi/ 요청과 ?login= 주소를
   가로채지 않도록 예외를 둬야 정상 동작합니다. */
(function () {
  const ENDPOINT = '/cdn-cgi/access/get-identity';
  const KEY = 'auth:lastok';
  const GRACE_DAYS = 7;

  const base = new URL(document.currentScript ? document.currentScript.src : 'js/auth-gate.js', location.href);
  const root = new URL('../', base).href;               // 앱 최상위 주소

  const lastOk = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } };
  const markOk = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };

  function lock(title, body, withButton) {
    const v = document.createElement('div');
    v.setAttribute('role', 'alertdialog');
    v.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg,#F3F4F7);display:grid;place-items:center;padding:24px';
    const btn = withButton
      ? '<button id="ag-login" style="margin-top:18px;font:inherit;font-size:15px;font-weight:600;color:#fff;background:var(--venous,#4453A3);border:0;border-radius:10px;padding:11px 20px;cursor:pointer">로그인</button>'
      : '';
    v.innerHTML =
      '<div style="width:min(340px,100%);text-align:center;color:var(--ink,#1A1D26)">' +
      '<p style="margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em">' + title + '</p>' +
      '<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:var(--muted,#6F7588)">' + body + '</p>' +
      btn + '</div>';
    document.body.appendChild(v);
    const b = v.querySelector('#ag-login');
    if (b) b.addEventListener('click', () => { location.href = root + '?login=1'; });
  }

  async function check() {
    let res;
    try {
      res = await fetch(ENDPOINT, { redirect: 'manual', cache: 'no-store', credentials: 'same-origin' });
    } catch (e) {
      // 네트워크 자체가 안 됨 → 오프라인으로 간주
      const age = Date.now() - lastOk();
      if (!lastOk() || age > GRACE_DAYS * 864e5) {
        lock('접근 확인이 필요합니다',
             '인터넷에 연결한 뒤 다시 열어 주세요. 마지막 확인 후 ' + GRACE_DAYS + '일이 지났습니다.', false);
      }
      return;
    }
    if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
      lock('로그인이 필요합니다',
           '이메일로 코드를 받아 다시 로그인해 주세요. 접근 권한이 해지된 경우에는 담당자에게 문의해 주세요.', true);
      return;
    }
    if (res.ok) { markOk(); return; }
    // 그 밖의 응답(일시적 오류 등)은 막지 않습니다.
  }

  if (location.search.indexOf('login=') === -1) check();
  else markOk();
})();
