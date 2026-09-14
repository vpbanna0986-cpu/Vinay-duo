/* ═══════════════════════════════════════════════════════
   VINAY DUO — Stats Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, el, escape, toast } = window.VDUI;
  const Api = window.VDApi;

  const state = {
    data: null,
    stale: true
  };

  async function load(force = false) {
    if (!state.stale && !force) return;
    const wrap = $('#stats-wrap');
    if (!wrap) return;

    // Skeleton
    wrap.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      wrap.appendChild(el('div', { class: 'skeleton', style: 'height:70px;border-radius:14px;' }));
    }

    try {
      const res = await Api.myFullProfile();
      state.data = res;
      state.stale = false;
      render();
    } catch (e) {
      wrap.innerHTML = '';
      wrap.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-icon', text: '📊' }),
        el('div', { class: 'empty-title', text: 'Failed to load stats' }),
        el('div', { class: 'empty-text', text: e.message || 'Please try again' })
      ]));
    }
  }

  function render() {
    const wrap = $('#stats-wrap');
    if (!wrap || !state.data) return;
    wrap.innerHTML = '';

    const { user, stats, achievements, history } = state.data;

    // ─── XP Card ───
    const xpValue = user?.xp || 0;
    const level = user?.level || 1;
    const xpInLevel = xpValue % 500;
    const xpProgress = (xpInLevel / 500) * 100;

    wrap.appendChild(el('div', { class: 'card', style: 'padding:22px;' }, [
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;' }, [
        el('div', {}, [
          el('div', { style: 'font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: 'Level' }),
          el('div', { style: 'font-family:var(--font-display);font-size:32px;font-weight:800;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;margin-top:2px;', text: String(level) })
        ]),
        el('div', { style: 'text-align:right;' }, [
          el('div', { style: 'font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: 'Total XP' }),
          el('div', { style: 'font-family:var(--font-display);font-size:26px;font-weight:700;color:var(--text-1);line-height:1;margin-top:2px;', text: String(xpValue) })
        ])
      ]),
      el('div', { class: 'xp-bar', style: 'margin-top:4px;' }, [
        el('div', { class: 'xp-fill', style: `width:${xpProgress}%;` })
      ]),
      el('div', { style: 'font-size:11px;color:var(--text-4);margin-top:8px;text-align:right;', text: `${xpInLevel} / 500 XP to next level` })
    ]));

    // ─── Stats Grid ───
    if (stats) {
      const grid = el('div', { class: 'stat-grid' }, [
        statCard('Games', stats.games_played || 0),
        statCard('Wins', stats.wins || 0),
        statCard('Losses', stats.losses || 0),
        statCard('Ties', stats.ties || 0),
        statCard('Streak', stats.current_streak || 0),
        statCard('Best Streak', stats.best_streak || 0)
      ]);
      wrap.appendChild(el('div', {}, [
        el('h3', { style: 'font-size:16px;margin:8px 0 10px;color:var(--text-2);', text: 'Your Stats' }),
        grid
      ]));
    }

    // ─── Personal Bests ───
    if (stats && (stats.best_reaction_ms || stats.best_memory_score)) {
      wrap.appendChild(el('div', { class: 'card' }, [
        el('h3', { style: 'font-size:15px;margin-bottom:10px;color:var(--text-2);', text: '🏅 Personal Bests' }),
        stats.best_reaction_ms && el('div', { style: 'font-size:13px;color:var(--text-3);', text: `⚡ Best reaction: ${stats.best_reaction_ms} ms` }),
        stats.best_memory_score && el('div', { style: 'font-size:13px;color:var(--text-3);margin-top:4px;', text: `🧠 Best memory: ${stats.best_memory_score}` })
      ].filter(Boolean)));
    }

    // ─── Achievements ───
    if (achievements && achievements.length) {
      const achWrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px;' });
      achievements.slice(0, 8).forEach((a, i) => {
        achWrap.appendChild(el('div', { class: 'achievement', style: `animation-delay:${i * 60}ms;` }, [
          el('div', { class: 'achievement-icon', text: a.icon || '🏆' }),
          el('div', {}, [
            el('div', { class: 'achievement-title', text: a.title }),
            el('div', { class: 'achievement-desc', text: a.description })
          ])
        ]));
      });
      wrap.appendChild(el('div', {}, [
        el('h3', { style: 'font-size:16px;margin:8px 0 10px;color:var(--text-2);', text: 'Achievements' }),
        achWrap
      ]));
    }

    // ─── Match History ───
    if (history && history.length) {
      const list = el('div', { style: 'display:flex;flex-direction:column;gap:8px;' });
      history.slice(0, 10).forEach(h => {
        const me = window.VDAuth?.getUser();
        if (!me) return;
        const mineScore = h.player_a_id === me.id ? h.score_a : h.score_b;
        const otherScore = h.player_a_id === me.id ? h.score_b : h.score_a;
        const won = h.winner_id === me.id;
        const isTie = h.is_tie;

        list.appendChild(el('div', {
          class: 'card',
          style: 'padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;'
        }, [
          el('div', { style: 'min-width:0;flex:1;' }, [
            el('div', { style: 'font-size:13px;font-weight:600;color:var(--text-1);', text: h.game_title || h.game_key }),
            el('div', { style: 'font-size:11px;color:var(--text-4);margin-top:2px;', text: window.VDUI.timeAgo(h.created_at) })
          ]),
          el('div', { style: 'text-align:right;' }, [
            el('div', { style: 'font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--text-1);', text: `${mineScore} - ${otherScore}` }),
            el('div', {
              style: `font-size:10px;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px;color:${won ? 'var(--vd-green-lt)' : isTie ? 'var(--vd-violet-lt)' : 'var(--vd-rose)'};`,
              text: won ? 'Win' : isTie ? 'Tie' : 'Loss'
            })
          ])
        ]));
      });
      wrap.appendChild(el('div', {}, [
        el('h3', { style: 'font-size:16px;margin:8px 0 10px;color:var(--text-2);', text: 'Recent Matches' }),
        list
      ]));
    }
  }

  function statCard(label, value) {
    return el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-label', text: label }),
      el('div', { class: 'stat-value', text: String(value) })
    ]);
  }

  function invalidate() {
    state.stale = true;
  }

  function init() {}

  window.VDStats = {
    init,
    load,
    invalidate,
    render
  };
})();
