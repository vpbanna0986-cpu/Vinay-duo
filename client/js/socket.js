/* ═══════════════════════════════════════════════════════
   VINAY DUO — Socket.IO Client
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let socket = null;
  const listeners = new Map(); // event -> Set<fn>

  // ─── Event bus ───
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error('[bus]', event, e); }
    }
  }

  // ─── Connection state ───
  const state = {
    connected: false,
    authenticated: false,
    reconnecting: false,
    lastError: null
  };

  // ─── Init ───
  function connect() {
    const token = window.VDApi?.Token?.get();
    if (!token) {
      console.warn('[socket] no token, skipping connect');
      return null;
    }

    if (socket && socket.connected) return socket;

    socket = window.io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: Infinity,
      timeout: 20000
    });

    // ─── Lifecycle ───
    socket.on('connect', () => {
      state.connected = true;
      state.authenticated = true;
      state.reconnecting = false;
      state.lastError = null;
      emit('connected');
      console.log('[socket] connected', socket.id);

      // Auto-join room channel if we have one
      socket.emit('room:resync', {}, (res) => {
        if (res?.ok && res.room) emit('room:state', res.room);
      });
    });

    socket.on('disconnect', (reason) => {
      state.connected = false;
      state.authenticated = false;
      emit('disconnected', { reason });
      console.log('[socket] disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      state.connected = false;
      state.lastError = err?.message || 'connect_error';
      emit('error', { message: state.lastError });
      console.warn('[socket] connect_error:', state.lastError);
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      state.reconnecting = true;
      emit('reconnecting', { attempt });
    });

    socket.io.on('reconnect', (attempt) => {
      state.reconnecting = false;
      emit('reconnected', { attempt });
    });

    // ═══════════════════════════════════════════════════════
    //  SERVER → CLIENT EVENTS
    // ═══════════════════════════════════════════════════════

    // Presence
    socket.on('presence:update', (d) => emit('presence:update', d));
    socket.on('presence:list',   (d) => emit('presence:list', d));

    // Room
    socket.on('room:state',         (d) => emit('room:state', d));
    socket.on('room:sync',          (d) => emit('room:sync', d));
    socket.on('room:member-joined', (d) => emit('room:member-joined', d));
    socket.on('room:member-left',   (d) => emit('room:member-left', d));
    socket.on('room:activity',      (d) => emit('room:activity', d));

    // Typing
    socket.on('typing:start', (d) => emit('typing:start', d));
    socket.on('typing:stop',  (d) => emit('typing:stop', d));

    // Chat
    socket.on('chat:new',      (d) => emit('chat:new', d));
    socket.on('chat:edited',   (d) => emit('chat:edited', d));
    socket.on('chat:deleted',  (d) => emit('chat:deleted', d));
    socket.on('chat:reaction', (d) => emit('chat:reaction', d));
    socket.on('chat:seen',     (d) => emit('chat:seen', d));

    // Challenge
    socket.on('challenge:new',       (d) => emit('challenge:new', d));
    socket.on('challenge:updated',   (d) => emit('challenge:updated', d));
    socket.on('challenge:cancelled', (d) => emit('challenge:cancelled', d));

    // Game lifecycle
    socket.on('game:launch',          (d) => emit('game:launch', d));
    socket.on('game:session-created', (d) => emit('game:session-created', d));
    socket.on('game:state',           (d) => emit('game:state', d));
    socket.on('game:countdown',       (d) => emit('game:countdown', d));
    socket.on('game:playing',         (d) => emit('game:playing', d));
    socket.on('game:round-start',     (d) => emit('game:round-start', d));
    socket.on('game:score',           (d) => emit('game:score', d));
    socket.on('game:result',          (d) => emit('game:result', d));
    socket.on('game:cancelled',       (d) => emit('game:cancelled', d));

    // Per-game events — forward everything starting with 'game:'
    const gameEventPrefixes = ['game:reaction', 'game:ten', 'game:flash', 'game:memory',
      'game:sequence', 'game:numrecall', 'game:math', 'game:odd', 'game:pattern',
      'game:emojimem', 'game:scramble', 'game:emojiguess', 'game:guessword',
      'game:describe', 'game:sound', 'game:draw', 'game:wkw', 'game:rps',
      'game:ttt', 'game:c4', 'game:numbattle', 'game:hl', 'game:quiz',
      'game:rchallenge', 'game:friendquiz', 'game:likely', 'game:tot', 'game:wyr', 'game:truth'];
    // Socket.IO will emit any event we listen for. Add wildcard-ish listeners:
    // (Socket.IO v4 supports per-event 'on' — we hook the game:action callback instead)

    // Achievements
    socket.on('achievement:unlocked', (d) => emit('achievement:unlocked', d));
  }

  // ─── Send helpers ───
  function send(event, payload) {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        return resolve({ ok: false, error: 'NOT_CONNECTED' });
      }
      socket.emit(event, payload || {}, (res) => resolve(res || { ok: true }));
    });
  }

  function fire(event, payload) {
    if (!socket || !socket.connected) return;
    socket.emit(event, payload || {});
  }

  // ─── Specific emit wrappers ───
  const Actions = {
    // Room
    roomJoin:     () => send('room:join'),
    roomLeave:    () => send('room:leave'),
    roomResync:   () => send('room:resync'),
    roomActivity: (activity) => send('room:activity', { activity }),

    // Typing
    typingStart: () => fire('typing:start'),
    typingStop:  () => fire('typing:stop'),

    // Chat
    chatSend:   (payload) => send('chat:send', payload),
    chatEdit:   (payload) => send('chat:edit', payload),
    chatDelete: (payload) => send('chat:delete', payload),
    chatReact:  (payload) => send('chat:react', payload),
    chatSeen:   (payload) => send('chat:seen', payload),
    chatHistory:(payload) => send('chat:history', payload || {}),

    // Challenges
    challengeSend:    (gameKey) => send('challenge:send', { gameKey }),
    challengeRespond: (challengeId, accept) => send('challenge:respond', { challengeId, accept }),
    challengeCancel:  (challengeId) => send('challenge:cancel', { challengeId }),
    challengeCurrent: () => send('challenge:current'),

    // Games
    gameStart:  (challengeId) => send('game:start', { challengeId }),
    gameAction: (sessionId, action, payload) => send('game:action', { sessionId, action, payload }),
    gameState:  (sessionId) => send('game:state', { sessionId }),
    gameCancel: (sessionId) => send('game:cancel', { sessionId }),

    // Presence
    presenceList: () => send('presence:list')
  };

  // ─── Disconnect ───
  function disconnect() {
    if (socket) {
      try { socket.disconnect(); } catch {}
      socket = null;
    }
    state.connected = false;
    state.authenticated = false;
  }

  // ─── Expose ───
  window.VDSocket = {
    connect,
    disconnect,
    on,
    off,
    send,
    fire,
    Actions,
    state,
    get raw() { return socket; }
  };
})();
