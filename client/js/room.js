/* ═══════════════════════════════════════════════════════
   VINAY DUO — Room Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, toast, btnLoading, showScreen } = window.VDUI;
  const Api = window.VDApi;

  let currentRoom = null;

  // ─── Code inputs behaviour ───
  function initCodeInputs() {
    const wrap = $('[data-code-inputs]');
    if (!wrap) return;
    const inputs = $$('input', wrap);

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', (e) => {
        const v = e.target.value.replace(/\D/g, '');
        e.target.value = v.slice(-1);
        if (v && i < inputs.length - 1) inputs[i + 1].focus();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          inputs[i - 1].focus();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          inputs[i - 1].focus();
        } else if (e.key === 'ArrowRight' && i < inputs.length - 1) {
          inputs[i + 1].focus();
        } else if (e.key === 'Enter') {
          const form = inp.closest('form');
          if (form) form.requestSubmit();
        }
      });

      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const digits = String(text).replace(/\D/g, '').slice(0, 6);
        digits.split('').forEach((d, k) => {
          if (inputs[i + k]) inputs[i + k].value = d;
        });
        const next = Math.min(i + digits.length, inputs.length - 1);
        inputs[next].focus();
      });
    });
  }

  function getCode() {
    const wrap = $('[data-code-inputs]');
    if (!wrap) return '';
    return $$('input', wrap).map(i => i.value).join('');
  }

  function clearCode() {
    const wrap = $('[data-code-inputs]');
    if (!wrap) return;
    $$('input', wrap).forEach(i => i.value = '');
  }

  function focusFirstCode() {
    const wrap = $('[data-code-inputs]');
    if (!wrap) return;
    const first = wrap.querySelector('input');
    if (first) first.focus();
  }

  // ─── Error display ───
  function showRoomError(msg) {
    const el = $('[data-error="room"]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function clearRoomError() {
    const el = $('[data-error="room"]');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  // ─── Create Room ───
  async function handleCreate() {
    const btn = $('[data-action="create-room"]');
    clearRoomError();
    btnLoading(btn, true);

    try {
      const res = await Api.createRoom();
      if (!res?.room) throw new Error('Failed to create room');
      currentRoom = res.room;
      window.__vd_current_room = currentRoom;

      toast('Room created! Code: ' + currentRoom.code, 'success');

      // Enter main app
      enterMain(currentRoom);
    } catch (err) {
      showRoomError(err.message || 'Failed to create room');
      toast(err.message || 'Failed to create room', 'error');
    } finally {
      btnLoading(btn, false);
    }
  }

  // ─── Join Room ───
  async function handleJoin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    clearRoomError();

    const code = getCode();
    if (code.length !== 6) {
      return showRoomError('Enter the full 6-digit code');
    }

    btnLoading(btn, true);
    try {
      const res = await Api.joinRoom(code);
      if (!res?.room) throw new Error('Failed to join room');
      currentRoom = res.room;
      window.__vd_current_room = currentRoom;

      toast('Joined room ' + currentRoom.code + '!', 'success');
      clearCode();

      enterMain(currentRoom);
    } catch (err) {
      const msg = err.message || 'Failed to join room';
      showRoomError(msg);
      toast(msg, 'error');
      clearCode();
      focusFirstCode();
    } finally {
      btnLoading(btn, false);
    }
  }

  // ─── Enter main app ───
  function enterMain(room) {
    // Fill room code in topbar
    const codeNodes = $$('[data-room-code]');
    codeNodes.forEach(n => n.textContent = room.code || '------');

    // Fill other member info
    updateOtherMember(room);

    // Switch screens
    showScreen('screen-main');

    // Connect socket + join room channel
    if (window.VDSocket) {
      window.VDSocket.connect();
      setTimeout(() => {
        window.VDSocket.Actions.roomJoin().then(res => {
          if (!res?.ok) console.warn('room:join failed', res);
        });
      }, 300);
    }

    // Notify app
    if (window.VDApp?.onRoomEntered) {
      window.VDApp.onRoomEntered(room);
    }
  }

  // ─── Update other member chip ───
  function updateOtherMember(room) {
    if (!room || !room.members) return;
    const me = window.VDAuth?.getUser();
    if (!me) return;

    const other = room.members.find(m => m.user_id !== me.id);
    if (!other) return;

    const nameNodes = $$('[data-other-name]');
    const avatarNodes = $$('[data-other-avatar]');
    const presenceNodes = $$('[data-other-presence]');

    nameNodes.forEach(n => n.textContent = other.display_name || other.username);
    avatarNodes.forEach(a => {
      a.textContent = window.VDUI.avatarInitials(other.display_name || other.username);
      a.style.background = window.VDUI.avatarColor(other.username);
    });
    presenceNodes.forEach(p => {
      p.classList.toggle('online', !!other.is_online);
    });

    window.__vd_other_user = other;
  }

  // ─── Handle realtime updates ───
  function bindRealtime() {
    if (!window.VDSocket) return;

    window.VDSocket.on('room:state', (room) => {
      currentRoom = room;
      window.__vd_current_room = room;
      const codeNodes = $$('[data-room-code]');
      codeNodes.forEach(n => n.textContent = room.code || '------');
      updateOtherMember(room);
    });

    window.VDSocket.on('room:sync', (room) => {
      currentRoom = room;
      window.__vd_current_room = room;
      updateOtherMember(room);
    });

    window.VDSocket.on('room:member-joined', (d) => {
      const name = d.displayName || d.username || 'Your friend';
      toast(name + ' joined the room!', 'success');
      // Refresh room
      window.VDSocket.Actions.roomResync();
    });

    window.VDSocket.on('room:member-left', () => {
      toast('Your duo left the room', 'info');
    });

    window.VDSocket.on('presence:update', (d) => {
      const me = window.VDAuth?.getUser();
      if (me && d.userId === me.id) return;
      const presenceNodes = $$('[data-other-presence]');
      presenceNodes.forEach(p => p.classList.toggle('online', !!d.isOnline));
    });
  }

  // ─── Leave Room ───
  async function leaveRoom() {
    const ok = await window.VDUI.confirmDialog({
      title: 'Leave Duo Room?',
      desc: 'You will need the code to rejoin. Chat messages will still expire in 2 hours.',
      confirmLabel: 'Leave',
      danger: true
    });
    if (!ok) return;

    try {
      await Api.leaveRoom();
    } catch {}

    if (window.VDSocket) {
      window.VDSocket.Actions.roomLeave();
    }

    window.__vd_current_room = null;
    currentRoom = null;

    toast('Left the room', 'info');
    showScreen('screen-room');
  }

  // ─── Init ───
  function init() {
    initCodeInputs();

    const createBtn = $('[data-action="create-room"]');
    if (createBtn) createBtn.addEventListener('click', handleCreate);

    const joinForm = $('#form-join');
    if (joinForm) joinForm.addEventListener('submit', handleJoin);

    bindRealtime();
  }

  // Expose
  window.VDRoom = {
    init,
    enterMain,
    leaveRoom,
    updateOtherMember,
    getCurrent: () => currentRoom
  };
})();
