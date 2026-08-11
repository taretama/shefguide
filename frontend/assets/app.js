// Shared helpers used by every ShefGuide page.
window.ShefGuide = (function () {
  // Local dev talks to the backend on localhost. When the frontend is
  // served remotely (e.g. a Cloudflare tunnel link sent to someone else),
  // "localhost" would resolve to THEIR machine, not this one - so it falls
  // back to this session's backend tunnel URL instead.
  const API = (function () {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return 'http://localhost:8000';
    }
    return 'https://hair-anaheim-modeling-population.trycloudflare.com';
  })();

  function getToken() { return localStorage.getItem('shefguide_token'); }
  function setToken(t) { localStorage.setItem('shefguide_token', t); }
  function clearToken() {
    localStorage.removeItem('shefguide_token');
    localStorage.removeItem('shefguide_disclosure');
  }
  function isLoggedIn() { return !!getToken(); }

  // Pulls the user id ("sub") out of the JWT payload without verifying it —
  // only used as a local storage key, never for anything security-sensitive.
  function getUserId() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sub || null;
    } catch (e) {
      return null;
    }
  }

  // Guest mode: a visitor can use the AI chat without registering. The backend
  // hands out a real (anonymous) session token, so every authenticated call
  // works exactly as it does for a registered user - the difference is a small
  // message allowance and a few account-only features.
  function isGuest() {
    const token = getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.guest === true;
    } catch (e) {
      return false;
    }
  }

  // Starts a guest session and sends the visitor on to `next`. Guests have no
  // account record to store consent against on the server, but the disclosure
  // still has to be shown before any AI call, so it is cleared here to make
  // sure a fresh visitor sees it.
  async function startGuest(next) {
    const data = await api('/auth/guest', { method: 'POST' });
    setToken(data.token);
    localStorage.removeItem('shefguide_disclosure');
    if (next) window.location.href = next;
    return data;
  }

  function authHeaders(json) {
    const h = { Authorization: 'Bearer ' + getToken() };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function buildApiError(res, data) {
    let detailMsg = 'Request failed (' + res.status + ')';
    if (data) {
      if (typeof data.detail === 'string') {
        detailMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        detailMsg = data.detail.map(d => (d && d.msg) ? d.msg : JSON.stringify(d)).join(', ');
      } else if (typeof data.detail === 'object' && data.detail !== null) {
        detailMsg = data.detail.msg || JSON.stringify(data.detail);
      } else if (typeof data.message === 'string') {
        detailMsg = data.message;
      }
    }
    const err = new Error(detailMsg);
    err.status = res.status;
    err.data = data;
    return err;
  }

  async function api(path, opts = {}, _retried = false) {
    const res = await fetch(API + path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }

    if (!res.ok) {
      if (res.status === 401 && isLoggedIn()) {
        // A guest token only lasts 6 hours and carries no password to log
        // back in with — bouncing it to the login page reads as "you need an
        // account" when the visitor never had one to begin with. Start a
        // fresh guest session instead and silently retry the request once.
        // isGuest() only decodes the payload (no signature check), so it
        // still correctly reports true for a token that just expired.
        if (isGuest() && !_retried) {
          try {
            const fresh = await fetch(API + '/auth/guest', { method: 'POST' }).then((r) => r.json());
            setToken(fresh.token);
            localStorage.removeItem('shefguide_disclosure');
            const retryOpts = { ...opts };
            if (retryOpts.headers && retryOpts.headers.Authorization) {
              retryOpts.headers = { ...retryOpts.headers, Authorization: 'Bearer ' + fresh.token };
            }
            showToast('Your guest session had expired — started a new one.', 'info');
            return api(path, retryOpts, true);
          } catch (e) {
            // Falls through to the same clear+redirect as any other 401.
          }
        }
        // Token expired or invalid — bounce back to login instead of
        // leaving the page stuck showing a raw error.
        clearToken();
        window.location.href = 'auth.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop());
      }
      throw buildApiError(res, data);
    }

    return data;
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'auth.html';
      return false;
    }
    return true;
  }

  // For pages a guest cannot use at all (the checklist needs profile details
  // they have not given). Sends them to register rather than to a dead end.
  function requireAccount(reason) {
    if (!requireAuth()) return false;
    if (isGuest()) {
      const next = window.location.pathname.split('/').pop();
      window.location.href =
        'auth.html?mode=register&next=' + encodeURIComponent(next) +
        (reason ? '&why=' + encodeURIComponent(reason) : '');
      return false;
    }
    return true;
  }

  function logout() {
    clearToken();
    window.location.href = 'index.html';
  }

  // Pages that only call requireAuth() (any signed-in state, guest included)
  // rather than requireAccount() (a full account only). A nav link to one of
  // these is meant to work for a guest — checklist.html is deliberately left
  // out, since it correctly needs a full account and should send an
  // unauthenticated visitor to registration, not a silent guest session.
  const GUEST_FRIENDLY_PATHS = new Set(['chat', 'history']);

  // Points every [data-path] nav link at the right page and shows/hides
  // sign-in-vs-signed-in header controls based on current login state.
  function wireHeader() {
    const map = {
      chat: 'chat.html',
      'community-qa': 'qa.html',
      checklist: 'checklist.html',
      history: 'history.html',
      about: 'index.html'
    };
    document.querySelectorAll('[data-path]').forEach((el) => {
      if (!map[el.dataset.path]) return;
      el.setAttribute('href', map[el.dataset.path]);

      // Without this, a first-time visitor clicking "Chat" or "History" in
      // the header has no token at all yet, and that page's own
      // requireAuth() bounces them straight to login the instant it loads —
      // even though both pages are meant to work without an account.
      if (GUEST_FRIENDLY_PATHS.has(el.dataset.path)) {
        el.addEventListener('click', async (e) => {
          if (isLoggedIn()) return; // real navigation is fine as-is
          e.preventDefault();
          try {
            await startGuest(map[el.dataset.path]);
          } catch (err) {
            showToast('Could not start guest session.', 'error');
          }
        });
      }
    });

    // Mark the link for the current page as active. Pages hard-code this for
    // their own link, but doing it here keeps every nav correct without each
    // page having to remember - and is what makes a newly added page light up.
    const here = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav[data-active-classes]').forEach((nav) => {
      const activeClasses = nav.dataset.activeClasses.split(/\s+/).filter(Boolean);
      nav.querySelectorAll('[data-path]').forEach((el) => {
        if (map[el.dataset.path] !== here) return;
        el.setAttribute('aria-current', 'page');
        activeClasses.forEach((c) => el.classList.add(c));
        // Drop the muted resting colour so the active class actually wins.
        el.classList.remove('text-on-surface-variant');
      });
    });

    // A guest session counts as signed-out for header purposes: they should
    // still be offered Sign In / Sign Up, since converting them is the point.
    const guest = isGuest();
    const logged = isLoggedIn() && !guest;
    document.querySelectorAll('[data-auth="guest-only"]').forEach((el) => {
      el.style.display = logged ? 'none' : '';
    });
    document.querySelectorAll('[data-auth="user-only"]').forEach((el) => {
      el.style.display = logged ? '' : 'none';
    });
    document.querySelectorAll('[data-auth="guest-session-only"]').forEach((el) => {
      el.style.display = guest ? '' : 'none';
    });

    document.querySelectorAll('#btn-signin, [data-action="signin"]').forEach((btn) => {
      if (btn.dataset.wired === 'true') return;
      btn.dataset.wired = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'auth.html';
      });
    });

    document.querySelectorAll('#btn-signup, [data-action="signup"]').forEach((btn) => {
      if (btn.dataset.wired === 'true') return;
      btn.dataset.wired = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'auth.html?mode=register';
      });
    });

    document.querySelectorAll('[data-role="avatar"]').forEach((avatar) => {
      // Avoid double-wiring if wireHeader() runs more than once on a page.
      if (avatar.dataset.wired === 'true') return;
      avatar.dataset.wired = 'true';

      avatar.style.cursor = 'pointer';
      avatar.style.position = 'relative';
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');

      if (!logged) {
        avatar.title = 'Sign in';
        avatar.setAttribute('aria-label', 'Sign in to ShefGuide');
        const goSignIn = () => { window.location.href = 'auth.html'; };
        avatar.addEventListener('click', goSignIn);
        avatar.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goSignIn();
          }
        });
        return;
      }

      avatar.title = 'Account';
      avatar.setAttribute('aria-haspopup', 'true');
      avatar.setAttribute('aria-expanded', 'false');
      avatar.setAttribute('aria-label', 'Account menu');

      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      menu.className =
        'absolute right-0 top-[calc(100%+10px)] w-44 p-1.5 rounded-2xl bg-black/[0.04] ring-1 ring-black/[0.08] shadow-[0_25px_60px_-20px_rgba(26,58,92,0.35)] z-[60] origin-top-right opacity-0 scale-95 pointer-events-none';
      menu.style.transition = 'opacity 200ms cubic-bezier(0.32,0.72,0,1), transform 200ms cubic-bezier(0.32,0.72,0,1)';
      menu.innerHTML =
        '<div class="bg-white rounded-[0.875rem] overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]">' +
        '<button type="button" role="menuitem" class="menu-logout w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors rounded-[0.875rem]">' +
        '<span class="material-symbols-outlined" style="font-size:18px;">logout</span>Log out' +
        '</button></div>';
      avatar.appendChild(menu);

      let open = false;
      function setOpen(next) {
        open = next;
        avatar.setAttribute('aria-expanded', String(open));
        menu.classList.toggle('opacity-0', !open);
        menu.classList.toggle('scale-95', !open);
        menu.classList.toggle('pointer-events-none', !open);
        menu.classList.toggle('opacity-100', open);
        menu.classList.toggle('scale-100', open);
      }

      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!open);
      });
      avatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(!open);
        } else if (e.key === 'Escape') {
          setOpen(false);
        }
      });
      menu.querySelector('.menu-logout').addEventListener('click', (e) => {
        e.stopPropagation();
        logout();
      });
      document.addEventListener('click', (e) => {
        if (open && !avatar.contains(e.target)) setOpen(false);
      });
    });
  }

  // Small, dismissible status message — used in place of native alert()
  // so error/info feedback stays inside the app's own visual language.
  function showToast(message, type) {
    const palette = {
      error: { bg: '#FEF2F2', text: '#B91C1C', ring: 'rgba(185,28,28,0.15)', icon: 'error' },
      info: { bg: '#EFF6FF', text: '#1D4ED8', ring: 'rgba(29,78,216,0.15)', icon: 'info' },
      success: { bg: '#ECFDF5', text: '#047857', ring: 'rgba(4,120,87,0.15)', icon: 'check_circle' }
    };
    const c = palette[type] || palette.info;

    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `position:fixed;top:24px;left:50%;
      background:${c.bg};color:${c.text};
      box-shadow:0 20px 45px -15px rgba(26,58,92,0.35), inset 0 0 0 1px ${c.ring};
      padding:14px 22px;border-radius:10px;font-family:'Public Sans',system-ui,sans-serif;
      font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;
      opacity:0;transform:translate(-50%,-16px);
      transition:opacity 400ms cubic-bezier(0.32,0.72,0,1),transform 400ms cubic-bezier(0.32,0.72,0,1);
      z-index:var(--z-toast,120);max-width:90vw;text-align:center;`;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.cssText = 'font-size:18px;font-variation-settings:"FILL" 1;';
    icon.textContent = c.icon;
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -16px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // One-time (per browser) consent modal required before any AI call —
  // mirrors the backend's require_disclosure() gate on /chat,
  // /document/ask and /posts/{id}/ai-answer.
  function ensureDisclosure() {
    return new Promise((resolve, reject) => {
      if (localStorage.getItem('shefguide_disclosure') === 'accepted') {
        resolve();
        return;
      }
      const previouslyFocused = document.activeElement;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(14,17,51,0.5);z-index:var(--z-overlay,100);display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="disclosure-title" aria-describedby="disclosure-desc" style="background:#fff;border-radius:14px;max-width:440px;width:100%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,sans-serif;">
          <h3 id="disclosure-title" style="color:#131312;font-size:18px;font-weight:700;margin:0 0 12px;">Before you continue</h3>
          <p id="disclosure-desc" style="color:#575754;font-size:14px;line-height:1.6;margin:0 0 20px;">
            ShefGuide's AI features send your message to OpenAI or Google's servers to generate a response.
            Please don't include sensitive personal data in your questions. Do you want to continue?
          </p>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button id="disclosure-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid #DCDCDA;background:#fff;color:#575754;font-size:14px;cursor:pointer;">Cancel</button>
            <button id="disclosure-accept" style="padding:10px 20px;border-radius:8px;border:none;background:#A8461A;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">I understand, continue</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const cancelBtn = overlay.querySelector('#disclosure-cancel');
      const acceptBtn = overlay.querySelector('#disclosure-accept');
      const focusable = [cancelBtn, acceptBtn];
      acceptBtn.focus();

      function close() {
        overlay.removeEventListener('keydown', trapFocus);
        overlay.remove();
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
      }

      function trapFocus(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          reject(new Error('cancelled'));
          return;
        }
        if (e.key !== 'Tab') return;
        const idx = focusable.indexOf(document.activeElement);
        e.preventDefault();
        const nextIdx = e.shiftKey
          ? (idx <= 0 ? focusable.length - 1 : idx - 1)
          : (idx === focusable.length - 1 ? 0 : idx + 1);
        focusable[nextIdx].focus();
      }
      overlay.addEventListener('keydown', trapFocus);

      cancelBtn.onclick = () => {
        close();
        reject(new Error('cancelled'));
      };
      acceptBtn.onclick = async () => {
        try {
          await api('/consent/cloud-disclosure', { method: 'POST', headers: authHeaders() });
          localStorage.setItem('shefguide_disclosure', 'accepted');
          close();
          resolve();
        } catch (e) {
          close();
          reject(e);
        }
      };
    });
  }

  // In-app replacement for window.confirm(), which renders as a browser chrome
  // dialog with no relation to the app's visual language and cannot be styled.
  // Resolves true/false rather than throwing, so callers read as a plain if.
  function confirmAction({ title, body, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const previouslyFocused = document.activeElement;
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(14,17,51,0.5);backdrop-filter:blur(2px);' +
        'z-index:var(--z-modal,110);display:flex;align-items:center;justify-content:center;padding:20px;';
      const accent = danger ? '#9B1C1C' : '#A8461A';
      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
             style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:28px 32px;
                    box-shadow:0 30px 70px -20px rgba(26,58,92,0.4);
                    font-family:'Public Sans',system-ui,sans-serif;">
          <h3 id="confirm-title" style="color:#131312;font-family:'Bricolage Grotesque','Helvetica Neue',sans-serif;font-size:19px;font-weight:700;margin:0 0 10px;">${escapeHtml(title)}</h3>
          <p id="confirm-desc" style="color:#575754;font-size:14px;line-height:1.6;margin:0 0 22px;">${escapeHtml(body)}</p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="confirm-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid #DCDCDA;background:#fff;color:#575754;font-family:'Bricolage Grotesque','Helvetica Neue',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
            <button id="confirm-ok" style="padding:10px 22px;border-radius:8px;border:none;background:${accent};color:#fff;font-family:'Bricolage Grotesque','Helvetica Neue',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const cancelBtn = overlay.querySelector('#confirm-cancel');
      const okBtn = overlay.querySelector('#confirm-ok');
      const focusable = [cancelBtn, okBtn];
      okBtn.focus();

      function close(result) {
        overlay.removeEventListener('keydown', onKey);
        overlay.remove();
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
        if (e.key !== 'Tab') return;
        const idx = focusable.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey
          ? (idx <= 0 ? focusable.length - 1 : idx - 1)
          : (idx === focusable.length - 1 ? 0 : idx + 1);
        focusable[next].focus();
      }
      overlay.addEventListener('keydown', onKey);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      cancelBtn.onclick = () => close(false);
      okBtn.onclick = () => close(true);
    });
  }

  function escapeHtml(s) {
    return (s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(isoString) {
    if (!isoString) return '';
    const then = new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z'));
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    const days = Math.floor(hours / 24);
    return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  }

  return {
    API, getToken, setToken, clearToken, isLoggedIn, getUserId, authHeaders, api,
    requireAuth, requireAccount, isGuest, startGuest, confirmAction,
    logout, wireHeader, ensureDisclosure, escapeHtml, timeAgo, showToast
  };
})();
