// Shared helpers used by every ShefGuide page.
window.ShefGuide = (function () {
  const API = 'http://localhost:8000';

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

  function authHeaders(json) {
    const h = { Authorization: 'Bearer ' + getToken() };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async function api(path, opts = {}) {
    const res = await fetch(API + path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      if (res.status === 401 && isLoggedIn()) {
        // Token expired or invalid — bounce back to login instead of
        // leaving the page stuck showing a raw error.
        clearToken();
        window.location.href = 'auth.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop());
      }
      const err = new Error((data && (data.detail || data.message)) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      err.data = data;
      throw err;
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

  function logout() {
    clearToken();
    window.location.href = 'index.html';
  }

  // Points every [data-path] nav link at the right page and shows/hides
  // sign-in-vs-signed-in header controls based on current login state.
  function wireHeader() {
    const map = {
      chat: 'chat.html',
      'community-qa': 'qa.html',
      checklist: 'checklist.html',
      about: 'index.html'
    };
    document.querySelectorAll('[data-path]').forEach((el) => {
      if (map[el.dataset.path]) el.setAttribute('href', map[el.dataset.path]);
    });

    const logged = isLoggedIn();
    document.querySelectorAll('[data-auth="guest-only"]').forEach((el) => {
      el.style.display = logged ? 'none' : '';
    });
    document.querySelectorAll('[data-auth="user-only"]').forEach((el) => {
      el.style.display = logged ? '' : 'none';
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
      padding:14px 22px;border-radius:9999px;font-family:'Outfit','Plus Jakarta Sans',sans-serif;
      font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;
      opacity:0;transform:translate(-50%,-16px);
      transition:opacity 400ms cubic-bezier(0.32,0.72,0,1),transform 400ms cubic-bezier(0.32,0.72,0,1);
      z-index:10000;max-width:90vw;text-align:center;`;

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
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(14,17,51,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="disclosure-title" aria-describedby="disclosure-desc" style="background:#fff;border-radius:24px;max-width:440px;width:100%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,sans-serif;">
          <h3 id="disclosure-title" style="color:#1A3A5C;font-size:18px;font-weight:700;margin:0 0 12px;">Before you continue</h3>
          <p id="disclosure-desc" style="color:#43474e;font-size:14px;line-height:1.6;margin:0 0 20px;">
            ShefGuide's AI features send your message to OpenAI or Google's servers to generate a response.
            Please don't include sensitive personal data in your questions. Do you want to continue?
          </p>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button id="disclosure-cancel" style="padding:10px 20px;border-radius:999px;border:1px solid #c3c6cf;background:#fff;color:#43474e;font-size:14px;cursor:pointer;">Cancel</button>
            <button id="disclosure-accept" style="padding:10px 20px;border-radius:999px;border:none;background:#148F77;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">I understand, continue</button>
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
    requireAuth, logout, wireHeader, ensureDisclosure, escapeHtml, timeAgo, showToast
  };
})();
