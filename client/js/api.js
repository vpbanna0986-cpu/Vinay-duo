/* ═══════════════════════════════════════════════════════
   VINAY DUO — API Client
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const BASE = '/api';
  const TOKEN_KEY = 'vd_token';

  // ─── Token management ───
  const Token = {
    get() {
      try { return localStorage.getItem(TOKEN_KEY) || null; }
      catch { return null; }
    },
    set(token) {
      try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    },
    clear() {
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
    }
  };

  // ─── Custom error ───
  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  // ─── Core request ───
  async function request(path, options = {}) {
    const { method = 'GET', body, auth = true, timeout = 20000 } = options;

    const headers = {
      'Accept': 'application/json'
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (auth) {
      const token = Token.get();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        throw new ApiError('Request timed out', 0, 'TIMEOUT');
      }
      throw new ApiError('Network error — check your connection', 0, 'NETWORK');
    }
    clearTimeout(timer);

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { data = await res.json(); } catch {}
    }

    if (!res.ok) {
      const code = (data && data.error) || 'HTTP_' + res.status;
      const message = (data && data.message) || code || 'Request failed';

      // Auto-clear token on 401
      if (res.status === 401) Token.clear();

      throw new ApiError(message, res.status, code, data && data.details);
    }

    return data || { ok: true };
  }

  // ─── Convenience methods ───
  const get    = (p, opts)       => request(p, { ...opts, method: 'GET' });
  const post   = (p, body, opts) => request(p, { ...opts, method: 'POST', body });
  const put    = (p, body, opts) => request(p, { ...opts, method: 'PUT', body });
  const del    = (p, opts)       => request(p, { ...opts, method: 'DELETE' });

  // ─── Endpoints ───
  const API = {
    Token,
    ApiError,

    // Health
    health: () => get('/health', { auth: false }),

    // Auth
    register: (username, displayName, password) =>
      post('/auth/register', { username, displayName, password }, { auth: false }),

    login: (username, password) =>
      post('/auth/login', { username, password }, { auth: false }),

    logout: () => post('/auth/logout', {}, { auth: true }),

    me: () => get('/auth/me'),

    // Users
    myFullProfile: () => get('/users/me/full'),

    userProfile: (id) => get('/users/' + id),

    // Rooms
    createRoom: () => post('/rooms', {}),

    joinRoom: (code) => post('/rooms/join', { code }),

    currentRoom: () => get('/rooms/current'),

    leaveRoom: () => post('/rooms/leave', {}),

    // Chat
    chatHistory: (limit = 100) => get('/chat/history?limit=' + limit),

    // Challenges
    currentChallenge: () => get('/challenges/current'),

    createChallenge: (gameKey) => post('/challenges/create', { gameKey }),

    respondChallenge: (challengeId, accept) =>
      post('/challenges/respond', { challengeId, accept }),

    // Games
    listGames: () => get('/games/list'),

    recentResults: (limit = 20) => get('/games/results?limit=' + limit),

    // Notes (if backend route exists — falls back gracefully)
    // We'll implement via sockets later; placeholder:
    // listNotes: () => get('/notes/list'),
  };

  // Expose
  window.VDApi = API;
})();
