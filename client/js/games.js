/* ═══════════════════════════════════════════════════════
   VINAY DUO — Games Lobby Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, el, toast } = window.VDUI;
  const Api = window.VDApi;

  const state = {
    games: [],
    filter: 'all',
    loaded: false,
    loading: false
  };

  const GAME_EMOJI = {
    reaction_battle: '⚡',
    ten_second: '⏱️',
    flash_grid: '🔦',
    memory_match: '🃏',
    sequence_memory: '🔢',
    number_recall: '🔟',
    quick_math: '➗',
    odd_one_out: '🔍',
    pattern_complete: '🧩',
    emoji_memory: '😀',
    word_scramble: '🔤',
    draw_guess: '🎨',
    emoji_guess: '🤔',
    guess_word: '💭',
    describe_guess: '🗣️',
    guess_sound: '🔊',
    who_knows_who: '🤝',
    rps: '✊',
    tictactoe: '❌',
    connect_four: '🔴',
    number_battle: '🎯',
    higher_lower: '📈',
    quiz_battle: '❓',
    random_challenge: '🎲',
    friendship_quiz: '💖',
    who_more_likely: '🎭',
    this_or_that: '🔀',
    would_you_rather: '🤷',
    truth_questions: '💬'
  };

  const CAT_EMOJI = {
    speed: '⚡',
    memory: '🧠',
    word: '✍️',
    versus: '⚔️',
    social: '💬'
  };

  // ─── Load games ───
  async function load(force = false) {
    if (state.loading) return;
    if (state.loaded && !force) {
      render();
      return;
    }

    const grid = $('#games-grid');
    if (!grid) {
      console.warn('[games] #games-grid not found');
      return;
    }

    state.loading = true;
    grid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      grid.appendChild(el('div', { class: 'skeleton skeleton-card' }));
    }

    try {
      const res = await Api.listGames();
      console.log('[games] loaded:', res);

      if (!res || !res.ok || !Array.isArray(res.games)) {
        throw new Error('Invalid response');
      }

      state.games = res.games.map(g => ({
        ...g,
        emoji: GAME_EMOJI[g.key] || CAT_EMOJI[g.category] || '🎮'
      }));

      window.__vd_games_cache = state.games;
      state.loaded = true;
      state.loading = false;
      render();
    } catch (e) {
      console.error('[games] load failed', e);
      state.loading = false;
      grid.innerHTML = '';
      grid.appendChild(el('div', { class: 'empty', style: 'grid-column:1/-1;' }, [
        el('div', { class: 'empty-icon', text: '😵' }),
        el('div', { class: 'empty-title', text: 'Failed to load games' }),
        el('div', { class: 'empty-text', text: e.message || 'Please try again' }),
        el('button', {
          class: 'btn btn-ghost btn-sm',
          style: 'margin-top:10px;',
          text: 'Retry',
          onclick: () => load(true)
        })
      ]));
    }
  }

  // ─── Render games grid ───
  function render() {
    const grid = $('#games-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const filtered = state.filter === 'all'
      ? state.games
      : state.games.filter(g => g.category === state.filter);

    if (!filtered.length) {
      grid.appendChild(el('div', { class: 'empty', style: 'grid-column:1/-1;' }, [
        el('div', { class: 'empty-icon', text: '🎮' }),
        el('div', { class: 'empty-title', text: 'No games here' }),
        el('div', { class: 'empty-text', text: 'Try a different category' })
      ]));
      return;
    }

    filtered.forEach((g, i) => {
      const card = el('div', {
        class: 'game-card',
        dataset: { key: g.key },
        style: `animation-delay:${Math.min(i * 30, 400)}ms`,
        onclick: () => onGameClick(g)
      }, [
        el('div', { class: `game-card-badge badge-${g.category}`, text: g.category }),
        el('div', { class: 'game-card-emoji', text: g.emoji }),
        el('div', { class: 'game-card-title', text: g.title }),
        el('div', { class: 'game-card-cat', text: 'Tap to challenge' })
      ]);
      grid.appendChild(card);
    });
  }

  // ─── Filter chips ───
  function initFilters() {
    const chips = $$('[data-game-filters] .chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.toggle('active', c === chip));
        state.filter = chip.dataset.cat;
        render();
      });
    });
  }

  // ─── Tap on game → challenge modal ───
  async function onGameClick(game) {
    const user = window.VDAuth?.getUser();
    if (!user) return;

    const other = window.__vd_other_user;

    if (!other) {
      toast('Your duo is not in the room yet', 'info');
      return;
    }

    const body = el('div', { style: 'text-align:center;' }, [
      el('div', { style: 'font-size:64px;margin-bottom:8px;', text: game.emoji }),
      el('div', {
        style: 'font-family:var(--font-display);font-size:20px;font-weight:700;',
        text: game.title
      }),
      el('p', {
        class: 'modal-desc',
        style: 'margin-top:6px;',
        text: `Challenge ${other.display_name || other.username}?`
      })
    ]);

    window.VDUI.modal({
      title: 'Start Game',
      body,
      actions: [
        { label: 'Cancel', variant: 'btn-ghost' },
        {
          label: '⚔️ Challenge',
          variant: 'btn-primary',
          onClick: async () => {
            const res = await window.VDSocket.Actions.challengeSend(game.key);
            if (!res?.ok) {
              toast(res?.error || 'Failed to send challenge', 'error');
            }
          }
        }
      ]
    });
  }

  // ─── Realtime binding ───
  function bindRealtime() {
    if (!window.VDSocket) return;
    const S = window.VDSocket;

    S.on('game:launch', (d) => {
      if (window.VDGameUI?.start) {
        window.VDGameUI.start(d);
      }
    });

    S.on('game:session-created', (d) => {
      console.log('[games] session created', d);
    });

    S.on('game:result', () => {
      if (window.VDStats?.invalidate) window.VDStats.invalidate();
    });

    S.on('game:cancelled', () => {
      if (window.VDGameUI?.close) window.VDGameUI.close();
      toast('Game cancelled', 'info');
    });
  }

  // ─── Init ───
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    initFilters();
    bindRealtime();
    console.log('[games] initialized');
  }

  window.VDGames = {
    init,
    load,
    render,
    state
  };
})();
