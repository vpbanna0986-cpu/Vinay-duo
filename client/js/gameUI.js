/* ═══════════════════════════════════════════════════════
   VINAY DUO — Game UI Engine (shared for all 29 games)
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, el, toast, countdown, resultOverlay } = window.VDUI;

  const state = {
    sessionId: null,
    gameKey: null,
    gameTitle: '',
    myId: null,
    otherId: null,
    myScore: 0,
    otherScore: 0,
    active: false,
    currentGame: null,   // module for the active game
    container: null
  };

  // ─── Available game modules ───
  const registry = {};

  function register(key, module) {
    registry[key] = module;
  }

  // ─── Overlay helpers ───
  function getOverlay() {
    return $('#game-overlay');
  }

  function openOverlay() {
    const ov = getOverlay();
    if (!ov) return;
    ov.innerHTML = '';
    ov.classList.add('active');
    ov.setAttribute('aria-hidden', 'false');
  }

  function closeOverlay() {
    const ov = getOverlay();
    if (!ov) return;
    ov.classList.remove('active');
    ov.setAttribute('aria-hidden', 'true');
    setTimeout(() => { ov.innerHTML = ''; }, 300);
  }

  // ─── Header (both players scores) ───
  function renderHeader() {
    const me = window.VDAuth?.getUser();
    const other = window.__vd_other_user;
    const header = el('div', {
      class: 'game-header',
      style: 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(10,10,18,0.7);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-1);'
    }, [
      el('div', {
        class: 'game-score-side',
        style: 'display:flex;align-items:center;gap:8px;flex:1;'
      }, [
        el('div', {
          class: 'avatar avatar-xs',
          style: 'background:' + window.VDUI.avatarColor(me?.username || 'me'),
          text: window.VDUI.avatarInitials(me?.display_name || me?.username || 'You')
        }),
        el('div', {}, [
          el('div', { style: 'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: 'You' }),
          el('div', { style: 'font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text-1);line-height:1;', 'data-my-score': '', text: '0' })
        ])
      ]),
      el('div', {
        style: 'font-family:var(--font-display);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-3);text-align:center;padding:0 10px;'
      }, [
        el('div', { style: 'font-weight:700;color:var(--vd-violet-lt);margin-bottom:2px;', text: state.gameTitle || 'GAME' }),
        el('div', { text: 'VS' })
      ]),
      el('div', {
        class: 'game-score-side',
        style: 'display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end;flex-direction:row-reverse;'
      }, [
        el('div', {
          class: 'avatar avatar-xs',
          style: 'background:' + window.VDUI.avatarColor(other?.username || 'friend'),
          text: window.VDUI.avatarInitials(other?.display_name || other?.username || 'Friend')
        }),
        el('div', { style: 'text-align:right;' }, [
          el('div', { style: 'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: (other?.display_name || 'Friend').slice(0, 8) }),
          el('div', { style: 'font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text-1);line-height:1;', 'data-other-score': '', text: '0' })
        ])
      ])
    ]);
    return header;
  }

  function updateScores() {
    const my = document.querySelector('[data-my-score]');
    const other = document.querySelector('[data-other-score]');
    if (my) my.textContent = String(state.myScore);
    if (other) other.textContent = String(state.otherScore);
  }

  // ─── Body area (game module renders here) ───
  function renderBody() {
    const body = el('div', {
      class: 'game-body',
      'data-game-body': '',
      style: 'flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;'
    });
    return body;
  }

  // ─── Footer (leave button) ───
  function renderFooter() {
    return el('div', {
      style: 'padding:12px 18px;background:rgba(10,10,18,0.7);backdrop-filter:blur(20px);border-top:1px solid var(--border-1);display:flex;justify-content:center;'
    }, [
      el('button', {
        class: 'btn btn-ghost btn-sm',
        text: '✕ Leave Game',
        onclick: () => leave()
      })
    ]);
  }

  // ─── Start a game ───
  async function start(launchPayload) {
    const { sessionId, gameKey, playerAId, playerBId } = launchPayload || {};
    if (!sessionId || !gameKey) return;

    const me = window.VDAuth?.getUser();
    if (!me) return;

    state.sessionId = sessionId;
    state.gameKey = gameKey;
    state.active = true;
    state.myScore = 0;
    state.otherScore = 0;
    state.myId = me.id;

    const game = (window.__vd_games_cache || []).find(g => g.key === gameKey);
    state.gameTitle = game?.title || gameKey;

    // Determine which player I am
    if (playerAId === me.id) {
      state.otherId = playerBId;
    } else if (playerBId === me.id) {
      state.otherId = playerAId;
    } else {
      // Fallback: assume other user is the friend
      state.otherId = window.__vd_other_user?.user_id;
    }

    // Open overlay
    openOverlay();
    const ov = getOverlay();
    ov.appendChild(renderHeader());
    const body = renderBody();
    ov.appendChild(body);
    ov.appendChild(renderFooter());

    // Load the game module
    const module = registry[gameKey];
    if (!module) {
      body.appendChild(el('div', { class: 'empty', style: 'margin:auto;' }, [
        el('div', { class: 'empty-icon', text: '🚧' }),
        el('div', { class: 'empty-title', text: state.gameTitle }),
        el('div', { class: 'empty-text', text: 'UI for this game is not implemented yet. Please try another game.' })
      ]));
      return;
    }

    // Init the game module
    state.currentGame = module;
    module.mount({
      engine: getEngineAPI(),
      container: body,
      emitAction: emitAction
    });
  }

  // ─── Public API given to game modules ───
  function getEngineAPI() {
    return {
      sessionId: state.sessionId,
      myId: state.myId,
      otherId: state.otherId,
      emit: emitAction,
      setMyScore: (v) => { state.myScore = Number(v) || 0; updateScores(); },
      setOtherScore: (v) => { state.otherScore = Number(v) || 0; updateScores(); },
      addMyPoints: (v) => { state.myScore += Number(v) || 0; updateScores(); },
      addOtherPoints: (v) => { state.otherScore += Number(v) || 0; updateScores(); }
    };
  }

  function emitAction(action, payload) {
    return window.VDSocket.Actions.gameAction(state.sessionId, action, payload || {});
  }

  // ─── Finish & result ───
  function onResult(result) {
    if (!state.active) return;
    const me = window.VDAuth?.getUser();
    const other = window.__vd_other_user;
    const myId = me?.id;

    const myScore = result.playerAId === myId ? result.scoreA : result.scoreB;
    const otherScore = result.playerAId === myId ? result.scoreB : result.scoreA;

    let outcome = 'tie';
    if (result.isTie) outcome = 'tie';
    else if (result.winnerId === myId) outcome = 'win';
    else outcome = 'lose';

    // Cleanup module
    if (state.currentGame?.unmount) {
      try { state.currentGame.unmount(); } catch {}
    }

    closeOverlay();

    resultOverlay({
      outcome,
      myScore, otherScore,
      myName: me?.display_name || 'You',
      otherName: other?.display_name || 'Friend',
      emoji: outcome === 'win' ? '🏆' : outcome === 'tie' ? '🤝' : '💫',
      onRematch: () => {
        // Trigger a new challenge for the same game
        if (window.VDSocket) {
          window.VDSocket.Actions.challengeSend(result.gameKey);
        }
      },
      onExit: () => {
        state.active = false;
        state.sessionId = null;
      }
    });

    // Refresh stats
    if (window.VDStats) window.VDStats.invalidate();
  }

  // ─── Leave mid-game ───
  async function leave() {
    const ok = await window.VDUI.confirmDialog({
      title: 'Leave game?',
      desc: 'The match will be cancelled for both players.',
      confirmLabel: 'Leave',
      danger: true
    });
    if (!ok) return;

    if (state.currentGame?.unmount) {
      try { state.currentGame.unmount(); } catch {}
    }
    await window.VDSocket.Actions.gameCancel(state.sessionId);
    closeOverlay();
    state.active = false;
    state.sessionId = null;
  }

  // ─── Realtime binding ───
  function bindRealtime() {
    if (!window.VDSocket) return;
    const S = window.VDSocket;

    S.on('game:score', (d) => {
      if (!state.active) return;
      const me = window.VDAuth?.getUser();
      if (!me) return;
      const scores = d.scores || {};
      state.myScore = scores[me.id] ?? state.myScore;
      state.otherScore = scores[state.otherId] ?? state.otherScore;
      updateScores();
    });

    S.on('game:result', (r) => {
      onResult(r);
    });

    S.on('game:cancelled', () => {
      if (state.currentGame?.unmount) {
        try { state.currentGame.unmount(); } catch {}
      }
      closeOverlay();
      state.active = false;
      toast('Game cancelled', 'info');
    });

    // ─── Forward per-game events to the active module ───
    const prefixes = ['game:reaction', 'game:ten', 'game:flash', 'game:memory',
      'game:sequence', 'game:numrecall', 'game:math', 'game:odd', 'game:pattern',
      'game:emojimem', 'game:scramble', 'game:emojiguess', 'game:guessword',
      'game:describe', 'game:sound', 'game:draw', 'game:wkw', 'game:rps',
      'game:ttt', 'game:c4', 'game:numbattle', 'game:hl', 'game:quiz',
      'game:rchallenge', 'game:friendquiz', 'game:likely', 'game:tot', 'game:wyr', 'game:truth'];

    // Register a wildcard-ish listener per event. Socket.IO v4 supports arbitrary events.
    // We iterate known event names explicitly (must match server emits).
    const knownEvents = [
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

    knownEvents.forEach(evt => {
      S.on(evt, (d) => {
        if (state.currentGame?.onEvent) {
          try { state.currentGame.onEvent(evt, d); } catch (e) { console.warn('[game]', evt, e); }
        }
      });
    });

    S.on('game:launch', (d) => {
      start(d);
    });
  }

  // ─── Init ───
  function init() {
    bindRealtime();
  }

  window.VDGameUI = {
    init,
    register,
    start,
    close: closeOverlay,
    emitAction,
    state
  };
})();
