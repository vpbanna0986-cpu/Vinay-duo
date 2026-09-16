/* ═══════════════════════════════════════════════════════
   VINAY DUO — Socket.IO Client
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let socket = null;
  const listeners = new Map();

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

  const state = {
    connected: false,
    authenticated: false,
    reconnecting: false,
    lastError: null
  };

  function connect() {
    const token = window.VDApi?.Token?.get();
    if (!token) {
      console.warn('[socket] no token, skipping connect');
      return null;
    }

    if (socket && socket.connected) return socket;

    socket = window.io({
      auth: { token },
      // ✅ POLLING FIRST — more stable on Render free tier
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      randomizationFactor: 0.5,
      timeout: 45000,
      forceNew: false,
      autoConnect: true,
      closeOnBeforeunload: false
    });

    socket.on('connect', () => {
      state.connected = true;
      state.authenticated = true;
      state.reconnecting = false;
      state.lastError = null;
      emit('connected');
      console.log('[socket] connected', socket.id, 'transport:', socket.io.engine.transport.name);

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

    // ─── Server → Client events ───
    socket.on('presence:update', (d) => emit('presence:update', d));
    socket.on('presence:list',   (d) => emit('presence:list', d));

    socket.on('room:state',         (d) => emit('room:state', d));
    socket.on('room:sync',          (d) => emit('room:sync', d));
    socket.on('room:member-joined', (d) => emit('room:member-joined', d));
    socket.on('room:member-left',   (d) => emit('room:member-left', d));
    socket.on('room:activity',      (d) => emit('room:activity', d));

    socket.on('typing:start', (d) => emit('typing:start', d));
    socket.on('typing:stop',  (d) => emit('typing:stop', d));

    socket.on('chat:new',      (d) => emit('chat:new', d));
    socket.on('chat:edited',   (d) => emit('chat:edited', d));
    socket.on('chat:deleted',  (d) => emit('chat:deleted', d));
    socket.on('chat:reaction', (d) => emit('chat:reaction', d));
    socket.on('chat:seen',     (d) => emit('chat:seen', d));

    socket.on('challenge:new',       (d) => emit('challenge:new', d));
    socket.on('challenge:updated',   (d) => emit('challenge:updated', d));
    socket.on('challenge:cancelled', (d) => emit('challenge:cancelled', d));

    socket.on('game:launch',          (d) => emit('game:launch', d));
    socket.on('game:session-created', (d) => emit('game:session-created', d));
    socket.on('game:state',           (d) => emit('game:state', d));
    socket.on('game:countdown',       (d) => emit('game:countdown', d));
    socket.on('game:playing',         (d) => emit('game:playing', d));
    socket.on('game:round-start',     (d) => emit('game:round-start', d));
    socket.on('game:score',           (d) => emit('game:score', d));
    socket.on('game:result',          (d) => emit('game:result', d));
    socket.on('game:cancelled',       (d) => emit('game:cancelled', d));

    // ── Per-game events ──
    const perGameEvents = [
      'game:reaction:wait', 'game:reaction:go', 'game:reaction:tap', 'game:reaction:early',
      'game:reaction:timeout', 'game:reaction:round-result',
      'game:ten:ready', 'game:ten:started', 'game:ten:stopped',
      'game:flash:show', 'game:flash:hide', 'game:flash:result', 'game:flash:timeout',
      'game:memory:start', 'game:memory:flip',
      'game:sequence:show', 'game:sequence:hide', 'game:sequence:tap', 'game:sequence:complete', 'game:sequence:timeout',
      'game:numrecall:show', 'game:numrecall:hide', 'game:numrecall:result', 'game:numrecall:reveal', 'game:numrecall:timeout',
      'game:math:question', 'game:math:correct', 'game:math:wrong', 'game:math:round-end', 'game:math:timeout',
      'game:odd:show', 'game:odd:correct', 'game:odd:wrong', 'game:odd:round-end', 'game:odd:timeout',
      'game:pattern:show', 'game:pattern:correct', 'game:pattern:wrong', 'game:pattern:round-end', 'game:pattern:timeout',
      'game:emojimem:show', 'game:emojimem:hide', 'game:emojimem:result', 'game:emojimem:reveal', 'game:emojimem:timeout',
      'game:scramble:show', 'game:scramble:correct', 'game:scramble:wrong', 'game:scramble:round-end', 'game:scramble:timeout',
      'game:emojiguess:show', 'game:emojiguess:correct', 'game:emojiguess:wrong', 'game:emojiguess:round-end', 'game:emojiguess:timeout',
      'game:guessword:show', 'game:guessword:correct', 'game:guessword:wrong', 'game:guessword:round-end', 'game:guessword:timeout',
      'game:describe:start', 'game:describe:your-word', 'game:describe:guesser-turn', 'game:describe:correct', 'game:describe:wrong', 'game:describe:skipped', 'game:describe:timeout',
      'game:sound:play', 'game:sound:correct', 'game:sound:wrong', 'game:sound:round-end', 'game:sound:timeout',
      'game:draw:start', 'game:draw:your-word', 'game:draw:stroke', 'game:draw:clear', 'game:draw:correct', 'game:draw:wrong', 'game:draw:timeout',
      'game:wkw:start', 'game:wkw:subject-ready', 'game:wkw:guesser-ready', 'game:wkw:subject-locked', 'game:wkw:guesser-locked', 'game:wkw:result',
      'game:rps:start', 'game:rps:opponent-picked', 'game:rps:result',
      'game:ttt:start', 'game:ttt:move', 'game:ttt:win', 'game:ttt:tie', 'game:ttt:timeout',
      'game:c4:start', 'game:c4:drop', 'game:c4:win', 'game:c4:tie', 'game:c4:timeout',
      'game:numbattle:start', 'game:numbattle:feedback', 'game:numbattle:opponent-guessed', 'game:numbattle:correct', 'game:numbattle:round-end', 'game:numbattle:timeout',
      'game:hl:start', 'game:hl:result',
      'game:quiz:question', 'game:quiz:your-answer', 'game:quiz:result',
      'game:rchallenge:start', 'game:rchallenge:marked-done', 'game:rchallenge:result', 'game:rchallenge:timeout',
      'game:friendquiz:start', 'game:friendquiz:locked', 'game:friendquiz:self-reveal', 'game:friendquiz:result',
      'game:likely:start', 'game:likely:locked', 'game:likely:result',
      'game:tot:start', 'game:tot:locked', 'game:tot:result',
      'game:wyr:start', 'game:wyr:locked', 'game:wyr:result',
      'game:truth:start', 'game:truth:locked', 'game:truth:result'
    ];

    perGameEvents.forEach(evt => {
      socket.on(evt, (d) => emit(evt, d));
    });

    socket.on('achievement:unlocked', (d) => emit('achievement:unlocked', d));
  }

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

  const Actions = {
    roomJoin:     () => send('room:join'),
    roomLeave:    () => send('room:leave'),
    roomResync:   () => send('room:resync'),
    roomActivity: (activity) => send('room:activity', { activity }),

    typingStart: () => fire('typing:start'),
    typingStop:  () => fire('typing:stop'),

    chatSend:   (payload) => send('chat:send', payload),
    chatEdit:   (payload) => send('chat:edit', payload),
    chatDelete: (payload) => send('chat:delete', payload),
    chatReact:  (payload) => send('chat:react', payload),
    chatSeen:   (payload) => send('chat:seen', payload),
    chatHistory:(payload) => send('chat:history', payload || {}),

    challengeSend:    (gameKey) => send('challenge:send', { gameKey }),
    challengeRespond: (challengeId, accept) => send('challenge:respond', { challengeId, accept }),
    challengeCancel:  (challengeId) => send('challenge:cancel', { challengeId }),
    challengeCurrent: () => send('challenge:current'),

    gameStart:  (challengeId) => send('game:start', { challengeId }),
    gameAction: (sessionId, action, payload) => send('game:action', { sessionId, action, payload }),
    gameState:  (sessionId) => send('game:state', { sessionId }),
    gameCancel: (sessionId) => send('game:cancel', { sessionId }),

    presenceList: () => send('presence:list')
  };

  function disconnect() {
    if (socket) {
      try { socket.disconnect(); } catch {}
      socket = null;
    }
    state.connected = false;
    state.authenticated = false;
  }

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
