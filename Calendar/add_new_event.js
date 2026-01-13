window.addEventListener('DOMContentLoaded', () => {
  // Simple modal/form logic adapted from week.js
  const eventModal = document.getElementById('event-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const eventForm = document.getElementById('cell-event-form');
  const createEventBtn = document.getElementById('create-event-btn');
  const updateEventBtn = document.getElementById('update-event-btn');
  const deleteEventBtn = document.getElementById('delete-event-btn');
  const cancelBtn = document.getElementById('cancel-event-btn');
  const eventCategoryInput = document.getElementById('event-category');

  async function fetchAndPopulateCategories() {
    if (!eventCategoryInput) return;
    try {
      const res = await fetch('CRUD.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'categories' })
      });
      if (!res.ok) return;
      const cats = await res.json();
      eventCategoryInput.innerHTML = '';
      const otherOpt = document.createElement('option');
      otherOpt.value = 'other'; otherOpt.textContent = 'Other';
      eventCategoryInput.appendChild(otherOpt);
      if (Array.isArray(cats)) {
        cats.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id ?? c.value ?? c.name ?? c;
          opt.textContent = c.name ?? c.label ?? c;
          eventCategoryInput.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function openForm() {
    await fetchAndPopulateCategories();
    if (eventModal) eventModal.style.display = 'block';
    if (createEventBtn) createEventBtn.style.display = 'inline-block';
    if (updateEventBtn) updateEventBtn.style.display = 'none';
    if (deleteEventBtn) deleteEventBtn.style.display = 'none';
  }

  function closeForm() {
    if (eventModal) eventModal.style.display = 'none';
    if (eventForm) eventForm.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeForm);
  if (cancelBtn) cancelBtn.addEventListener('click', closeForm);
  window.addEventListener('click', (e) => { if (e.target === eventModal) closeForm(); });

  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const payload = {
        action: 'create',
        event_start_date: form.querySelector('#cell-event-start-date')?.value || null,
        event_end_date: form.querySelector('#cell-event-end-date')?.value || null,
        event_start_time: form.querySelector('#cell-event-start-time')?.value || null,
        event_end_time: form.querySelector('#cell-event-end-time')?.value || null,
        event_title: form.querySelector('#cell-event-title')?.value || '',
        notes: form.querySelector('#cell-event-notes')?.value || '',
        category: form.querySelector('#event-category')?.value || 'other',
        id_users: window.currentUserId || null,
        // recurrence fields — backend expects ISO 8601 duration tokens like P1D, P1W, P4W, P1M, P1Y
        recurrence: form.querySelector('#event-recurrence')?.value || '',
        recurrence_until: form.querySelector('#event-recurrence-until')?.value || ''
      };
      try {
        console.debug('create: payload', payload);
        const res = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const raw = await res.text().catch(()=>null);
        console.debug('create: raw response', raw, 'status', res.status);
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch(e) { data = null; }
        if (!res.ok) {
          console.error('CRUD create failed', res.status, raw);
          alert('Create failed: ' + (raw || res.status));
          try { window.calendarNotify.show('Create failed', { background: '#c0392b' }); } catch(e){}
          return;
        }
        if (data && data.status === 'success') {
          // Show a brief success message, then redirect to month view
          const msg = document.createElement('div');
          msg.textContent = 'Event created successfully. Redirecting to month view...';
          msg.style.position = 'fixed';
          msg.style.top = '12px';
          msg.style.left = '50%';
          msg.style.transform = 'translateX(-50%)';
          msg.style.background = '#2fc5f3';
          msg.style.color = '#fff';
          msg.style.padding = '8px 12px';
          msg.style.borderRadius = '6px';
          msg.style.zIndex = '100001';
          document.body.appendChild(msg);
          try { window.calendarNotify.show('Event created', { browser: { title: 'Event created' } }); } catch(e){}
          setTimeout(() => {
            window.location.href = 'month.php';
          }, 900);
        } else {
          alert('Failed to create event: ' + (raw || JSON.stringify(data)));
        }
      } catch (err) {
        console.error('Create event failed:', err);
        alert('Request failed');
      }
    });
  }

  // Update event — wire the button to send update with optional series flag
  if (updateEventBtn) {
    updateEventBtn.addEventListener('click', async () => {
      const form = eventForm;
      const eventId = document.getElementById('event-id')?.value || null;
      if (!eventId) { alert('No event selected to update'); return; }
      const updateScope = document.getElementById('event-update-scope')?.value || 'single';
      const payload = {
        action: 'update',
        event_id: parseInt(eventId, 10),
        event_start_date: form.querySelector('#cell-event-start-date')?.value || null,
        event_end_date: form.querySelector('#cell-event-end-date')?.value || null,
        event_start_time: form.querySelector('#cell-event-start-time')?.value || null,
        event_end_time: form.querySelector('#cell-event-end-time')?.value || null,
        event_title: form.querySelector('#cell-event-title')?.value || '',
        notes: form.querySelector('#cell-event-notes')?.value || '',
        category: form.querySelector('#event-category')?.value || 'other',
        id_users: window.currentUserId || null,
        recurrence: form.querySelector('#event-recurrence')?.value || '',
        recurrence_until: form.querySelector('#event-recurrence-until')?.value || ''
      };
      if (updateScope === 'series') payload.update_series = 1;
      if (!confirm('Confirm update?')) return;
      try {
        console.debug('update: payload', payload);
        const res = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const raw = await res.text().catch(()=>null);
        console.debug('update: raw response', raw, 'status', res.status);
        let data = null; try { data = raw ? JSON.parse(raw) : null; } catch(e){ data = null; }
        if (res.ok && data && data.status === 'success') {
          window.location.reload();
        } else {
          console.error('Update response', res.status, raw);
          alert('Update failed: ' + (raw || res.status));
        }
      } catch (err) { console.error('Update failed', err); alert('Update request failed: ' + err.message); }
    });
  }

  // Delete event
  if (deleteEventBtn) {
    deleteEventBtn.addEventListener('click', async () => {
      const eventId = document.getElementById('event-id')?.value || null;
      if (!eventId) { alert('No event selected to delete'); return; }
      const delScope = document.getElementById('event-delete-scope')?.value || 'single';
      const payload = { action: 'delete', event_id: parseInt(eventId, 10) };
      if (delScope === 'series') payload.delete_series = 1;
      if (!confirm('Confirm delete? This may remove multiple events if "Entire series" selected.')) return;
      try {
        console.debug('delete: payload', payload);
        const res = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const raw = await res.text().catch(()=>null);
        console.debug('delete: raw response', raw, 'status', res.status);
        let data = null; try { data = raw ? JSON.parse(raw) : null; } catch(e){ data = null; }
        if (res.ok && data && data.status === 'success') {
          window.location.href = 'month.php';
        } else {
          console.error('Delete response', res.status, raw);
          alert('Delete failed: ' + (raw || res.status));
        }
      } catch (err) { console.error('Delete failed', err); alert('Delete request failed: ' + err.message); }
    });
  }

  // Unlink a single event from its recurrence group (make it independent)
  const unlinkBtn = document.getElementById('unlink-event-btn');
  if (unlinkBtn) {
    unlinkBtn.addEventListener('click', async () => {
      const eventId = document.getElementById('event-id')?.value || null;
      if (!eventId) { alert('No event selected to unlink'); return; }
      const payload = { action: 'unlink', event_id: parseInt(eventId, 10) };
      if (!confirm('Confirm unlink: make this occurrence independent from its series?')) return;
      try {
        console.debug('unlink: payload', payload);
        const res = await fetch('CRUD.php', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const raw = await res.text().catch(()=>null);
        console.debug('unlink: raw response', raw, 'status', res.status);
        let data = null; try { data = raw ? JSON.parse(raw) : null; } catch(e){ data = null; }
        if (res.ok && data && data.status === 'success') window.location.reload();
        else {
          console.error('Unlink response', res.status, raw);
          alert('Unlink failed: ' + (raw || res.status));
        }
      } catch (err) { console.error('Unlink failed', err); alert('Unlink request failed: ' + err.message); }
    });
  }

  // Auto-open the form on this page
  async function fetchSingleEvent(eventId) {
    try {
      const res = await fetch('CRUD.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_event', event_id: parseInt(eventId, 10), id_users: window.currentUserId || null })
      });
      if (!res.ok) return null;
      const evt = await res.json();
      return evt && evt.id ? evt : null;
    } catch (err) { console.error('Failed to fetch event', err); return null; }
  }

  function populateFormForEdit(evt) {
    if (!evt) return;
    // ensure categories are loaded
    try { document.getElementById('event-id').value = evt.id || '';} catch(e){}
    try { document.getElementById('cell-event-start-date').value = evt.event_start_date || '' } catch(e){}
    try { document.getElementById('cell-event-end-date').value = evt.event_end_date || '' } catch(e){}
    try { document.getElementById('cell-event-start-time').value = evt.event_start_time || '' } catch(e){}
    try { document.getElementById('cell-event-end-time').value = evt.event_end_time || '' } catch(e){}
    try { document.getElementById('cell-event-title').value = evt.event_title || '' } catch(e){}
    try { document.getElementById('cell-event-notes').value = evt.notes || '' } catch(e){}
    try { document.getElementById('event-recurrence').value = evt.recurrence || '' } catch(e){}
    try { document.getElementById('event-recurrence-until').value = evt.recurrence_until || '' } catch(e){}
    // set category if numeric id exists, else try name
    try {
      const catEl = document.getElementById('event-category');
      if (catEl) {
        const val = (typeof evt.category !== 'undefined' && evt.category !== null) ? String(evt.category) : (evt.category_name || 'other');
        // try to set; if option not present, append it
        const optExists = !!Array.from(catEl.options).find(o=>o.value == val);
        if (!optExists) {
          const o = document.createElement('option'); o.value = val; o.textContent = evt.category_name || val; catEl.appendChild(o);
        }
        catEl.value = val;
      }
    } catch (e) { console.warn('category set failed', e); }

    // checkbox for all-day
    try {
      const noTime = document.getElementById('no-time-checkbox');
      if (noTime) {
        const hasStart = !!evt.event_start_time;
        const hasEnd = !!evt.event_end_time;
        noTime.checked = !(hasStart || hasEnd);
      }
    } catch(e){}

    // toggle buttons: show update/delete, hide create
    try { if (createEventBtn) createEventBtn.style.display = 'none'; } catch(e){}
    try { if (updateEventBtn) updateEventBtn.style.display = 'inline-block'; } catch(e){}
    try { if (deleteEventBtn) deleteEventBtn.style.display = 'inline-block'; } catch(e){}
    // show unlink only if recurrence_group_id exists
    try {
      const unlinkBtn = document.getElementById('unlink-event-btn');
      if (unlinkBtn) unlinkBtn.style.display = evt.recurrence_group_id ? 'inline-block' : 'none';
    } catch(e){}

    // populate event-info UI
    try {
      const info = document.getElementById('event-info');
      if (info) {
        const idEl = document.getElementById('event-info-id');
        const grpEl = document.getElementById('event-info-group');
        if (idEl) idEl.textContent = evt.id || '';
        if (grpEl) grpEl.textContent = evt.recurrence_group_id || '(none)';
        info.style.display = 'block';
      }
    } catch(e){}
  }

  async function init() {
    await openForm();
    const params = new URLSearchParams(window.location.search);
    if (params.has('event_id')) {
      const id = params.get('event_id');
      const evt = await fetchSingleEvent(id);
      if (evt) {
        populateFormForEdit(evt);
      } else {
        console.warn('Event not found or failed to load:', id);
      }
    }
  }

  init();
});
