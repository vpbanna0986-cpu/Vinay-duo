/* ═══════════════════════════════════════════════════════
   VINAY DUO — Game UI Engine (Final)
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, el, toast, resultOverlay } = window.VDUI;

  const state = {
    sessionId: null,
    gameKey: null,
    gameTitle: '',
    myId: null,
    otherId: null,
    myScore: 0,
    otherScore: 0,
    active: false,
    currentGame: null
  };

  const registry = {};

  function register(key, module) { registry[key] = module; }
  function getOverlay() { return $('#game-overlay'); }

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

  function renderHeader() {
    const me = window.VDAuth?.getUser();
    const other = window.__vd_other_user;
    return el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(10,10,18,0.7);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-1);flex-shrink:0;'
    }, [
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;' }, [
        el('div', {
          class: 'avatar avatar-xs',
          style: 'background:' + window.VDUI.avatarColor(me?.username || 'me'),
          text: window.VDUI.avatarInitials(me?.display_name || me?.username || 'You')
        }),
        el('div', { style: 'min-width:0;' }, [
          el('div', { style: 'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: 'You' }),
          el('div', { style: 'font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text-1);line-height:1;', 'data-my-score': '', text: '0' })
        ])
      ]),
      el('div', { style: 'font-family:var(--font-display);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-3);text-align:center;padding:0 10px;flex-shrink:0;' }, [
        el('div', { style: 'font-weight:700;color:var(--vd-violet-lt);margin-bottom:2px;', text: state.gameTitle || 'GAME' }),
        el('div', { text: 'VS' })
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end;flex-direction:row-reverse;min-width:0;' }, [
        el('div', {
          class: 'avatar avatar-xs',
          style: 'background:' + window.VDUI.avatarColor(other?.username || 'friend'),
          text: window.VDUI.avatarInitials(other?.display_name || other?.username || 'Friend')
        }),
        el('div', { style: 'text-align:right;min-width:0;' }, [
          el('div', { style: 'font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;', text: (other?.display_name || 'Friend').slice(0, 8) }),
          el('div', { style: 'font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text-1);line-height:1;', 'data-other-score': '', text: '0' })
        ])
      ])
    ]);
  }

  function updateScores() {
    const my = document.querySelector('[data-my-score]');
    const other = document.querySelector('[data-other-score]');
    if (my) my.textContent = String(state.myScore);
    if (other) other.textContent = String(state.otherScore);
  }

  function renderBody() {
    return el('div', {
      'data-game-body': '',
      style: 'flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;min-height:0;'
    });
  }

  function renderFooter() {
    return el('div', {
      style: 'padding:12px 18px;background:rgba(10,10,18,0.7);backdrop-filter:blur(20px);border-top:1px solid var(--border-1);display:flex;justify-content:center;flex-shrink:0;'
    }, [
      el('button', {
        class: 'btn btn-ghost btn-sm',
        text: '✕ Leave Game',
        onclick: () => leave()
      })
    ]);
  }

  async function start(launchPayload) {
    const { sessionId, gameKey, playerAId, playerBId } = launchPayload || {};
    if (!sessionId || !gameKey) return;

    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) { modalRoot.classList.remove('active'); modalRoot.innerHTML = ''; }

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

    if (playerAId === me.id) state.otherId = playerBId;
    else if (playerBId === me.id) state.otherId = playerAId;
    else state.otherId = window.__vd_other_user?.user_id;

    openOverlay();
    const ov = getOverlay();
    if (!ov) return;

    ov.appendChild(renderHeader());
    const body = renderBody();
    ov.appendChild(body);
    ov.appendChild(renderFooter());

    const module = registry[gameKey];
    if (!module) {
      body.appendChild(el('div', { class: 'empty', style: 'margin:auto;' }, [
        el('div', { class: 'empty-icon', text: '🚧' }),
        el('div', { class: 'empty-title', text: state.gameTitle }),
        el('div', { class: 'empty-text', text: 'UI coming soon.' })
      ]));
      return;
    }

    state.currentGame = module;
    try {
      module.mount({ engine: getEngineAPI(), container: body, emitAction: emitAction });
    } catch (e) { console.error('[gameUI] mount failed', e); }
  }

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

  // ✅ RELIABLE — HTTP POST for critical actions
  function emitAction(action, payload) {
    if (!state.sessionId) return Promise.resolve({ ok: false, error: 'NO_SESSION' });

    const token = window.VDApi?.Token?.get() || '';
    const url = '/api/games/action';

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      credentials: 'include',
      body: JSON.stringify({
        sessionId: state.sessionId,
        action,
        payload: payload || {}
      })
    })
    .then(r => r.json())
    .catch(e => {
      console.warn('[gameUI] action failed:', e);
      return { ok: false, error: 'NETWORK' };
    });
  }

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
        // ✅ Reset state first
        state.active = false;
        state.sessionId = null;
        state.currentGame = null;

        // ✅ Send new challenge after small delay
        setTimeout(() => {
          if (window.VDSocket?.Actions?.challengeSend) {
            window.VDSocket.Actions.challengeSend(result.gameKey).then(res => {
              if (!res?.ok) toast(res?.error || 'Rematch failed', 'error');
              else toast('Rematch sent!', 'success');
            });
          }
        }, 300);
      },
      onExit: () => {
        state.active = false;
        state.sessionId = null;
        state.currentGame = null;
      }
    });

    if (window.VDStats) window.VDStats.invalidate();
  }

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
    try { await window.VDSocket.Actions.gameCancel(state.sessionId); } catch {}
    closeOverlay();
    state.active = false;
    state.sessionId = null;
    state.currentGame = null;
  }

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

    S.on('game:result', (r) => onResult(r));

    S.on('game:cancelled', () => {
      if (state.currentGame?.unmount) {
        try { state.currentGame.unmount(); } catch {}
      }
      closeOverlay();
      state.active = false;
      state.currentGame = null;
      toast('Game cancelled', 'info');
    });

    const knownEvents = [
      'game:reaction:wait','game:reaction:go','game:reaction:tap','game:reaction:early','game:reaction:round-result',
      'game:ten:ready','game:ten:started','game:ten:stopped',
      'game:flash:show','game:flash:hide','game:flash:result','game:flash:timeout',
      'game:memory:start','game:memory:flip',
      'game:sequence:show','game:sequence:hide','game:sequence:tap','game:sequence:complete','game:sequence:timeout',
      'game:numrecall:show','game:numrecall:hide','game:numrecall:result','game:numrecall:reveal','game:numrecall:timeout',
      'game:math:question','game:math:correct','game:math:wrong','game:math:round-end','game:math:timeout',
      'game:odd:show','game:odd:correct','game:odd:wrong','game:odd:round-end','game:odd:timeout',
      'game:pattern:show','game:pattern:correct','game:pattern:wrong','game:pattern:round-end','game:pattern:timeout',
      'game:emojimem:show','game:emojimem:hide','game:emojimem:result','game:emojimem:reveal','game:emojimem:timeout',
      'game:scramble:show','game:scramble:correct','game:scramble:wrong','game:scramble:round-end','game:scramble:timeout',
      'game:emojiguess:show','game:emojiguess:correct','game:emojiguess:wrong','game:emojiguess:round-end','game:emojiguess:timeout',
      'game:guessword:show','game:guessword:correct','game:guessword:wrong','game:guessword:round-end','game:guessword:timeout',
      'game:describe:start','game:describe:your-word','game:describe:guesser-turn','game:describe:correct','game:describe:wrong','game:describe:skipped','game:describe:timeout',
      'game:sound:play','game:sound:correct','game:sound:wrong','game:sound:round-end','game:sound:timeout',
      'game:draw:start','game:draw:your-word','game:draw:stroke','game:draw:clear','game:draw:correct','game:draw:wrong','game:draw:timeout',
      'game:wkw:start','game:wkw:subject-ready','game:wkw:guesser-ready','game:wkw:subject-locked','game:wkw:guesser-locked','game:wkw:result',
      'game:rps:start','game:rps:opponent-picked','game:rps:result',
      'game:ttt:start','game:ttt:move','game:ttt:win','game:ttt:tie','game:ttt:timeout',
      'game:c4:start','game:c4:drop','game:c4:win','game:c4:tie','game:c4:timeout',
      'game:numbattle:start','game:numbattle:feedback','game:numbattle:opponent-guessed','game:numbattle:correct','game:numbattle:round-end','game:numbattle:timeout',
      'game:hl:start','game:hl:result',
      'game:quiz:question','game:quiz:your-answer','game:quiz:result',
      'game:rchallenge:start','game:rchallenge:marked-done','game:rchallenge:result','game:rchallenge:timeout',
      'game:friendquiz:start','game:friendquiz:locked','game:friendquiz:self-reveal','game:friendquiz:result',
      'game:likely:start','game:likely:locked','game:likely:result',
      'game:tot:start','game:tot:locked','game:tot:result',
      'game:wyr:start','game:wyr:locked','game:wyr:result',
      'game:truth:start','game:truth:locked','game:truth:result'
    ];

    knownEvents.forEach(evt => {
      S.on(evt, (d) => {
        if (state.currentGame?.onEvent) {
          try { state.currentGame.onEvent(evt, d); } catch (e) { console.warn('[game]', evt, e); }
        }
      });
    });
  }

  function init() { bindRealtime(); }

  window.VDGameUI = { init, register, start, close: closeOverlay, emitAction, state };
})();
