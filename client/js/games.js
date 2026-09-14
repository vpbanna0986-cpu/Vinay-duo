/* ═══════════════════════════════════════════════════════
   VINAY DUO — Games Module
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
    activeSession: null
  };

  // Category emojis for cards
  const CAT_EMOJI = {
    speed:   '⚡',
    memory:  '🧠',
    word:    '✍️',
    versus:  '⚔️',
    social:  '💬'
  };

  // Choose an emoji per game key (first 2 chars of name won't look nice for all)
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

  // ─── Load games from API ───
  async function load(force = false) {
    if (state.loaded && !force) return;
    const grid = $('#games-grid');
    if (!grid) return;

    grid.innerHTML = '';
    // Skeleton
    for (let i = 0; i < 6; i++) {
      grid.appendChild(el('div', { class: 'skeleton skeleton-card' }));
    }

    try {
      const res = await Api.listGames();
      state.games = (res?.games || []).map(g => ({
        ...g,
        emoji: GAME_EMOJI[g.key] || CAT_EMOJI[g.category] || '🎮'
      }));
      window.__vd_games_cache = state.games;
      state.loaded = true;
      render();
    } catch (e) {
      grid.innerHTML = '';
      grid.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-icon', text: '😵' }),
        el('div', { class: 'empty-title', text: 'Failed to load games' }),
        el('div', { class: 'empty-text', text: e.message || 'Please try again' })
      ]));
    }
  }

  // ─── Render grid ───
  function render() {
    const grid = $('#games-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = state.filter === 'all'
      ? state.games
      : state.games.filter(g => g.category === state.filter);

    if (!filtered.length) {
      grid.appendChild(el('div', { class: 'empty' }, [
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
        style: `animation-delay:${i * 40}ms`,
        onclick: () => onGameClick(g)
      }, [
        el('div', { class: `game-card-badge badge-${g.category}`, text: g.category }),
        el('div', { class: 'game-card-emoji', text: g.emoji }),
        el('div', { class: 'game-card-title', text: g.title }),
        el('div', { class: 'game-card-cat', text: 'Play together' })
      ]);
      grid.appendChild(card);
    });
  }

  // ─── Filter chips ───
  function initFilters() {
    $$('[data-game-filters] .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('[data-game-filters] .chip').forEach(c => c.classList.toggle('active', c === chip));
        state.filter = chip.dataset.cat;
        render();
      });
    });
  }

  // ─── Game click → challenge ───
  async function onGameClick(game) {
    const user = window.VDAuth?.getUser();
    const other = window.__vd_other_user;

    if (!other) {
      return toast('Your duo is not in the room yet', 'info');
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

  // ─── Bind realtime ───
  function bindRealtime() {
    if (!window.VDSocket) return;
    const S = window.VDSocket;

    S.on('game:launch', (d) => {
      // Auto-start game (both accept + server says launch)
      if (window.VDGameUI?.start) {
        window.VDGameUI.start(d);
      }
    });

    S.on('game:session-created', (d) => {
      state.activeSession = d.sessionId;
    });

    S.on('game:result', (d) => {
      // Result overlay handled by game UI; also refresh stats
      if (window.VDStats?.invalidate) window.VDStats.invalidate();
    });

    S.on('game:cancelled', () => {
      if (window.VDGameUI?.close) window.VDGameUI.close();
      toast('Game cancelled', 'info');
    });

    S.on('challenge:updated', (ch) => {
      if (ch.status === 'accepted') {
        // Server will emit game:launch soon; also auto-start here for redundancy
        // (server is authoritative — emit alone is enough)
      }
    });
  }

  function init() {
    initFilters();
    bindRealtime();
  }

  window.VDGames = {
    init,
    load,
    render
  };
})();
