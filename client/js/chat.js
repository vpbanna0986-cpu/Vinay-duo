/* ═══════════════════════════════════════════════════════
   VINAY DUO — Chat Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, $$, el, escape, toast, formatTime } = window.VDUI;
  const Api = window.VDApi;

  const state = {
    messages: [],           // ordered list
    byId: new Map(),
    typingTimer: null,
    lastTypingSent: 0,
    seenTimer: null,
    initialized: false
  };

  const REACTION_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢', '🎉', '👏'];

  // ─── Get current user ───
  function me() { return window.VDAuth?.getUser() || null; }
  function other() { return window.__vd_other_user || null; }

  // ─── Render a single message ───
  function renderMessage(m, opts = {}) {
    const user = me();
    if (!user) return null;

    const mine = m.sender_id === user.id;
    const isDeleted = !!m.deleted_at;
    const content = isDeleted ? 'This message was deleted' : (m.content || '');

    // Reactions
    const reactions = Array.isArray(m.reactions) ? m.reactions : [];
    const reactionGroups = {};
    reactions.forEach(r => {
      if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
      reactionGroups[r.emoji].push(r.user_id);
    });

    const bubble = el('div', { class: 'msg-bubble' });

    // Reply quote
    if (m.reply_to_id && state.byId.has(m.reply_to_id)) {
      const orig = state.byId.get(m.reply_to_id);
      const origName = orig.sender_id === user.id ? 'You' : (other()?.display_name || 'Friend');
      const origText = orig.deleted_at ? 'deleted' : (orig.content || '').slice(0, 60);
      bubble.appendChild(el('div', { class: 'msg-reply-quote', text: `${origName}: ${origText}` }));
    }

    // Content
    if (isDeleted) {
      bubble.appendChild(el('div', { style: 'font-style:italic;opacity:0.6;', text: content }));
    } else {
      const textNode = el('div', { text: content });
      if (m.edited_at) {
        textNode.appendChild(el('span', { style: 'font-size:10px;opacity:0.7;margin-left:6px;', text: '(edited)' }));
      }
      bubble.appendChild(textNode);
    }

    // Meta
    const meta = el('div', { class: 'msg-meta' }, [
      el('span', { text: formatTime(m.created_at) })
    ]);

    if (mine && !isDeleted) {
      const tick = el('span', { class: 'msg-tick' });
      tick.textContent = m.seen_at ? '✓✓' : '✓';
      if (m.seen_at) tick.classList.add('seen');
      meta.appendChild(tick);
    }
    bubble.appendChild(meta);

    // Message wrapper
    const wrap = el('div', {
      class: `msg ${mine ? 'msg-me' : 'msg-other'}`,
      dataset: { id: m.id }
    });
    wrap.appendChild(bubble);

    // Reactions row
    if (Object.keys(reactionGroups).length > 0) {
      const reactRow = el('div', { class: 'msg-reactions' });
      Object.entries(reactionGroups).forEach(([emoji, users]) => {
        const mineReacted = user && users.includes(user.id);
        const pill = el('div', {
          class: `reaction-pill ${mineReacted ? 'mine' : ''}`,
          text: `${emoji} ${users.length > 1 ? users.length : ''}`.trim(),
          onclick: () => toggleReaction(m.id, emoji)
        });
        reactRow.appendChild(pill);
      });
      wrap.appendChild(reactRow);
    }

    // Double-tap to react quickly (long press on mobile)
    let pressTimer = null;
    bubble.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => {
        openReactionPicker(m.id, wrap);
      }, 500);
    });
    bubble.addEventListener('pointerup', () => clearTimeout(pressTimer));
    bubble.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    bubble.addEventListener('pointercancel', () => clearTimeout(pressTimer));

    // Long press for actions (reply/edit/delete)
    bubble.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      openMessageActions(m);
    });

    return wrap;
  }

  // ─── Reaction picker ───
  function openReactionPicker(messageId, anchorEl) {
    const existing = document.querySelector('.reaction-picker');
    if (existing) existing.remove();

    const picker = el('div', {
      class: 'reaction-picker',
      style: 'position:fixed;z-index:300;display:flex;gap:6px;padding:8px 10px;background:rgba(20,16,42,0.98);border:1px solid var(--border-2);border-radius:999px;box-shadow:var(--shadow-xl);animation:scaleIn 240ms var(--ease-bounce);'
    });

    REACTION_EMOJIS.forEach(e => {
      picker.appendChild(el('button', {
        style: 'font-size:24px;padding:4px;background:none;border:none;cursor:pointer;transition:transform 200ms;',
        text: e,
        onmouseenter: (ev) => ev.target.style.transform = 'scale(1.3)',
        onmouseleave: (ev) => ev.target.style.transform = 'scale(1)',
        onclick: () => {
          toggleReaction(messageId, e);
          picker.remove();
        }
      }));
    });

    document.body.appendChild(picker);

    const rect = anchorEl.getBoundingClientRect();
    const pw = picker.offsetWidth;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
    let top = rect.top - picker.offsetHeight - 8;
    if (top < 8) top = rect.bottom + 8;
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';

    const dismiss = (ev) => {
      if (!picker.contains(ev.target)) {
        picker.remove();
        document.removeEventListener('pointerdown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss), 50);
  }

  // ─── Message actions (reply / edit / delete / copy) ───
  function openMessageActions(m) {
    const user = me();
    if (!user) return;
    const mine = m.sender_id === user.id;

    const actions = [];

    actions.push({
      label: '💬 Reply',
      variant: 'btn-ghost',
      onClick: () => {
        state.replyTo = m;
        updateComposeReply();
        return true;
      }
    });

    if (mine && !m.deleted_at) {
      actions.push({
        label: '✏️ Edit',
        variant: 'btn-ghost',
        keepOpen: true,
        onClick: () => {
          setTimeout(() => openEditPrompt(m), 100);
          return true;
        }
      });
      actions.push({
        label: '🗑️ Delete',
        variant: 'btn-danger',
        onClick: async () => {
          const ok = await window.VDUI.confirmDialog({
            title: 'Delete message?',
            desc: 'This will remove it for both of you.',
            confirmLabel: 'Delete',
            danger: true
          });
          if (ok) {
            window.VDSocket.Actions.chatDelete({ messageId: m.id });
          }
        }
      });
    }

    window.VDUI.modal({
      title: 'Message',
      desc: (m.content || '').slice(0, 80),
      actions
    });
  }

  function openEditPrompt(m) {
    const input = el('textarea', {
      style: 'width:100%;min-height:80px;padding:12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-1);font-family:inherit;font-size:15px;resize:vertical;',
      text: m.content || ''
    });

    window.VDUI.modal({
      title: 'Edit Message',
      body: input,
      actions: [
        { label: 'Cancel', variant: 'btn-ghost' },
        {
          label: 'Save',
          variant: 'btn-primary',
          onClick: () => {
            const newContent = input.value.trim();
            if (!newContent) return true;
            window.VDSocket.Actions.chatEdit({ messageId: m.id, content: newContent });
          }
        }
      ]
    });
    setTimeout(() => input.focus(), 100);
  }

  // ─── Reply banner ───
  function updateComposeReply() {
    const form = $('#form-chat');
    if (!form) return;
    let banner = form.querySelector('.compose-reply');
    if (!state.replyTo) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = el('div', {
        class: 'compose-reply',
        style: 'position:absolute;bottom:100%;left:0;right:0;padding:8px 14px;background:rgba(20,16,42,0.95);border-top:1px solid var(--border-2);display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-3);'
      });
      form.style.position = 'relative';
      form.appendChild(banner);
    }
    const preview = (state.replyTo.content || '').slice(0, 50);
    banner.innerHTML = '';
    banner.appendChild(el('div', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', text: '↩ Replying to: ' + preview }));
    banner.appendChild(el('button', {
      text: '✕',
      style: 'background:none;border:none;color:var(--text-3);font-size:16px;cursor:pointer;',
      onclick: () => { state.replyTo = null; updateComposeReply(); }
    }));
  }

  // ─── Add message to list ───
  function addMessage(m, scroll = true) {
    if (!m || !m.id) return;
    if (state.byId.has(m.id)) {
      // update existing
      const old = state.byId.get(m.id);
      Object.assign(old, m);
      reRenderMessage(m.id);
      return;
    }
    state.messages.push(m);
    state.byId.set(m.id, m);

    const list = $('#chat-list');
    if (!list) return;

    const node = renderMessage(m);
    if (node) list.appendChild(node);

    if (scroll) scrollToBottom();
  }

  function reRenderMessage(id) {
    const m = state.byId.get(id);
    if (!m) return;
    const wrap = document.querySelector(`.msg[data-id="${id}"]`);
    if (!wrap) return;
    const fresh = renderMessage(m);
    if (fresh) wrap.replaceWith(fresh);
  }

  function scrollToBottom() {
    const scroller = $('#chat-scroll');
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
      });
    }
  }

  // ─── Send message ───
  async function sendMessage(e) {
    if (e) e.preventDefault();
    const form = $('#form-chat');
    if (!form) return;
    const input = form.querySelector('input[name="message"]');
    const content = (input.value || '').trim();
    if (!content) return;

    input.value = '';
    stopTyping();

    const payload = { content };
    if (state.replyTo) {
      payload.replyToId = state.replyTo.id;
      state.replyTo = null;
      updateComposeReply();
    }

    const res = await window.VDSocket.Actions.chatSend(payload);
    if (!res?.ok) {
      toast(res?.error || 'Failed to send', 'error');
      input.value = content;
    }
  }

  // ─── Typing indicator ───
  function handleTyping() {
    const now = Date.now();
    if (now - state.lastTypingSent > 2000) {
      window.VDSocket.Actions.typingStart();
      state.lastTypingSent = now;
    }
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(stopTyping, 1500);
  }

  function stopTyping() {
    clearTimeout(state.typingTimer);
    window.VDSocket.Actions.typingStop();
  }

  // ─── Seen ───
  function markAllSeen() {
    const user = me();
    if (!user) return;
    const ids = state.messages
      .filter(m => m.sender_id !== user.id && !m.seen_at)
      .map(m => m.id);
    if (!ids.length) return;

    clearTimeout(state.seenTimer);
    state.seenTimer = setTimeout(() => {
      window.VDSocket.Actions.chatSeen({ messageIds: ids });
    }, 400);
  }

  // ─── Load history ───
  async function loadHistory() {
    try {
      const res = await Api.chatHistory(100);
      if (!res?.messages) return;
      const list = $('#chat-list');
      if (list) list.innerHTML = '';
      state.messages = [];
      state.byId.clear();
      res.messages.forEach(m => addMessage(m, false));
      scrollToBottom();
      markAllSeen();
    } catch (e) {
      console.warn('[chat] history failed', e.message);
    }
  }

  // ─── Bind realtime ───
  function bindRealtime() {
    if (!window.VDSocket) return;
    const S = window.VDSocket;

    S.on('chat:new', (m) => {
      addMessage(m, true);
      markAllSeen();
    });

    S.on('chat:edited', (m) => {
      const existing = state.byId.get(m.id);
      if (existing) Object.assign(existing, m);
      reRenderMessage(m.id);
    });

    S.on('chat:deleted', (d) => {
      const m = state.byId.get(d.messageId);
      if (m) {
        m.deleted_at = new Date().toISOString();
        m.content = null;
        reRenderMessage(m.id);
      }
    });

    S.on('chat:reaction', (d) => {
      const m = state.byId.get(d.messageId);
      if (!m) return;
      m.reactions = (d.reactions || []).flatMap(r => {
        const users = Array.isArray(r.users) ? r.users : [];
        return users.map(uid => ({ emoji: r.emoji, user_id: uid }));
      });
      reRenderMessage(m.id);
    });

    S.on('chat:seen', (d) => {
      const seenIds = new Set(d.seenIds || []);
      state.messages.forEach(m => {
        if (seenIds.has(m.id)) m.seen_at = new Date().toISOString();
      });
      seenIds.forEach(id => reRenderMessage(id));
    });

    S.on('typing:start', (d) => {
      const meUser = me();
      if (meUser && d.userId === meUser.id) return;
      const indicator = $('#chat-typing');
      if (indicator) {
        const nameNode = indicator.querySelector('[data-typing-name]');
        if (nameNode) nameNode.textContent = d.username || other()?.display_name || 'Friend';
        indicator.hidden = false;
      }
    });

    S.on('typing:stop', (d) => {
      const meUser = me();
      if (meUser && d.userId === meUser.id) return;
      const indicator = $('#chat-typing');
      if (indicator) indicator.hidden = true;
    });
  }

  // ─── Toggle reaction ───
  function toggleReaction(messageId, emoji) {
    window.VDSocket.Actions.chatReact({ messageId, emoji });
  }

  // ─── Init ───
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    const form = $('#form-chat');
    if (form) {
      form.addEventListener('submit', sendMessage);
      const input = form.querySelector('input[name="message"]');
      if (input) {
        input.addEventListener('input', handleTyping);
        input.addEventListener('blur', stopTyping);
      }
    }

    // Emoji quick-insert
    const emojiBtn = $('[data-action="chat-emoji"]');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', () => {
        const input = $('#form-chat input[name="message"]');
        if (!input) return;
        input.value += '😊';
        input.focus();
      });
    }

    bindRealtime();
  }

  // ─── On room entered — load history ───
  function onRoomEntered() {
    init();
    loadHistory();
  }

  window.VDChat = {
    init,
    onRoomEntered,
    markAllSeen,
    loadHistory,
    addMessage
  };
})();
