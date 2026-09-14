/* ═══════════════════════════════════════════════════════
   VINAY DUO — Auth Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, toast, showScreen, btnLoading } = window.VDUI;
  const Api = window.VDApi;

  let currentUser = null;

  // ─── State ───
  function getUser() { return currentUser; }
  function setUser(u) {
    currentUser = u || null;
    if (u) {
      try { localStorage.setItem('vd_user', JSON.stringify(u)); } catch {}
    } else {
      try { localStorage.removeItem('vd_user'); } catch {}
    }
  }

  function getCachedUser() {
    try {
      const raw = localStorage.getItem('vd_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ─── Tabs ───
  function initTabs() {
    $$('[data-auth-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const which = tab.dataset.authTab;
        $$('[data-auth-tab]').forEach(t => t.classList.toggle('active', t === tab));
        $('#form-login').classList.toggle('active', which === 'login');
        $('#form-signup').classList.toggle('active', which === 'signup');
        // clear errors
        $$('[data-error]').forEach(e => { e.hidden = true; e.textContent = ''; });
      });
    });
  }

  // ─── Error display ───
  function showError(form, message) {
    const el = form.querySelector('[data-error]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function clearError(form) {
    const el = form.querySelector('[data-error]');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  // ─── Login ───
  async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);

    const username = String(fd.get('username') || '').trim();
    const password = String(fd.get('password') || '');

    clearError(form);

    if (!username || !password) {
      return showError(form, 'Please fill both fields');
    }
    if (password.length < 8) {
      return showError(form, 'Password must be at least 8 characters');
    }

    btnLoading(btn, true);
    try {
      const res = await Api.login(username, password);
      if (!res?.token || !res?.user) throw new Error('Invalid response');
      Api.Token.set(res.token);
      setUser(res.user);
      toast('Welcome back, ' + (res.user.display_name || res.user.username) + '!', 'success');
      onAuthenticated();
    } catch (err) {
      showError(form, err.message || 'Login failed');
    } finally {
      btnLoading(btn, false);
    }
  }

  // ─── Signup ───
  async function handleSignup(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);

    const displayName = String(fd.get('displayName') || '').trim();
    const username = String(fd.get('username') || '').trim();
    const password = String(fd.get('password') || '');

    clearError(form);

    if (!displayName || !username || !password) {
      return showError(form, 'Please fill all fields');
    }
    if (!/^[a-zA-Z0-9_.]{3,32}$/.test(username)) {
      return showError(form, 'Username: 3-32 chars, letters/numbers/_/. only');
    }
    if (password.length < 8) {
      return showError(form, 'Password must be at least 8 characters');
    }

    btnLoading(btn, true);
    try {
      const res = await Api.register(username, displayName, password);
      if (!res?.token || !res?.user) throw new Error('Invalid response');
      Api.Token.set(res.token);
      setUser(res.user);
      toast('Welcome to VINAY DUO, ' + displayName + '!', 'success');
      onAuthenticated();
    } catch (err) {
      showError(form, err.message || 'Signup failed');
    } finally {
      btnLoading(btn, false);
    }
  }

  // ─── Logout ───
  async function logout() {
    try { await Api.logout(); } catch {}
    Api.Token.clear();
    setUser(null);
    if (window.VDSocket) window.VDSocket.disconnect();
    toast('Signed out', 'info');
    showScreen('screen-auth');
    // reset forms
    const lf = $('#form-login'); const sf = $('#form-signup');
    if (lf) lf.reset();
    if (sf) sf.reset();
  }

  // ─── After successful auth ───
  async function onAuthenticated() {
    // Fill me-data in room screen
    const user = getUser();
    if (user) {
      const nameNodes = $$('[data-me-name]');
      const avatarNodes = $$('[data-me-avatar]');
      nameNodes.forEach(n => n.textContent = user.display_name || user.username);
      avatarNodes.forEach(a => {
        a.textContent = window.VDUI.avatarInitials(user.display_name || user.username);
        a.style.background = window.VDUI.avatarColor(user.username);
      });
    }

    // Check if user already has a room
    try {
      const res = await Api.currentRoom();
      if (res?.room) {
        window.__vd_current_room = res.room;
        // Go straight to main app
        if (window.VDApp?.enterMain) {
          window.VDApp.enterMain(res.room);
        } else {
          showScreen('screen-main');
        }
        // Connect socket
        if (window.VDSocket) {
          window.VDSocket.connect();
          setTimeout(() => window.VDSocket.Actions.roomJoin(), 300);
        }
      } else {
        showScreen('screen-room');
      }
    } catch (err) {
      // Even if room check fails, go to room setup
      showScreen('screen-room');
    }
  }

  // ─── Session restore (on page load) ───
  async function tryRestore() {
    const token = Api.Token.get();
    if (!token) return false;

    try {
      const res = await Api.me();
      if (res?.user) {
        setUser(res.user);
        return true;
      }
    } catch (err) {
      // 401 was auto-cleared
      Api.Token.clear();
      setUser(null);
    }
    return false;
  }

  // ─── Init ───
  function init() {
    initTabs();
    const lf = $('#form-login');
    const sf = $('#form-signup');
    if (lf) lf.addEventListener('submit', handleLogin);
    if (sf) sf.addEventListener('submit', handleSignup);

    // Logout buttons
    $$('[data-action="logout"]').forEach(b => b.addEventListener('click', logout));

    // Cached user fast-display
    const cached = getCachedUser();
    if (cached) setUser(cached);
  }

  // Expose
  window.VDAuth = {
    init,
    tryRestore,
    getUser,
    setUser,
    logout,
    onAuthenticated
  };
})();
