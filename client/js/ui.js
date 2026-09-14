/* ═══════════════════════════════════════════════════════
   VINAY DUO — UI Helpers
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── $ selectors ───
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ─── Create element helper ───
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v !== null && v !== undefined && v !== false) {
        node.setAttribute(k, v === true ? '' : v);
      }
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ─── Escape HTML ───
  function escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ═══════════════════════════════════════════════════════
  //  TOASTS
  // ═══════════════════════════════════════════════════════
  function toast(message, type = 'info', duration = 3000) {
    const wrap = $('#toasts');
    if (!wrap) return;

    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    const t = el('div', { class: `toast ${type}` }, [
      el('div', { class: 'toast-icon', text: icons[type] || 'ℹ' }),
      el('div', { class: 'toast-body', text: message })
    ]);

    wrap.appendChild(t);

    const remove = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    };
    setTimeout(remove, duration);

    t.addEventListener('click', remove);
    return remove;
  }

  // ═══════════════════════════════════════════════════════
  //  MODAL
  // ═══════════════════════════════════════════════════════
  function modal({ title, desc, body, actions = [], closable = true, onClose }) {
    const root = $('#modal-root');
    if (!root) return;

    const backdrop = el('div', { class: 'modal-backdrop' });
    const modalBox = el('div', { class: 'modal' });

    if (closable) {
      modalBox.appendChild(
        el('button', {
          class: 'modal-close',
          'aria-label': 'Close',
          html: '✕',
          onclick: () => close()
        })
      );
    }

    if (title) modalBox.appendChild(el('h3', { class: 'modal-title', text: title }));
    if (desc)  modalBox.appendChild(el('p',  { class: 'modal-desc',  text: desc }));
    if (body)  modalBox.appendChild(body);

    if (actions.length) {
      const actionWrap = el('div', { class: 'modal-actions' });
      actions.forEach(a => {
        const btn = el('button', {
          class: `btn ${a.variant || 'btn-ghost'}`,
          text: a.label,
          onclick: async () => {
            if (typeof a.onClick === 'function') {
              const keep = await a.onClick();
              if (keep === true) return;
            }
            if (!a.keepOpen) close();
          }
        });
        actionWrap.appendChild(btn);
      });
      modalBox.appendChild(actionWrap);
    }

    function close() {
      root.classList.remove('active');
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = '';
      if (typeof onClose === 'function') onClose();
    }

    backdrop.addEventListener('click', () => { if (closable) close(); });

    root.innerHTML = '';
    root.appendChild(backdrop);
    root.appendChild(modalBox);
    root.classList.add('active');
    root.setAttribute('aria-hidden', 'false');

    return { close };
  }

  // ─── Confirm dialog (Promise) ───
  function confirmDialog({ title, desc, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      modal({
        title,
        desc,
        actions: [
          { label: cancelLabel, variant: 'btn-ghost', onClick: () => resolve(false) },
          {
            label: confirmLabel,
            variant: danger ? 'btn-danger' : 'btn-primary',
            onClick: () => { resolve(true); return true; }
          }
        ],
        onClose: () => resolve(false)
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  //  COUNTDOWN OVERLAY
  // ═══════════════════════════════════════════════════════
  function countdown(seconds = 3) {
    return new Promise((resolve) => {
      const overlay = el('div', { class: 'countdown-overlay' });
      document.body.appendChild(overlay);

      let n = seconds;
      function tick() {
        overlay.innerHTML = '';
        if (n > 0) {
          const num = el('div', { class: 'countdown-number', text: String(n) });
          overlay.appendChild(num);
          n--;
          setTimeout(tick, 1000);
        } else {
          const go = el('div', { class: 'countdown-go', text: 'GO!' });
          overlay.appendChild(go);
          setTimeout(() => {
            overlay.remove();
            resolve();
          }, 700);
        }
      }
      tick();
    });
  }

  // ═══════════════════════════════════════════════════════
  //  CONFETTI
  // ═══════════════════════════════════════════════════════
  function confetti(count = 60, duration = 3000) {
    const colors = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#f43f5e', '#a78bfa'];
    const wrap = el('div', { class: 'confetti' });
    document.body.appendChild(wrap);

    for (let i = 0; i < count; i++) {
      const piece = el('div', { class: 'confetti-piece' });
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      wrap.appendChild(piece);
    }

    setTimeout(() => wrap.remove(), duration + 500);
  }

  // ═══════════════════════════════════════════════════════
  //  XP FLOAT
  // ═══════════════════════════════════════════════════════
  function xpFloat(amount, x, y) {
    const node = el('div', { class: 'xp-float', text: `+${amount} XP` });
    const cx = x ?? window.innerWidth / 2;
    const cy = y ?? window.innerHeight / 2;
    node.style.left = (cx - 40) + 'px';
    node.style.top = cy + 'px';
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1800);
  }

  // ═══════════════════════════════════════════════════════
  //  ACHIEVEMENT UNLOCK POPUP
  // ═══════════════════════════════════════════════════════
  function achievementUnlock(achievement) {
    if (!achievement) return;
    const node = el('div', { class: 'achievement-unlock' }, [
      el('div', { class: 'achievement-unlock-icon', text: achievement.icon || '🏆' }),
      el('div', { class: 'achievement-unlock-text' }, [
        el('div', { class: 'achievement-unlock-label', text: 'Achievement Unlocked' }),
        el('div', { class: 'achievement-unlock-title', text: achievement.title || 'Achievement' }),
        el('div', { class: 'achievement-unlock-desc', text: achievement.description || '' })
      ])
    ]);
    document.body.appendChild(node);
    confetti(50, 2200);
    setTimeout(() => node.remove(), 5000);
  }

  // ═══════════════════════════════════════════════════════
  //  RESULT OVERLAY (win/lose/tie)
  // ═══════════════════════════════════════════════════════
  function resultOverlay({ outcome, title, myScore, otherScore, myName, otherName, emoji, onRematch, onExit }) {
    const overlay = el('div', { class: `result-overlay ${outcome}` });

    const emojiNode = el('div', { class: 'result-emoji', text: emoji || (outcome === 'win' ? '🎉' : outcome === 'tie' ? '🤝' : '💔') });
    overlay.appendChild(emojiNode);

    const badge = el('div', { class: 'result-badge', text: title || (outcome === 'win' ? 'YOU WIN' : outcome === 'tie' ? 'TIE' : 'YOU LOSE') });
    overlay.appendChild(badge);

    const scores = el('div', { class: 'result-scores' }, [
      el('div', { class: `result-score ${outcome === 'win' ? 'winner' : ''}` }, [
        el('div', { class: 'result-score-name', text: (myName || 'You').slice(0, 10) }),
        el('div', { class: 'result-score-value', text: String(myScore ?? 0) })
      ]),
      el('div', { class: 'result-vs', text: 'VS' }),
      el('div', { class: `result-score ${outcome === 'lose' ? 'winner' : ''}` }, [
        el('div', { class: 'result-score-name', text: (otherName || 'Friend').slice(0, 10) }),
        el('div', { class: 'result-score-value', text: String(otherScore ?? 0) })
      ])
    ]);
    overlay.appendChild(scores);

    const actions = el('div', { class: 'result-actions' }, [
      el('button', {
        class: 'btn btn-ghost',
        text: 'Exit',
        onclick: () => { overlay.remove(); onExit && onExit(); }
      }),
      el('button', {
        class: 'btn btn-primary',
        text: '🔁 Rematch',
        onclick: () => { overlay.remove(); onRematch && onRematch(); }
      })
    ]);
    overlay.appendChild(actions);

    document.body.appendChild(overlay);

    if (outcome === 'win') confetti(80, 3200);

    return { close: () => overlay.remove() };
  }

  // ═══════════════════════════════════════════════════════
  //  BUTTON LOADING
  // ═══════════════════════════════════════════════════════
  function btnLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  AVATAR HELPERS
  // ═══════════════════════════════════════════════════════
  function avatarInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function avatarColor(name) {
    if (!name) return 'linear-gradient(135deg,#8b5cf6,#06b6d4)';
    const palettes = [
      'linear-gradient(135deg,#8b5cf6,#06b6d4)',
      'linear-gradient(135deg,#f59e0b,#ec4899)',
      'linear-gradient(135deg,#22c55e,#06b6d4)',
      'linear-gradient(135deg,#f43f5e,#8b5cf6)',
      'linear-gradient(135deg,#06b6d4,#a78bfa)',
      'linear-gradient(135deg,#ec4899,#f59e0b)'
    ];
    let hash = 0;
    const s = String(name);
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    return palettes[Math.abs(hash) % palettes.length];
  }

  // ═══════════════════════════════════════════════════════
  //  SCREEN MANAGER
  // ═══════════════════════════════════════════════════════
  function showScreen(id) {
    $$('.screen').forEach(s => s.hidden = true);
    const target = document.getElementById(id);
    if (target) {
      target.hidden = false;
      target.classList.remove('fade-out');
      target.classList.add('fade-in');
    }
  }

  function showView(name) {
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = document.querySelector(`.view[data-view="${name}"]`);
    if (target) target.classList.add('active');

    $$('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.navView === name);
    });

    const nav = document.querySelector('[data-nav]');
    if (nav) nav.dataset.active = name;
  }

  // ═══════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════
  function timeAgo(ts) {
    const d = new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Expose
  window.VDUI = {
    $, $$, el, escape,
    toast, modal, confirmDialog,
    countdown, confetti, xpFloat,
    achievementUnlock, resultOverlay,
    btnLoading,
    avatarInitials, avatarColor,
    showScreen, showView,
    timeAgo, formatTime
  };
})();
