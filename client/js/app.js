/* ═══════════════════════════════════════════════════════
   VINAY DUO — Main App Bootstrap
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, toast, showScreen, showView } = window.VDUI;

  let booted = false;

  function hideSplash() {
    const splash = $('#splash');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 700);
      }, 1100);
    }
  }

  function closeAnyModal() {
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
      modalRoot.classList.remove('active');
      modalRoot.innerHTML = '';
      modalRoot.setAttribute('aria-hidden', 'true');
    }
  }

  function initNav() {
    $$('[data-nav-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.navView;
        showView(view);

        if (view === 'games' && window.VDGames?.load) window.VDGames.load();
        if (view === 'notes' && window.VDNotes?.load) window.VDNotes.load();
        if (view === 'stats' && window.VDStats?.load) window.VDStats.load();
        if (view === 'chat' && window.VDChat?.markAllSeen) window.VDChat.markAllSeen();
      });
    });
  }

  function initTopbar() {
    const roomInfo = $('[data-action="show-room-info"]');
    if (roomInfo) {
      roomInfo.addEventListener('click', () => {
        const room = window.__vd_current_room;
        if (!room) return;
        const code = room.code || '------';

        const body = window.VDUI.el('div', {}, [
          window.VDUI.el('div', { style: 'text-align:center;padding:14px 0;' }, [
            window.VDUI.el('div', { style: 'font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px;', text: 'Room Code' }),
            window.VDUI.el('div', { style: 'font-family:var(--font-display);font-size:36px;font-weight:800;letter-spacing:0.15em;background:var(--grad-brand);-webkit-background-clip:text;background-clip:text;color:transparent;', text: code })
          ]),
          window.VDUI.el('p', { class: 'modal-desc', style: 'text-align:center;', text: 'Share this code with your friend so they can join.' })
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

  function initRealtimeNotices() {
    if (!window.VDSocket) return;

    // New challenge received
    window.VDSocket.on('challenge:new', (ch) => {
      const me = window.VDAuth?.getUser();
      if (!me) return;
      if (ch.opponent_id === me.id) {
        showChallengePrompt(ch);
      } else {
        toast('Challenge sent · waiting for reply', 'info');
      }
    });

    // Challenge updated — accept/decline
    window.VDSocket.on('challenge:updated', (ch) => {
      if (ch.status === 'accepted') {
        closeAnyModal();
        toast('Challenge accepted! Starting…', 'success');

        const me = window.VDAuth?.getUser();
        if (!me) return;

        // ✅ BOTH players attempt game:start (server handles idempotency)
        setTimeout(() => {
          console.log('[app] calling game:start with challengeId=', ch.id);
          window.VDSocket.Actions.gameStart(ch.id).then(res => {
            console.log('[app] game:start result:', res);
            if (!res?.ok) {
              console.warn('[app] game:start failed:', res);
            }
          });
        }, 500);
      } else if (ch.status === 'declined') {
        closeAnyModal();
        toast('Challenge declined', 'info');
      } else if (ch.status === 'cancelled') {
        closeAnyModal();
        toast('Challenge cancelled', 'info');
      }
    });

    // Server says "game launch" → open game UI
    window.VDSocket.on('game:launch', (payload) => {
      console.log('[app] game:launch received:', payload);
      closeAnyModal();
      // Give the server a moment to send game:state / game:countdown
      setTimeout(() => {
        if (window.VDGameUI?.start) {
          window.VDGameUI.start(payload);
        }
      }, 200);
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

    const body = window.VDUI.el('div', { style: 'text-align:center;' }, [
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

  function initErrorHandling() {
    window.addEventListener('unhandledrejection', (e) => console.warn('unhandled promise:', e.reason));
    window.addEventListener('offline', () => $('#net-banner')?.classList.add('show'));
    window.addEventListener('online', () => {
      if (window.VDSocket?.state?.connected) $('#net-banner')?.classList.remove('show');
    });
  }

  async function boot() {
    if (booted) return;
    booted = true;
    console.log('[app] booting…');

    try { window.VDGameUI?.init?.(); } catch (e) { console.warn(e); }
    try { window.VDGames?.init?.(); }  catch (e) { console.warn(e); }
    try { window.VDChat?.init?.(); }   catch (e) { console.warn(e); }
    try { window.VDNotes?.init?.(); }  catch (e) { console.warn(e); }
    try { window.VDStats?.init?.(); }  catch (e) { console.warn(e); }
    try { window.VDAuth?.init?.(); }   catch (e) { console.warn(e); }
    try { window.VDRoom?.init?.(); }   catch (e) { console.warn(e); }

    initNav();
    initTopbar();
    initNetworkBanner();
    initRealtimeNotices();
    initErrorHandling();

    const restored = await window.VDAuth.tryRestore();

    if (restored) {
      await window.VDAuth.onAuthenticated();
    } else {
      showScreen('screen-auth');
    }

    hideSplash();
  }

  function enterMain(room) {
    if (window.VDRoom) window.VDRoom.enterMain(room);
  }

  function onRoomEntered(room) {
    if (window.VDSocket) window.VDSocket.connect();

    try { window.VDGameUI?.init?.(); } catch {}
    try { window.VDGames?.init?.(); }  catch {}
    try { window.VDChat?.init?.(); }   catch {}
    try { window.VDNotes?.init?.(); }  catch {}
    try { window.VDStats?.init?.(); }  catch {}

    setTimeout(() => {
      if (window.VDChat?.onRoomEntered) window.VDChat.onRoomEntered();
    }, 600);

    showView('chat');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.VDApp = { enterMain, onRoomEntered, boot };
})();
