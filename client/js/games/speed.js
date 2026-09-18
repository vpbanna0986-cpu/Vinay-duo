/* ═══════════════════════════════════════════════════════
   VINAY DUO — Speed Games UI (Final)
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { el } = window.VDUI;

  function injectKeyframes() {
    if (document.getElementById('rb-kf')) return;
    const s = document.createElement('style');
    s.id = 'rb-kf';
    s.textContent = `
      @keyframes rbWaitPulse { 0%,100%{transform:scale(1);opacity:.8;} 50%{transform:scale(1.15);opacity:1;} }
      @keyframes rbFadeIn { from{opacity:0;transform:scale(.9);} to{opacity:1;transform:scale(1);} }
    `;
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════
  //  1) REACTION BATTLE
  // ═══════════════════════════════════════════════════════
  const ReactionBattle = {
    mount({ container, emit }) {
      this.container = container;
      this.emit = emit;
      this.state = 'waiting';
      this.round = 1;
      this.totalRounds = 3;
      this.renderWaiting();
    },

    onEvent(event, data) {
      if (event === 'game:reaction:wait') {
        this.round = data.round || 1;
        this.totalRounds = data.totalRounds || 3;
        this.state = 'waiting';
        this.renderWaiting();
      } else if (event === 'game:reaction:go') {
        this.state = 'go';
        this.renderGo();
      } else if (event === 'game:reaction:tap') {
        this.showOpponentTap(data);
      } else if (event === 'game:reaction:early') {
        this.state = 'early';
      } else if (event === 'game:reaction:round-result') {
        this.state = 'result';
        this.renderRoundResult(data);
      }
    },

    renderWaiting() {
      injectKeyframes();
      this.container.innerHTML = '';
      this.container.style.background = 'radial-gradient(circle at center, rgba(139,92,246,0.15), transparent 70%)';

      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;position:relative;'
      }, [
        el('div', {
          style: 'position:absolute;top:20px;left:50%;transform:translateX(-50%);display:flex;gap:6px;'
        }, Array.from({ length: this.totalRounds }, (_, i) => {
          const isCurrent = i + 1 === this.round;
          const isPast = i + 1 < this.round;
          return el('div', {
            style: `width:${isCurrent ? '32px' : '10px'};height:10px;border-radius:10px;background:${isCurrent ? 'var(--grad-brand)' : isPast ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'};transition:all 300ms var(--ease-bounce);${isCurrent ? 'box-shadow:0 0 20px rgba(139,92,246,0.7);' : ''}`
          });
        })),

        el('div', {
          style: 'width:180px;height:180px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:90px;background:radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%);animation:rbWaitPulse 1.2s ease-in-out infinite;'
        }, [
          el('div', { text: '⚡', style: 'filter:drop-shadow(0 0 30px rgba(139,92,246,0.8));' })
        ]),

        el('h2', {
          style: 'font-family:var(--font-display);font-size:28px;margin-top:24px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;',
          text: `Round ${this.round} of ${this.totalRounds}`
        }),
        el('p', { style: 'color:var(--text-2);font-size:16px;margin-top:12px;font-weight:600;', text: 'Get ready...' }),
        el('p', { style: 'color:var(--vd-amber);font-size:13px;margin-top:8px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;', text: 'Wait for GREEN' })
      ]));
    },

    renderGo() {
      this.container.innerHTML = '';
      this.container.style.background = 'radial-gradient(circle at center, rgba(34,197,94,0.25), transparent 70%)';

      const tapZone = el('button', {
        style: 'flex:1;width:100%;background:linear-gradient(135deg,#22c55e 0%,#06b6d4 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;border-radius:20px;margin:20px;box-shadow:0 0 100px rgba(34,197,94,0.8);position:relative;overflow:hidden;transition:filter 150ms,transform 150ms;'
      }, [
        el('div', { style: 'font-size:130px;margin-bottom:8px;', text: '👆' }),
        el('div', { style: 'font-family:var(--font-display);font-size:56px;font-weight:900;color:#fff;letter-spacing:0.1em;', text: 'TAP!' }),
        el('div', { style: 'font-size:13px;color:rgba(255,255,255,0.9);letter-spacing:0.2em;text-transform:uppercase;margin-top:8px;font-weight:700;', text: 'AS FAST AS YOU CAN' })
      ]);

      const doTap = () => {
        if (this.state !== 'go') return;
        this.state = 'tapped';

        // ✅ Send tap immediately (HTTP for reliability)
        try { this.emit('tap', {}); } catch (e) {}

        // ✅ NO separate "Tapped" screen — just freeze green with subtle overlay
        tapZone.style.transform = 'scale(0.98)';
        tapZone.style.filter = 'brightness(0.75)';

        // Small badge overlay in the corner — not a full screen
        if (!this.container.querySelector('.rb-tap-badge')) {
          const badge = el('div', {
            class: 'rb-tap-badge',
            style: 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 22px;background:rgba(0,0,0,0.85);border:1px solid rgba(255,255,255,0.2);border-radius:999px;color:#fff;font-weight:700;font-size:14px;letter-spacing:0.08em;z-index:20;display:flex;align-items:center;gap:8px;'
          }, [
            el('span', { text: '✓' }),
            el('span', { text: 'Waiting for result…' })
          ]);
          this.container.appendChild(badge);
        }
      };

      tapZone.addEventListener('click', doTap);
      tapZone.addEventListener('touchstart', (e) => { e.preventDefault(); doTap(); }, { passive: false });

      this.container.appendChild(tapZone);
    },

    showOpponentTap(data) {
      const me = window.VDAuth?.getUser();
      if (data.userId === me?.id) return;
      const flash = el('div', {
        style: 'position:absolute;top:30%;left:50%;transform:translateX(-50%);padding:10px 20px;background:rgba(20,16,42,0.95);border:1px solid var(--border-2);border-radius:999px;color:#fff;font-weight:700;font-size:14px;z-index:20;',
        text: `Opponent: ${data.elapsed}ms`
      });
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 2000);
    },

    renderRoundResult(data) {
      this.container.innerHTML = '';
      const me = window.VDAuth?.getUser();
      const iWon = data.winnerId === me?.id;
      const noOne = !data.winnerId;

      this.container.style.background = iWon
        ? 'radial-gradient(circle at center, rgba(34,197,94,0.25), transparent 70%)'
        : noOne
          ? 'radial-gradient(circle at center, rgba(245,158,11,0.2), transparent 70%)'
          : 'radial-gradient(circle at center, rgba(244,63,94,0.2), transparent 70%)';

      const myTime = data.times?.[me?.id];
      const otherId = window.__vd_other_user?.user_id;
      const otherTime = data.times?.[otherId];

      const children = [
        el('div', { style: 'font-size:120px;animation:rbFadeIn 300ms var(--ease-bounce);', text: noOne ? '🤷' : iWon ? '🏆' : '😔' }),
        el('h2', {
          style: `font-family:var(--font-display);font-size:34px;margin-top:16px;color:${noOne ? 'var(--vd-amber)' : iWon ? 'var(--vd-green-lt)' : 'var(--vd-rose)'};font-weight:900;letter-spacing:0.02em;`,
          text: noOne ? 'Nobody Won' : iWon ? 'You Won!' : 'You Lost'
        }),
        el('p', {
          style: 'color:var(--text-3);font-size:13px;margin-top:4px;letter-spacing:0.15em;text-transform:uppercase;',
          text: `Round ${data.round} of ${data.totalRounds}`
        })
      ];

      if (myTime || otherTime) {
        children.push(el('div', { style: 'margin-top:24px;display:flex;gap:16px;' }, [
          myTime ? el('div', {
            style: 'padding:12px 20px;background:rgba(255,255,255,0.05);border:1px solid var(--border-2);border-radius:14px;text-align:center;'
          }, [
            el('div', { style: 'font-size:10px;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;', text: 'You' }),
            el('div', { style: 'font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--text-1);margin-top:4px;', text: myTime + 'ms' })
          ]) : null,
          otherTime ? el('div', {
            style: 'padding:12px 20px;background:rgba(255,255,255,0.05);border:1px solid var(--border-2);border-radius:14px;text-align:center;'
          }, [
            el('div', { style: 'font-size:10px;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;', text: (window.__vd_other_user?.display_name || 'Opponent').slice(0, 10) }),
            el('div', { style: 'font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--text-1);margin-top:4px;', text: otherTime + 'ms' })
          ]) : null
        ].filter(Boolean)));
      }

      if (!data.isLastRound) {
        children.push(el('p', {
          style: 'color:var(--vd-violet-lt);font-size:13px;margin-top:24px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;animation:rbWaitPulse 1s infinite;',
          text: '⏳ Next round starting…'
        }));
      }

      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, children));
    },

    unmount() { this.container = null; this.emit = null; }
  };

  // ═══════════════════════════════════════════════════════
  //  2) 10-SECOND CHALLENGE
  // ═══════════════════════════════════════════════════════
  const TenSecond = {
    mount({ container, emit }) {
      this.container = container;
      this.emit = emit;
      this.state = 'idle';
      this.startTime = null;
      this.renderIdle();
    },

    renderIdle() {
      this.container.innerHTML = '';
      this.container.style.background = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:90px;margin-bottom:16px;', text: '⏱️' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:28px;margin-bottom:8px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: '10-Second Challenge' }),
        el('p', { style: 'color:var(--text-2);font-size:15px;max-width:280px;line-height:1.6;', text: 'Tap START. Then tap STOP exactly at 10.000s.' }),
        el('p', { style: 'color:var(--vd-amber);font-size:13px;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;', text: 'Closest to 10s wins' }),
        el('button', {
          class: 'btn btn-primary btn-lg',
          style: 'margin-top:32px;min-width:220px;font-size:16px;',
          text: '▶ START',
          onclick: () => this.startTimer()
        })
      ]));
    },

    startTimer() {
      if (this.state !== 'idle') return;
      this.state = 'timing';
      this.startTime = Date.now();
      try { this.emit('start', {}); } catch {}
      this.renderTiming();
    },

    renderTiming() {
      this.container.innerHTML = '';
      this.container.style.background = 'radial-gradient(circle at center, rgba(245,158,11,0.15), transparent 70%)';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:100px;margin-bottom:16px;', text: '🤫' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:24px;color:var(--text-2);font-weight:700;', text: 'Count in your head…' }),
        el('p', { style: 'color:var(--vd-amber);font-size:14px;margin-top:8px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;', text: 'Tap STOP at exactly 10 seconds' }),
        el('button', {
          class: 'btn btn-danger btn-lg',
          style: 'margin-top:40px;min-width:220px;font-size:16px;',
          text: '■ STOP',
          onclick: () => this.stopTimer()
        })
      ]));
    },

    stopTimer() {
      if (this.state !== 'timing') return;
      this.state = 'stopped';
      const elapsed = Date.now() - this.startTime;
      try { this.emit('stop', {}); } catch {}

      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:80px;', text: '⏳' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:20px;color:var(--text-3);margin-top:12px;letter-spacing:0.1em;text-transform:uppercase;', text: 'You stopped at' }),
        el('div', {
          style: 'font-family:var(--font-display);font-size:56px;font-weight:900;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:8px;',
          text: (elapsed / 1000).toFixed(3) + 's'
        }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:16px;', text: 'Waiting for opponent…' })
      ]));
    },

    onEvent(event, data) {
      if (event === 'game:ten:ready') {
        this.state = 'idle';
        this.renderIdle();
      }
      if (event === 'game:ten:stopped') {
        const me = window.VDAuth?.getUser();
        if (data.userId === me?.id) return;
        const flash = el('div', {
          style: 'position:absolute;top:30%;left:50%;transform:translateX(-50%);padding:10px 22px;background:rgba(20,16,42,0.95);border-radius:999px;color:#fff;font-weight:700;z-index:20;font-size:13px;',
          text: `Opponent: ${(data.elapsed / 1000).toFixed(3)}s (${data.score} pts)`
        });
        this.container.appendChild(flash);
        setTimeout(() => flash.remove(), 2200);
      }
    },

    unmount() { this.container = null; this.emit = null; }
  };

  // ═══════════════════════════════════════════════════════
  //  3) FLASH GRID
  // ═══════════════════════════════════════════════════════
  const FlashGrid = {
    mount({ container, emit }) {
      this.container = container;
      this.emit = emit;
      this.gridSize = 3;
      this.targetCells = [];
      this.revealed = false;
      this.selected = new Set();
      this.renderIntro();
    },

    renderIntro() {
      this.container.innerHTML = '';
      this.container.style.background = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:90px;margin-bottom:16px;', text: '🔦' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:28px;margin-bottom:8px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: 'Flash Grid' }),
        el('p', { style: 'color:var(--text-2);font-size:15px;max-width:280px;line-height:1.6;', text: 'Watch which cells light up. Then tap them from memory!' }),
        el('p', { style: 'margin-top:24px;color:var(--vd-amber);font-size:13px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;', text: '⏳ Waiting…' })
      ]));
    },

    onEvent(event, data) {
      if (event === 'game:flash:show') {
        this.gridSize = data.gridSize;
        this.targetCells = data.targetCells || [];
        this.revealed = false;
        this.selected.clear();
        this.renderGrid(true);
      } else if (event === 'game:flash:hide') {
        this.revealed = true;
        this.renderGrid(false);
      } else if (event === 'game:flash:result') {
        this.showResult(data);
      }
    },

    renderGrid(showTargets) {
      this.container.innerHTML = '';
      const grid = el('div', {
        style: `display:grid;grid-template-columns:repeat(${this.gridSize},1fr);gap:10px;padding:24px;max-width:420px;width:100%;margin:0 auto;`
      });

      const total = this.gridSize * this.gridSize;
      for (let i = 0; i < total; i++) {
        const isTarget = this.targetCells.includes(i);
        const isSelected = this.selected.has(i);
        const highlighted = showTargets && isTarget;

        grid.appendChild(el('button', {
          style: `
            aspect-ratio:1;border-radius:16px;
            border:2px solid ${highlighted ? 'transparent' : isSelected ? 'var(--vd-violet)' : 'rgba(255,255,255,0.1)'};
            background:${highlighted ? 'linear-gradient(135deg,#22c55e,#06b6d4)' : isSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.04)'};
            cursor:${showTargets ? 'default' : 'pointer'};
            transition:all 250ms var(--ease-bounce);
            box-shadow:${highlighted ? '0 0 40px rgba(34,197,94,0.9)' : isSelected ? '0 0 30px rgba(139,92,246,0.6)' : 'inset 0 0 20px rgba(0,0,0,0.3)'};
          `,
          onclick: () => { if (this.revealed) this.toggleCell(i); }
        }));
      }

      const wrapper = el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;' }, [
        el('p', {
          style: `padding:16px;font-size:15px;color:${showTargets ? 'var(--vd-green-lt)' : 'var(--vd-amber)'};text-align:center;font-weight:700;`,
          text: showTargets ? '👀 MEMORIZE!' : `👆 Tap ${this.targetCells.length} cells`
        }),
        grid
      ]);
      this.container.appendChild(wrapper);

      if (!showTargets && this.revealed && this.selected.size > 0) {
        wrapper.appendChild(el('button', {
          class: 'btn btn-primary',
          style: 'margin-top:20px;min-width:200px;',
          text: `Submit (${this.selected.size} selected)`,
          onclick: () => this.submit()
        }));
      }
    },

    toggleCell(idx) {
      if (this.selected.has(idx)) this.selected.delete(idx);
      else this.selected.add(idx);
      this.renderGrid(false);
    },

    submit() {
      const arr = Array.from(this.selected).sort((a, b) => a - b);
      try { this.emit('guess', { cells: arr }); } catch {}
      this.revealed = false;
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:80px;', text: '📤' }),
        el('h3', { style: 'margin-top:16px;color:var(--text-2);font-family:var(--font-display);font-size:22px;', text: 'Submitted!' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:8px;', text: 'Waiting for opponent…' })
      ]));
    },

    showResult(data) {
      const me = window.VDAuth?.getUser();
      const mine = data.userId === me?.id;
      const flash = el('div', {
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px 28px;background:rgba(0,0,0,0.92);border:1px solid var(--border-2);border-radius:16px;color:#fff;z-index:20;text-align:center;',
      }, [
        el('div', { style: 'font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: mine ? 'You' : 'Opponent' }),
        el('div', { style: 'font-family:var(--font-display);font-size:28px;font-weight:900;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:4px;', text: `+${data.score} pts` }),
        el('div', { style: 'font-size:12px;color:var(--text-3);margin-top:6px;', text: `${data.correct} correct · ${data.wrong} wrong` })
      ]);
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 2200);
    },

    unmount() { this.container = null; this.emit = null; }
  };

  if (window.VDGameUI) {
    window.VDGameUI.register('reaction_battle', ReactionBattle);
    window.VDGameUI.register('ten_second', TenSecond);
    window.VDGameUI.register('flash_grid', FlashGrid);
  }
})();
