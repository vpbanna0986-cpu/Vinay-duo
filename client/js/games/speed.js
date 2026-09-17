/* ═══════════════════════════════════════════════════════
   VINAY DUO — Speed Games UI (Premium)
   Reaction Battle · 10-Second Challenge · Flash Grid
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { el } = window.VDUI;

  // ═══════════════════════════════════════════════════════
  //  1) REACTION BATTLE — Premium UI
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

    renderWaiting() {
      this.container.innerHTML = '';
      this.container.style.background = 'radial-gradient(circle at center, rgba(139,92,246,0.15), transparent 70%)';

      const wrapper = el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;position:relative;'
      }, [
        // Round counter top
        el('div', {
          style: 'position:absolute;top:20px;left:50%;transform:translateX(-50%);display:flex;gap:6px;'
        }, Array.from({ length: 3 }, (_, i) => {
          const isCurrent = i + 1 === this.round;
          const isPast = i + 1 < this.round;
          return el('div', {
            style: `width:${isCurrent ? '32px' : '10px'};height:10px;border-radius:10px;background:${isCurrent ? 'var(--grad-brand)' : isPast ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'};transition:all 300ms var(--ease-bounce);${isCurrent ? 'box-shadow:0 0 20px rgba(139,92,246,0.7);' : ''}`
          });
        })),

        // Big pulse animation
        el('div', {
          style: 'width:180px;height:180px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:90px;background:radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%);animation:rbWaitPulse 1.2s ease-in-out infinite;'
        }, [
          el('div', { text: '⚡', style: 'filter:drop-shadow(0 0 30px rgba(139,92,246,0.8));' })
        ]),

        el('h2', {
          style: 'font-family:var(--font-display);font-size:28px;margin-top:24px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:0.02em;',
          text: `Round ${this.round}`
        }),

        el('p', {
          style: 'color:var(--text-2);font-size:16px;margin-top:12px;font-weight:600;letter-spacing:0.03em;',
          text: 'Get ready...'
        }),

        el('p', {
          style: 'color:var(--vd-amber);font-size:13px;margin-top:8px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;',
          text: 'Wait for GREEN'
        })
      ]);

      this.container.appendChild(wrapper);

      // Inject keyframes if not already
      if (!document.getElementById('rb-keyframes')) {
        const style = document.createElement('style');
        style.id = 'rb-keyframes';
        style.textContent = `
          @keyframes rbWaitPulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 1; }
          }
          @keyframes rbGoBurst {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes rbTappedPop {
            0% { transform: scale(1); }
            40% { transform: scale(0.9); }
            100% { transform: scale(1); }
          }
        `;
        document.head.appendChild(style);
      }
    },

    onEvent(event, data) {
      if (event === 'game:reaction:wait') {
        this.round = data.round || this.round;
        this.totalRounds = data.totalRounds || 3;
        this.state = 'waiting';
        this.renderWaiting();
      }
      if (event === 'game:reaction:go') {
        this.state = 'go';
        this.renderGo(data);
      }
      if (event === 'game:reaction:tap') {
        this.showTapFeedback(data);
      }
      if (event === 'game:reaction:early') {
        this.renderEarly();
      }
      if (event === 'game:reaction:timeout') {
        this.renderTimeout();
      }
      if (event === 'game:reaction:round-result') {
        this.renderRoundResult(data);
      }
    },

    renderGo() {
      this.container.innerHTML = '';
      this.container.style.background = 'radial-gradient(circle at center, rgba(34,197,94,0.25), transparent 70%)';

      const tapZone = el('button', {
        style: 'flex:1;width:100%;background:linear-gradient(135deg, #22c55e 0%, #06b6d4 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;border-radius:20px;margin:20px;box-shadow:0 0 100px rgba(34,197,94,0.8), inset 0 -8px 30px rgba(0,0,0,0.2);animation:rbGoBurst 300ms cubic-bezier(0.34,1.56,0.64,1);position:relative;overflow:hidden;'
      }, [
        // Pulse ring
        el('div', {
          style: 'position:absolute;inset:0;border-radius:20px;border:3px solid rgba(255,255,255,0.4);animation:rbWaitPulse 0.8s ease-in-out infinite;pointer-events:none;'
        }),
        el('div', {
          style: 'font-size:130px;margin-bottom:8px;filter:drop-shadow(0 4px 20px rgba(0,0,0,0.3));',
          text: '👆'
        }),
        el('div', {
          style: 'font-family:var(--font-display);font-size:56px;font-weight:900;color:#fff;letter-spacing:0.1em;text-shadow:0 6px 30px rgba(0,0,0,0.5);',
          text: 'TAP!'
        }),
        el('div', {
          style: 'font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:0.2em;text-transform:uppercase;margin-top:8px;font-weight:700;',
          text: 'AS FAST AS YOU CAN'
        })
      ]);

      const doTap = () => {
        if (this.state !== 'go') return;
        this.state = 'tapped';

        try { this.emit('tap', {}); } catch (e) {}

        tapZone.style.animation = 'rbTappedPop 200ms';
        tapZone.style.background = 'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)';
        tapZone.style.boxShadow = '0 0 100px rgba(245,158,11,0.8), inset 0 -8px 30px rgba(0,0,0,0.2)';
        tapZone.innerHTML = '<div style="font-size:110px;filter:drop-shadow(0 0 30px rgba(255,255,255,0.8));">✅</div><div style="font-family:var(--font-display);font-size:36px;font-weight:900;color:#fff;letter-spacing:0.08em;margin-top:8px;text-shadow:0 4px 20px rgba(0,0,0,0.4);">TAPPED!</div>';
      };

      tapZone.addEventListener('click', doTap);
      tapZone.addEventListener('touchstart', (e) => { e.preventDefault(); doTap(); }, { passive: false });

      this.container.appendChild(tapZone);
    },

    showTapFeedback(data) {
      const me = window.VDAuth?.getUser();
      const mine = data.userId === me?.id;
      const flash = el('div', {
        style: `position:absolute;top:${mine ? '25%' : '35%'};left:50%;transform:translateX(-50%);padding:14px 28px;background:${mine ? 'linear-gradient(135deg,#8b5cf6,#06b6d4)' : 'rgba(20,16,42,0.95)'};border:1px solid rgba(255,255,255,0.2);border-radius:999px;color:#fff;font-weight:800;font-size:16px;letter-spacing:0.05em;z-index:20;box-shadow:0 10px 30px rgba(0,0,0,0.5);animation:rbTappedPop 400ms var(--ease-bounce);`,
        text: `${mine ? 'YOU' : 'OPPONENT'}: ${data.elapsed}ms`
      });
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 1800);
    },

    renderEarly() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:100px;animation:rbWaitPulse 1s infinite;', text: '😅' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:28px;color:var(--vd-rose);margin-top:16px;font-weight:800;', text: 'TOO EARLY!' }),
        el('p', { style: 'color:var(--text-3);font-size:15px;margin-top:8px;', text: 'You tapped before green' })
      ]));
    },

    renderTimeout() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:100px;', text: '⌛' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:28px;color:var(--vd-amber);margin-top:16px;font-weight:800;', text: 'TOO SLOW!' }),
        el('p', { style: 'color:var(--text-3);font-size:15px;margin-top:8px;', text: 'Nobody tapped in time' })
      ]));
    },

    renderRoundResult(data) {
      const me = window.VDAuth?.getUser();
      const iWon = data.winnerId === me?.id;
      const noOne = !data.winnerId;

      const emoji = noOne ? '🤷' : iWon ? '🏆' : '😔';
      const title = noOne ? 'Nobody Won' : iWon ? 'You Won!' : 'You Lost';
      const color = noOne ? 'var(--vd-amber)' : iWon ? 'var(--vd-green)' : 'var(--vd-rose)';

      this.container.innerHTML = '';
      this.container.style.background = iWon
        ? 'radial-gradient(circle at center, rgba(34,197,94,0.25), transparent 70%)'
        : 'radial-gradient(circle at center, rgba(244,63,94,0.2), transparent 70%)';

      const myTime = data.times?.[me?.id];
      const otherTime = data.times?.[window.__vd_other_user?.user_id];

      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:120px;animation:rbGoBurst 500ms var(--ease-bounce);', text: emoji }),
        el('h2', {
          style: `font-family:var(--font-display);font-size:34px;margin-top:16px;color:${color};font-weight:900;letter-spacing:0.03em;`,
          text: title
        }),
        el('p', { style: 'color:var(--text-3);font-size:13px;margin-top:4px;letter-spacing:0.15em;text-transform:uppercase;', text: `Round ${data.round} of ${data.totalRounds || 3}` }),

        // Times display
        (myTime || otherTime) && el('div', {
          style: 'margin-top:24px;display:flex;gap:16px;'
        }, [
          myTime && el('div', {
            style: 'padding:12px 20px;background:rgba(255,255,255,0.05);border:1px solid var(--border-2);border-radius:14px;text-align:center;'
          }, [
            el('div', { style: 'font-size:10px;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;', text: 'You' }),
            el('div', { style: 'font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--text-1);margin-top:4px;', text: myTime + 'ms' })
          ]),
          otherTime && el('div', {
            style: 'padding:12px 20px;background:rgba(255,255,255,0.05);border:1px solid var(--border-2);border-radius:14px;text-align:center;'
          }, [
            el('div', { style: 'font-size:10px;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;', text: window.__vd_other_user?.display_name || 'Opponent' }),
            el('div', { style: 'font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--text-1);margin-top:4px;', text: otherTime + 'ms' })
          ])
        ]),

        !data.isLastRound && el('p', {
          style: 'color:var(--vd-violet-lt);font-size:13px;margin-top:24px;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;animation:rbWaitPulse 1s infinite;',
          text: '⏳ Next round starting…'
        })
      ].filter(Boolean)));
    },

    unmount() {
      this.container = null;
      this.emit = null;
    }
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
        el('div', { style: 'font-size:100px;margin-bottom:16px;animation:rbWaitPulse 1s infinite;', text: '🤫' }),
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
      if (event === 'game:ten:stopped') {
        const me = window.VDAuth?.getUser();
        const mine = data.userId === me?.id;
        const flash = el('div', {
          style: `position:absolute;top:${mine ? '25%' : '35%'};left:50%;transform:translateX(-50%);padding:12px 24px;background:${mine ? 'var(--grad-brand)' : 'rgba(255,255,255,0.1)'};border-radius:999px;color:#fff;font-weight:800;z-index:20;font-size:14px;animation:rbGoBurst 400ms;`,
          text: `${mine ? 'You' : 'Opponent'}: ${(data.elapsed / 1000).toFixed(3)}s (${data.score} pts)`
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
      }
      if (event === 'game:flash:hide') {
        this.revealed = true;
        this.renderGrid(false);
      }
      if (event === 'game:flash:result') {
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

        const cell = el('button', {
          style: `
            aspect-ratio:1;
            border-radius:16px;
            border:2px solid ${highlighted ? 'transparent' : isSelected ? 'var(--vd-violet)' : 'rgba(255,255,255,0.1)'};
            background:${highlighted ? 'linear-gradient(135deg,#22c55e,#06b6d4)' : isSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.04)'};
            cursor:${showTargets ? 'default' : 'pointer'};
            transition:all 250ms var(--ease-bounce);
            box-shadow:${highlighted ? '0 0 40px rgba(34,197,94,0.9)' : isSelected ? '0 0 30px rgba(139,92,246,0.6)' : 'inset 0 0 20px rgba(0,0,0,0.3)'};
            transform:${highlighted ? 'scale(1.08)' : 'scale(1)'};
          `,
          onclick: () => { if (this.revealed) this.toggleCell(i); }
        });
        grid.appendChild(cell);
      }

      const wrapper = el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      }, [
        el('p', {
          style: `padding:16px;font-size:15px;color:${showTargets ? 'var(--vd-green-lt)' : 'var(--vd-amber)'};text-align:center;font-weight:700;letter-spacing:0.05em;`,
          text: showTargets ? '👀 MEMORIZE!' : `👆 Tap ${this.targetCells.length} cells`
        }),
        grid
      ]);
      this.container.appendChild(wrapper);

      if (!showTargets && this.revealed && this.selected.size > 0) {
        const submitBtn = el('button', {
          class: 'btn btn-primary',
          style: 'margin-top:20px;min-width:200px;',
          text: `Submit (${this.selected.size} selected)`,
          onclick: () => this.submit()
        });
        wrapper.appendChild(submitBtn);
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
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px 28px;background:rgba(0,0,0,0.92);border:1px solid var(--border-2);border-radius:16px;color:#fff;z-index:20;text-align:center;animation:rbGoBurst 400ms;',
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

  // ═══════════════════════════════════════════════════════
  //  REGISTER
  // ═══════════════════════════════════════════════════════
  if (window.VDGameUI) {
    window.VDGameUI.register('reaction_battle', ReactionBattle);
    window.VDGameUI.register('ten_second', TenSecond);
    window.VDGameUI.register('flash_grid', FlashGrid);
  }
})();
