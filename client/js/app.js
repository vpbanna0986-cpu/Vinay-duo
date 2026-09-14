/* ═══════════════════════════════════════════════════════
   VINAY DUO — Main App Bootstrap
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, toast, showScreen, showView } = window.VDUI;

  let booted = false;

  // ─── Splash hide ───
  function hideSplash() {
    const splash = $('#splash');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 700);
      }, 1100);
    }
  }

  // ─── Nav init ───
  function initNav() {
    $$('[data-nav-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.navView;
        showView(view);

        // Lazy init per view
        if (view === 'games' && window.VDGames?.load) window.VDGames.load();
        if (view === 'notes' && window.VDNotes?.load) window.VDNotes.load();
        if (view === 'stats' && window.VDStats?.load) window.VDStats.load();
        if (view === 'chat' && window.VDChat?.markAllSeen) window.VDChat.markAllSeen();
      });
    });
  }

  // ─── Topbar actions ───
  function initTopbar() {
    const roomInfo = $('[data-action="show-room-info"]');
    if (roomInfo) {
      roomInfo.addEventListener('click', () => {
        const room = window.__vd_current_room;
        if (!room) return;
        const code = room.code || '------';
        const body = window.VDUI.el('div', {}, [
          window.VDUI.el('div', { class: 'field' }, [
            window.VDUI.el('span', { class: 'field-label', text: 'Room Code' }),
            window.VDUI.el('div', {
              class: 'code-inputs',
              style: 'justify-content:flex-start;margin-top:6px;',
              html: `<input value="${code[0]||''}" disabled style="width:34px;height:42px;font-size:18px"><input value="${code[1]||''}" disabled style="width:34px;height:42px;font-size:18px"><input value="${code[2]||''}" disabled style="width:34px;height:42px;font-size:18px"><input value="${code[3]||''}" disabled style="width:34px;height:42px;font-size:18px"><input value="${code[4]||''}" disabled style="width:34px;height:42px;font-size:18px"><input value="${code[5]||''}" disabled style="width:34px;height:42px;font-size:18px">`
            })
          ]),
          window.VDUI.el('p', {
            class: 'modal-desc',
            style: 'margin-top:14px',
            text: 'Share this code with your friend so they can join.'
          })
        ]);

        window.VDUI.modal({
          title: 'Duo Room Info',
          body,
          actions: [
            {
              label: '📋 Copy Code',
              variant: 'btn-ghost',
              onClick: () => {
                navigator.clipboard?.writeText(code);
                toast('Code copied!', 'success');
              }
            },
            {
              label: 'Leave Room',
              variant: 'btn-danger',
              onClick: () => window.VDRoom.leaveRoom()
            }
          ]
        });
      });
    }
  }

  // ─── Network banner ───
  function initNetworkBanner() {
    const banner = $('#net-banner');
    if (!banner || !window.VDSocket) return;

    const show = () => banner.classList.add('show');
    const hide = () => banner.classList.remove('show');

    window.VDSocket.on('disconnected', show);
    window.VDSocket.on('reconnecting', show);
    window.VDSocket.on('connected', hide);
    window.VDSocket.on('reconnected', hide);
  }

  // ─── Realtime notifications ───
  function initRealtimeNotices() {
    if (!window.VDSocket) return;

    window.VDSocket.on('challenge:new', (ch) => {
      const me = window.VDAuth?.getUser();
      if (!me) return;
      if (ch.opponent_id === me.id) {
        // I'm the opponent → show accept/decline popup
        showChallengePrompt(ch);
      } else {
        toast('Challenge sent · waiting for reply', 'info');
      }
    });

    window.VDSocket.on('challenge:updated', (ch) => {
      if (ch.status === 'accepted') {
        toast('Challenge accepted! Starting…', 'success');
      } else if (ch.status === 'declined') {
        toast('Challenge declined', 'info');
      } else if (ch.status === 'cancelled') {
        toast('Challenge cancelled', 'info');
      }
    });

    window.VDSocket.on('achievement:unlocked', (d) => {
      const list = d?.achievements || [];
      list.forEach((a, i) => {
        setTimeout(() => window.VDUI.achievementUnlock(a), i * 800);
      });
    });
  }

  function showChallengePrompt(ch) {
    const game = (window.__vd_games_cache || []).find(g => g.key === ch.game_key);
    const title = game ? game.title : ch.game_key;

    const body = window.VDUI.el('div', { style: 'text-align:center' }, [
      window.VDUI.el('div', { style: 'font-size:56px;margin-bottom:8px;', text: game?.emoji || '🎮' }),
      window.VDUI.el('div', { style: 'font-family:var(--font-display);font-size:18px;font-weight:700;', text: title }),
      window.VDUI.el('p', { class: 'modal-desc', style: 'margin-top:6px;', text: 'Your duo challenged you!' })
    ]);

    window.VDUI.modal({
      title: 'New Challenge',
      body,
      closable: false,
      actions: [
        {
          label: 'Decline',
          variant: 'btn-ghost',
          onClick: () => window.VDSocket.Actions.challengeRespond(ch.id, false)
        },
        {
          label: 'Accept',
          variant: 'btn-primary',
          onClick: () => {
            window.VDSocket.Actions.challengeRespond(ch.id, true);
            return true;
          }
        }
      ]
    });
  }

  // ─── Global error handler ───
  function initErrorHandling() {
    window.addEventListener('unhandledrejection', (e) => {
      console.warn('unhandled promise:', e.reason);
    });

    window.addEventListener('offline', () => {
      $('#net-banner')?.classList.add('show');
    });
    window.addEventListener('online', () => {
      if (window.VDSocket?.state?.connected) {
        $('#net-banner')?.classList.remove('show');
      }
    });
  }

  // ─── Boot sequence ───
  async function boot() {
    if (booted) return;
    booted = true;

    // 1. Init modules
    if (window.VDAuth) window.VDAuth.init();
    if (window.VDRoom) window.VDRoom.init();
    initNav();
    initTopbar();
    initNetworkBanner();
    initRealtimeNotices();
    initErrorHandling();

    // 2. Try to restore session
    const restored = await window.VDAuth.tryRestore();

    if (restored) {
      // Already logged in → go to auth flow (room check)
      await window.VDAuth.onAuthenticated();
    } else {
      showScreen('screen-auth');
    }

    hideSplash();
  }

  // ─── Public API ───
  function enterMain(room) {
    if (window.VDRoom) window.VDRoom.enterMain(room);
  }

  function onRoomEntered(room) {
    // Called by room.js after entering
    // Connect socket
    if (window.VDSocket) {
      window.VDSocket.connect();
    }

    // Switch to chat by default
    showView('chat');
  }

  // ─── DOM ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose
  window.VDApp = {
    enterMain,
    onRoomEntered,
    boot
  };
})();
