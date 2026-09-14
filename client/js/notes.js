/* ═══════════════════════════════════════════════════════
   VINAY DUO — Shared Notes Module
   Made by VP
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const { $, el, escape, toast } = window.VDUI;
  const Api = window.VDApi;

  const state = {
    notes: [],
    loaded: false
  };

  // ─── Load notes via API (fallback local for now) ───
  // Backend route /api/notes/list will be added in next phase.
  // For now, notes are stored in localStorage per-room so they persist
  // locally between the two members if both are on the same browser.
  // Server-side sync will be enabled when the route ships.

  function storageKey() {
    const room = window.__vd_current_room;
    return room ? `vd_notes_${room.id}` : 'vd_notes';
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function writeLocal(notes) {
    try { localStorage.setItem(storageKey(), JSON.stringify(notes)); } catch {}
  }

  async function load(force = false) {
    if (state.loaded && !force) return;
    const list = $('#notes-list');
    if (!list) return;

    // Try API first
    try {
      const res = await Api._get?.('/notes/list');
      if (res?.notes) {
        state.notes = res.notes;
        state.loaded = true;
        render();
        return;
      }
    } catch {}

    // Fallback: local storage
    state.notes = readLocal();
    state.loaded = true;
    render();
  }

  function render() {
    const list = $('#notes-list');
    if (!list) return;
    list.innerHTML = '';

    if (!state.notes.length) {
      list.innerHTML = '';
      list.appendChild(el('div', { class: 'empty', style: 'grid-column:1/-1;' }, [
        el('div', { class: 'empty-icon', text: '📝' }),
        el('div', { class: 'empty-title', text: 'No notes yet' }),
        el('div', { class: 'empty-text', text: 'Tap "New" to add plans, ideas, or moments you both want to remember.' })
      ]));
      return;
    }

    state.notes
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .forEach(n => list.appendChild(renderNote(n)));
  }

  function renderNote(note) {
    const card = el('div', { class: 'card card-hover', onclick: () => openEditor(note) }, [
      el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;'
      }, [
        el('div', {
          style: 'font-family:var(--font-display);font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;',
          text: note.title || 'Untitled'
        }),
        note.pinned ? el('span', { text: '📌' }) : null
      ].filter(Boolean)),
      el('div', {
        style: 'font-size:13px;color:var(--text-3);line-height:1.5;max-height:80px;overflow:hidden;',
        text: (note.content || '').slice(0, 140) || '(empty)'
      }),
      el('div', {
        style: 'font-size:10px;color:var(--text-4);margin-top:10px;letter-spacing:0.06em;text-transform:uppercase;',
        text: 'Updated ' + window.VDUI.timeAgo(note.updated_at)
      })
    ]);
    return card;
  }

  function openEditor(existing) {
    const isNew = !existing;
    const titleInput = el('input', {
      type: 'text',
      placeholder: 'Title',
      value: existing?.title || '',
      style: 'width:100%;padding:12px;margin-bottom:10px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-1);font-family:inherit;font-size:15px;font-weight:600;'
    });
    const contentInput = el('textarea', {
      placeholder: 'Write something…',
      style: 'width:100%;min-height:180px;padding:12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-1);font-family:inherit;font-size:14px;resize:vertical;line-height:1.5;'
    });
    contentInput.value = existing?.content || '';

    const body = el('div', {}, [titleInput, contentInput]);

    const actions = [];
    if (!isNew) {
      actions.push({
        label: '🗑️ Delete',
        variant: 'btn-danger',
        onClick: () => {
          state.notes = state.notes.filter(n => n.id !== existing.id);
          writeLocal(state.notes);
          render();
          toast('Note deleted', 'info');
        }
      });
    }
    actions.push({
      label: 'Save',
      variant: 'btn-primary',
      onClick: () => {
        const title = titleInput.value.trim() || 'Untitled';
        const content = contentInput.value;

        if (isNew) {
          state.notes.push({
            id: 'local_' + Date.now(),
            title,
            content,
            pinned: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else {
          const idx = state.notes.findIndex(n => n.id === existing.id);
          if (idx >= 0) {
            state.notes[idx] = {
              ...state.notes[idx],
              title, content,
              updated_at: new Date().toISOString()
            };
          }
        }
        writeLocal(state.notes);
        render();
        toast('Note saved', 'success');
      }
    });

    window.VDUI.modal({
      title: isNew ? 'New Note' : 'Edit Note',
      body,
      actions
    });

    setTimeout(() => (isNew ? titleInput : contentInput).focus(), 100);
  }

  function init() {
    const newBtn = document.querySelector('[data-action="new-note"]');
    if (newBtn) newBtn.addEventListener('click', () => openEditor(null));
  }

  window.VDNotes = {
    init,
    load,
    render
  };
})();
