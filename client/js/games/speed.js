/* ═══════════════════════════════════════════════════════
   VINAY DUO — Speed Games UI
   Reaction Battle · 10-Second Challenge · Flash Grid
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { el } = window.VDUI;
  const G = window.VDGameUI;

  // ═══════════════════════════════════════════════════════
  //  1) REACTION BATTLE
  // ═══════════════════════════════════════════════════════
  const ReactionBattle = {
    mount({ container, emit }) {
      this.container = container;
      this.emit = emit;
      this.state = 'waiting'; // waiting | go | early | timeout | done
      this.renderWaiting();
    },

    renderWaiting() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        class: 'speed-stage',
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:72px;margin-bottom:16px;', text: '⚡' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:26px;margin-bottom:8px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: 'Reaction Battle' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;max-width:280px;line-height:1.6;', text: 'Wait for GREEN. Then tap as fast as you can!' }),
        el('div', { style: 'margin-top:24px;display:flex;gap:8px;' }, [
          el('div', { class: 'badge badge-violet', text: '3 Rounds' }),
          el('div', { class: 'badge badge-cyan', text: 'Fastest wins' })
        ]),
        el('p', { style: 'margin-top:32px;font-size:13px;color:var(--vd-amber);', text: '⏳ Get ready…' })
      ]));
    },

    onEvent(event, data) {
      if (event === 'game:reaction:wait') {
        this.state = 'waiting';
        this.renderWaiting();
      }

      if (event === 'game:reaction:go') {
        this.state = 'go';
        this.renderGo();
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
      const tapZone = el('button', {
        style: 'flex:1;width:100%;background:linear-gradient(135deg,#22c55e,#06b6d4);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;border-radius:16px;margin:24px;box-shadow:0 0 80px rgba(34,197,94,0.6);animation:scaleIn 240ms var(--ease-bounce);transition:transform 100ms;'
      }, [
        el('div', { style: 'font-size:120px;margin-bottom:12px;', text: '👆' }),
        el('div', { style: 'font-family:var(--font-display);font-size:42px;font-weight:800;color:#fff;letter-spacing:0.05em;text-shadow:0 4px 20px rgba(0,0,0,0.4);', text: 'TAP!' })
      ]);

      const doTap = () => {
        if (this.state !== 'go') return;
        this.state = 'tapped';
        tapZone.style.transform = 'scale(0.95)';
        this.emit('tap');
      };

      tapZone.addEventListener('click', doTap);
      tapZone.addEventListener('touchstart', (e) => { e.preventDefault(); doTap(); }, { passive: false });

      this.container.appendChild(tapZone);
    },

    showTapFeedback(data) {
      // Don't replace UI; just flash
      const label = data.userId === window.VDAuth?.getUser()?.id ? 'YOU' : 'OPPONENT';
      const flash = el('div', {
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:12px 24px;background:rgba(0,0,0,0.85);border-radius:999px;color:#fff;font-weight:700;z-index:20;animation:popIn 400ms var(--ease-bounce);',
        text: `${label}: ${data.elapsed}ms`
      });
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 1200);
    },

    renderEarly() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:80px;', text: '😅' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:24px;color:var(--vd-rose);margin-top:12px;', text: 'Too Early!' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:6px;', text: 'You tapped before green' })
      ]));
    },

    renderTimeout() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:80px;', text: '⌛' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:24px;color:var(--vd-amber);margin-top:12px;', text: 'Too Slow!' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:6px;', text: 'Nobody tapped in time' })
      ]));
    },

    renderRoundResult(data) {
      const me = window.VDAuth?.getUser();
      const iWon = data.winnerId === me?.id;
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: `font-size:80px;`, text: iWon ? '🏆' : '😔' }),
        el('h2', {
          style: `font-family:var(--font-display);font-size:26px;margin-top:12px;color:${iWon ? 'var(--vd-green)' : 'var(--vd-rose)'};`,
          text: iWon ? 'You won the round!' : 'You lost the round'
        }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:6px;', text: `Round ${data.round}` })
      ]));
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
      this.state = 'idle'; // idle | timing | stopped
      this.startTime = null;
      this.timerInterval = null;
      this.renderIdle();
    },

    renderIdle() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:72px;margin-bottom:16px;', text: '⏱️' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:26px;margin-bottom:8px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: '10-Second Challenge' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;max-width:280px;line-height:1.6;', text: 'Tap START. Then tap STOP exactly at 10.000s. Closest wins!' }),
        el('button', {
          class: 'btn btn-primary btn-lg',
          style: 'margin-top:32px;min-width:200px;',
          text: '▶ START',
          onclick: () => this.startTimer()
        })
      ]));
    },

    startTimer() {
      this.state = 'timing';
      this.startTime = Date.now();
      this.emit('start');
      this.renderTiming();
    },

    renderTiming() {
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:80px;margin-bottom:16px;', text: '🤫' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:22px;color:var(--text-3);', text: 'Timer hidden. Count in your head…' }),
        el('p', { style: 'color:var(--vd-amber);font-size:14px;margin-top:8px;', text: 'Tap STOP at exactly 10 seconds' }),
        el('button', {
          class: 'btn btn-danger btn-lg',
          style: 'margin-top:40px;min-width:200px;',
          text: '■ STOP',
          onclick: () => this.stopTimer()
        })
      ]));
    },

    stopTimer() {
      this.state = 'stopped';
      const elapsed = Date.now() - this.startTime;
      this.emit('stop');

      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:64px;', text: '⏳' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:22px;color:var(--text-2);margin-top:12px;', text: 'You stopped at' }),
        el('div', {
          style: 'font-family:var(--font-display);font-size:48px;font-weight:800;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:8px;',
          text: (elapsed / 1000).toFixed(3) + 's'
        }),
        el('p', { style: 'color:var(--text-3);font-size:14px;margin-top:8px;', text: 'Waiting for opponent…' })
      ]));
    },

    onEvent(event, data) {
      if (event === 'game:ten:started') {
        // opponent started
      }
      if (event === 'game:ten:stopped') {
        this.showResult(data);
      }
    },

    showResult(data) {
      const me = window.VDAuth?.getUser();
      const mine = data.userId === me?.id;
      const flash = el('div', {
        style: `position:absolute;top:${mine ? '30%' : '70%'};left:50%;transform:translate(-50%,-50%);padding:10px 20px;background:${mine ? 'var(--grad-brand)' : 'rgba(255,255,255,0.1)'};border-radius:999px;color:#fff;font-weight:700;z-index:20;animation:popIn 400ms var(--ease-bounce);font-size:13px;`,
        text: `${mine ? 'You' : 'Opponent'}: ${(data.elapsed / 1000).toFixed(3)}s (${data.score} pts)`
      });
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 2000);
    },

    unmount() {
      clearInterval(this.timerInterval);
      this.container = null;
      this.emit = null;
    }
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
        el('div', { style: 'font-size:72px;margin-bottom:16px;', text: '🔦' }),
        el('h2', { style: 'font-family:var(--font-display);font-size:26px;margin-bottom:8px;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: 'Flash Grid' }),
        el('p', { style: 'color:var(--text-3);font-size:14px;max-width:280px;line-height:1.6;', text: 'Watch which cells light up. Then tap them all from memory!' }),
        el('p', { style: 'margin-top:24px;color:var(--vd-amber);font-size:14px;', text: '⏳ Waiting for round…' })
      ]));
    },

    onEvent(event, data) {
      if (event === 'game:flash:show') {
        this.gridSize = data.gridSize;
        this.targetCells = data.targetCells || [];
        this.revealed = false;
        this.selected.clear();
        this.renderGrid(true, data.flashMs || 1200);
      }
      if (event === 'game:flash:hide') {
        this.revealed = true;
        this.renderGrid(false, 0);
      }
      if (event === 'game:flash:result') {
        this.showResult(data);
      }
      if (event === 'game:flash:timeout') {
        this.revealed = true;
      }
    },

    renderGrid(showTargets, flashMs) {
      this.container.innerHTML = '';

      const grid = el('div', {
        style: `display:grid;grid-template-columns:repeat(${this.gridSize},1fr);gap:8px;padding:24px;max-width:400px;width:100%;margin:0 auto;`
      });

      const total = this.gridSize * this.gridSize;
      for (let i = 0; i < total; i++) {
        const isTarget = this.targetCells.includes(i);
        const isSelected = this.selected.has(i);
        const highlighted = showTargets && isTarget;

        const cell = el('button', {
          style: `
            aspect-ratio:1;
            border-radius:12px;
            border:1.5px solid ${highlighted ? 'transparent' : isSelected ? 'var(--vd-violet)' : 'var(--border-2)'};
            background:${highlighted ? 'linear-gradient(135deg,#22c55e,#06b6d4)' : isSelected ? 'rgba(139,92,246,0.25)' : 'var(--surface-2)'};
            cursor:${showTargets ? 'default' : 'pointer'};
            transition:all 200ms var(--ease-out);
            box-shadow:${highlighted ? '0 0 30px rgba(34,197,94,0.7)' : isSelected ? '0 0 20px rgba(139,92,246,0.5)' : 'none'};
            transform:${highlighted ? 'scale(1.05)' : 'scale(1)'};
          `,
          onclick: () => {
            if (!this.revealed) return;
            this.toggleCell(i);
          }
        });
        grid.appendChild(cell);
      }

      const wrapper = el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      }, [
        el('p', {
          style: `padding:16px;font-size:14px;color:${showTargets ? 'var(--vd-green)' : 'var(--vd-amber)'};text-align:center;font-weight:600;`,
          text: showTargets ? '👀 Memorize the green cells!' : `👆 Tap ${this.targetCells.length} cells you saw`
        }),
        grid
      ]);
      this.container.appendChild(wrapper);
    },

    toggleCell(idx) {
      if (this.selected.has(idx)) {
        this.selected.delete(idx);
      } else {
        this.selected.add(idx);
      }
      this.renderGrid(false, 0);
    },

    submit() {
      const arr = Array.from(this.selected).sort((a, b) => a - b);
      this.emit('guess', { cells: arr });
      this.revealed = false;
      this.container.innerHTML = '';
      this.container.appendChild(el('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;'
      }, [
        el('div', { style: 'font-size:64px;', text: '📤' }),
        el('h3', { style: 'margin-top:12px;color:var(--text-2);', text: 'Answer submitted!' }),
        el('p', { style: 'color:var(--text-3);font-size:13px;margin-top:6px;', text: 'Waiting for opponent…' })
      ]));
    },

    showResult(data) {
      const me = window.VDAuth?.getUser();
      const mine = data.userId === me?.id;
      const flash = el('div', {
        style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px 24px;background:rgba(0,0,0,0.9);border-radius:14px;color:#fff;z-index:20;animation:popIn 400ms var(--ease-bounce);text-align:center;',
      }, [
        el('div', { style: 'font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);', text: mine ? 'You' : 'Opponent' }),
        el('div', { style: 'font-family:var(--font-display);font-size:24px;font-weight:800;', text: `+${data.score} pts` }),
        el('div', { style: 'font-size:12px;color:var(--text-3);margin-top:4px;', text: `${data.correct} correct · ${data.wrong} wrong` })
      ]);
      this.container.appendChild(flash);
      setTimeout(() => flash.remove(), 2000);
    },

    unmount() {
      this.container = null;
      this.emit = null;
    }
  };

  // ═══════════════════════════════════════════════════════
  //  REGISTER ALL 3
  // ═══════════════════════════════════════════════════════
  if (window.VDGameUI) {
    window.VDGameUI.register('reaction_battle', ReactionBattle);
    window.VDGameUI.register('ten_second', TenSecond);
    window.VDGameUI.register('flash_grid', FlashGrid);
  }
})();
