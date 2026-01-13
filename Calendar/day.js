document.addEventListener('DOMContentLoaded', () => {
  console.debug('day.js: DOMContentLoaded fired. currentUserId=', window.currentUserId);
  // ===== DOM ELEMENTS =====
    const addEventBtn = document.getElementById("add-event-btn");
    const eventModal = document.getElementById("event-modal");
    const closeModalBtn = document.getElementById("close-modal");
    const eventForm = document.getElementById("cell-event-form");
    const eventStartDateInput = document.getElementById("cell-event-start-date");
    const eventEndDateInput = document.getElementById("cell-event-end-date");
    const eventStartInput = document.getElementById("cell-event-start");
    const eventEndInput = document.getElementById("cell-event-end");
    const eventTitleInput = document.getElementById("cell-event-title");
    const eventNotesInput = document.getElementById("cell-event-notes");
    const eventCancelBtn = document.getElementById("cell-event-cancel");
    const noTimeCheckbox = document.getElementById("no-time-checkbox");
    const deleteEventBtn = document.getElementById("cell-event-delete");
    const eventCategoryInput = document.getElementById("event-category");
    const createEventBtn = document.getElementById("cell-event-create");
    const updateEventBtn = document.getElementById("cell-event-update");
    const messageContainer = document.getElementById("message-container");
    const eventList = document.getElementById("event-list");
    const datePickerInput = document.getElementById("date-picker-input");
    const dayDisplayEl = document.getElementById('day-display');
    console.debug('day.js: dayDisplayEl present?', !!dayDisplayEl, 'dayDisplayEl=', dayDisplayEl);

    function updateDayDisplay(dateStr) {
      console.debug('day.js:updateDayDisplay called with', dateStr);
      try {
        if (!dayDisplayEl) { console.warn('day.js: #day-display not found'); return; }
        // use dayjs for consistent formatting when available
        if (typeof dayjs !== 'undefined') {
          dayDisplayEl.textContent = dayjs(dateStr).format('ddd D MMM YYYY');
        } else {
          dayDisplayEl.textContent = dateStr;
        }
      } catch (e) {
        console.error('day.js:updateDayDisplay error', e);
        try { dayDisplayEl.textContent = dateStr; } catch (err) { /* ignore */ }
      }
    }

    // Reusable navigation helper for day view
    function changeDay(offset) {
      try {
        const _dp = document.getElementById('date-picker-input');
        const current = new Date((_dp && _dp.value) ? _dp.value : fmtYMD(new Date()));
        current.setDate(current.getDate() + Number(offset));
        const newVal = fmtYMD(current);
        if (_dp) _dp.value = newVal;
        updateDayDisplay(newVal);
        try { fetchEventsForDay(newVal); } catch(e) { /* may be defined later */ }
        console.debug('day.js: changeDay', offset, newVal);
      } catch (e) { console.warn('day.js: changeDay error', e); }
    }

    // Make prev/next visually clickable and ensure nested <pre> doesn't swallow clicks
    (function stylePrevNext(){
      try {
        // support both naming conventions used across templates
        const prevIds = ['prev-day','datePrev'];
        const nextIds = ['next-day','dateNext'];
        const prev = prevIds.map(id => document.getElementById(id)).find(x=>x);
        const next = nextIds.map(id => document.getElementById(id)).find(x=>x);
        [prev, next].forEach(el => {
          if (!el) return;
          el.style.cursor = 'pointer';
          // expose as an interactive element for accessibility
          try { el.setAttribute('role','button'); el.setAttribute('tabindex','0'); } catch(e){}
          // keyboard activation (Enter/Space)
          el.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } });
          // if there's a <pre> inside, let the parent span handle clicks
          const p = el.querySelector && el.querySelector('pre');
          if (p) p.style.pointerEvents = 'none';
        });
        console.debug('day.js: prev/next styled and keyboard-ready');
      } catch(e) { /* ignore */ }
    })();

    let editingEventId = null;

    function fmtYMD(date) {
      // Use local date parts to avoid UTC shifts from toISOString()
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

  // Helpers to parse time values which may be strings like "09:00:00",
  // "09:00", numbers (hours), or objects ({hours:9} or {hour:9}).
  function parseHourFromTime(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'string') {
      const parts = val.split(':');
      const h = parseInt(parts[0], 10);
      return isNaN(h) ? NaN : h;
    }
    if (typeof val === 'number') return Math.floor(val);
    if (typeof val === 'object') {
      const h = val.hours ?? val.hour ?? val.h ?? val.H;
      if (typeof h === 'number') return Math.floor(h);
      if (typeof h === 'string') return parseInt(h, 10);
    }
    return NaN;
  }



  function getTimeString(val) {
    // Return 'HH:MM' or empty string
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
      // support 'HH:MM:SS' or 'HH:MM'
      return val.slice(0,5);
    }
    if (typeof val === 'number') {
      const hh = String(Math.floor(val)).padStart(2,'0');
      return `${hh}:00`;
    }
    if (typeof val === 'object') {
      const h = val.hours ?? val.hour ?? val.h ?? val.H;
      const m = val.minutes ?? val.min ?? val.m ?? 0;
      if (h !== undefined) {
        const hh = String(Number(h)).padStart(2,'0');
        const mm = String(Number(m || 0)).padStart(2,'0');
        return `${hh}:${mm}`;
      }
      try { return String(val).slice(0,5); } catch (e) { return ''; }
    }
    return '';
  }

  

  function getWeekRange(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [fmtYMD(monday), fmtYMD(sunday)];
  }

  function showMessage(message, type = "success") {
    if (!messageContainer) { alert(message); return; }
    messageContainer.textContent = message;
    messageContainer.className = `message message-${type}`;
    setTimeout(() => {
      messageContainer.textContent = "";
      messageContainer.className = "message";
    }, 3000);
  }

  function openForm(eventData = null) {
    (async () => {
      if (!eventModal || !eventForm) return;
      eventModal.style.display = "block";
      eventForm.reset();
      if (eventData) {
      // Set editingEventId robustly for both id and event_id
      editingEventId = eventData.event_id !== undefined ? eventData.event_id : (eventData.id !== undefined ? eventData.id : null);
      console.log("[openForm] Editing event, editingEventId:", editingEventId, eventData);
      eventStartDateInput.value = eventData.event_start_date || "";
      eventEndDateInput.value = eventData.event_end_date || "";
      eventStartInput.value = eventData.event_start_time ? eventData.event_start_time.slice(0, 5) : "";
      eventEndInput.value = eventData.event_end_time ? eventData.event_end_time.slice(0, 5) : "";
      eventTitleInput.value = eventData.event_title || "";
      eventNotesInput.value = eventData.notes || "";
      // Populate categories and select appropriate value
      try {
        const res = await fetch("CRUD.php", {
          method: "POST",
            credentials: 'same-origin',
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "categories" })
        });
        if (res.ok) {
          const cats = await res.json();
          eventCategoryInput.innerHTML = '';
          const otherOpt = document.createElement('option');
          otherOpt.value = 'other'; otherOpt.textContent = 'Other';
          eventCategoryInput.appendChild(otherOpt);
          if (Array.isArray(cats)) cats.forEach(c => {
            const opt = document.createElement('option'); opt.value = String(c.id); opt.textContent = c.name; if (c.color) opt.dataset.color = c.color; eventCategoryInput.appendChild(opt);
          });
        }
      } catch (err) { console.error('Failed to load categories (day.js):', err); }
      const defaultCat = localStorage.getItem('calendar_default_category_id');
      const desiredRaw = (eventData.category !== undefined && eventData.category !== null) ? eventData.category : (defaultCat ? String(defaultCat) : 'other');
      const desiredVal = String(desiredRaw);
      try { eventCategoryInput.value = desiredVal; } catch (e) { /* ignore */ }
      if (String(eventCategoryInput.value) !== desiredVal) {
        const desiredName = String(desiredRaw).toLowerCase();
        const match = Array.from(eventCategoryInput.options).find(o => (o.textContent || '').toLowerCase() === desiredName);
        if (match) eventCategoryInput.value = match.value;
      }
      const isAllDay = !eventData.event_start_time && !eventData.event_end_time;
  if (typeof noTimeCheckbox !== 'undefined' && noTimeCheckbox) noTimeCheckbox.checked = isAllDay;
  if (eventStartInput) eventStartInput.disabled = isAllDay;
  if (eventEndInput) eventEndInput.disabled = isAllDay;
      createEventBtn.style.display = 'none';
      updateEventBtn.style.display = 'inline-block';
      deleteEventBtn.style.display = 'inline-block';
  // populate recurrence fields
  try { document.getElementById('event-recurrence').value = eventData.recurrence || eventData.recurrence_rule || ''; } catch(e){}
  try { document.getElementById('event-recurrence-until').value = eventData.recurrence_until || eventData.recurrenceEnd || ''; } catch(e){}
  try { document.getElementById('event-update-scope').value = 'single'; } catch(e){}
  try { document.getElementById('event-delete-scope').value = 'single'; } catch(e){}
  try { const unlinkBtn = document.getElementById('cell-event-unlink'); if (unlinkBtn) unlinkBtn.style.display = (!!(eventData.recurrence_group_id || eventData.recurrence_group)) ? 'inline-block' : 'none'; } catch(e){}
    } else {
      editingEventId = null;
      console.log("[openForm] Creating new event, editingEventId:", editingEventId);
      const today = datePickerInput?.value || fmtYMD(new Date());
      eventStartDateInput.value = today;
      eventEndDateInput.value = today;
      eventStartInput.value = "";
      eventEndInput.value = "";
      try {
        const res2 = await fetch("CRUD.php", {
          method: "POST",
            credentials: 'same-origin',
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "categories" })
        });
        if (res2.ok) {
          const cats2 = await res2.json();
          eventCategoryInput.innerHTML = '';
          const otherOpt2 = document.createElement('option'); otherOpt2.value = 'other'; otherOpt2.textContent = 'Other'; eventCategoryInput.appendChild(otherOpt2);
          if (Array.isArray(cats2)) cats2.forEach(c => { const opt = document.createElement('option'); opt.value = String(c.id); opt.textContent = c.name; if (c.color) opt.dataset.color = c.color; eventCategoryInput.appendChild(opt); });
        }
      } catch (err) { console.error('Failed to load categories (day.js new):', err); }
      const defaultCat2 = localStorage.getItem('calendar_default_category_id');
      try { eventCategoryInput.value = defaultCat2 ? String(defaultCat2) : 'other'; } catch (e) { /* ignore */ }
      if (String(eventCategoryInput.value) !== (defaultCat2 ? String(defaultCat2) : 'other')) {
        const defName = String(defaultCat2 || '').toLowerCase();
        if (defName) {
          const match = Array.from(eventCategoryInput.options).find(o => (o.textContent || '').toLowerCase() === defName);
          if (match) eventCategoryInput.value = match.value;
        }
  }
  // set checkbox state if present (use runtime lookup to avoid ReferenceError)
  const _nt_present2 = document.getElementById('no-time-checkbox');
  if (_nt_present2) _nt_present2.checked = false;
  if (eventStartInput) eventStartInput.disabled = false;
  if (eventEndInput) eventEndInput.disabled = false;
      createEventBtn.style.display = 'inline-block';
      updateEventBtn.style.display = 'none';
      deleteEventBtn.style.display = 'none';
  try { document.getElementById('event-recurrence').value = ''; } catch(e){}
  try { document.getElementById('event-recurrence-until').value = ''; } catch(e){}
  try { document.getElementById('event-update-scope').value = 'single'; } catch(e){}
  try { document.getElementById('event-delete-scope').value = 'single'; } catch(e){}
  try { const unlinkBtn = document.getElementById('cell-event-unlink'); if (unlinkBtn) unlinkBtn.style.display = 'none'; } catch(e){}
    }
    })();
  }
  function closeForm() {
    if (eventModal) eventModal.style.display = "none";
    editingEventId = null;
    if (createEventBtn) createEventBtn.style.display = 'inline-block';
    if (updateEventBtn) updateEventBtn.style.display = 'none';
    if (deleteEventBtn) deleteEventBtn.style.display = 'none';
  }
  if (typeof closeModalBtn !== 'undefined' && closeModalBtn) closeModalBtn.onclick = closeForm;
  if (typeof eventCancelBtn !== 'undefined' && eventCancelBtn) eventCancelBtn.onclick = closeForm;
  // Attach change handler using runtime lookup to avoid ReferenceError if element is not present
  (function attachNoTimeHandler(){
    try {
      const _nt = document.getElementById('no-time-checkbox');
      if (!_nt) return;
      _nt.addEventListener('change', () => {
        if (eventStartInput) eventStartInput.disabled = _nt.checked;
        if (eventEndInput) eventEndInput.disabled = _nt.checked;
      });
    } catch (e) { /* silent */ }
  })();

  function renderEvents(events) {
    eventList.innerHTML = "";
    if (!Array.isArray(events) || events.length === 0) {
      eventList.innerHTML = '<p>No events found for this week.</p>';
      return;
    }
    // Expand multi-day events into each date they cover, then group by day
    const expanded = [];
    if (!Array.isArray(events)) events = [];
    events.forEach(evRaw => {
      // Normalize backend shapes like PHP's DateTime serializations
      const ev = Object.assign({}, evRaw);
      const extractDate = (v) => {
        if (!v && v !== 0) return '';
        if (typeof v === 'string') return v.slice(0,10);
        if (typeof v === 'object') {
          if (v.date && typeof v.date === 'string') return v.date.slice(0,10);
          try { const d = new Date(v); if (!isNaN(d.getTime())) return fmtYMD(d); } catch(e){}
        }
        return String(v).slice(0,10);
      };
      const extractTime = (v) => {
        if (!v && v !== 0) return null;
        if (typeof v === 'string') return v.slice(0,8);
        if (typeof v === 'object') {
          if (v.date && typeof v.date === 'string') {
            const parts = v.date.split(' ');
            if (parts[1]) return parts[1].split('.')[0];
          }
          try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toTimeString().slice(0,8); } catch(e){}
        }
        return null;
      };
      ev.event_start_date = extractDate(ev.event_start_date || ev.event_date);
      ev.event_end_date = extractDate(ev.event_end_date || ev.event_date);
      ev.event_start_time = extractTime(ev.event_start_time);
      ev.event_end_time = extractTime(ev.event_end_time);

      try {
        // Some backends return a different field name or include a datetime string.
        // rawStartStr and rawEndStr are YYYY-MM-DD
        const rawStartStr = (ev.event_start_date || ev.event_date || ev.start_date || '').toString().slice(0,10);
        const rawEndStr = (ev.event_end_date || ev.event_date || ev.end_date || rawStartStr).toString().slice(0,10);
        if (!rawStartStr) {
          if (typeof ev === 'object') console.debug('Skipping event with no start date:', ev);
          return;
        }
        // Use explicit T00:00:00 to avoid timezone parsing surprises
        const start = new Date(rawStartStr + 'T00:00:00');
        let end = new Date(rawEndStr + 'T00:00:00');
        // If times exist and end time is earlier than start time, assume it wraps to next day
        if (ev.event_start_time && ev.event_end_time) {
          const sHr = parseHourFromTime(ev.event_start_time);
          const eHr = parseHourFromTime(ev.event_end_time);
          if (!isNaN(sHr) && !isNaN(eHr) && eHr < sHr) {
            end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          }
        }
        // Normalize to start-of-day and iterate
        let cur = new Date(start);
        cur.setHours(0,0,0,0);
        const last = new Date(end);
        last.setHours(0,0,0,0);
        while (cur <= last) {
          expanded.push({ ...ev, _display_date: fmtYMD(cur), _orig_start: rawStartStr, _orig_end: rawEndStr });
          cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
        }
      } catch (err) {
        console.warn('Error expanding event for day view', ev, err);
      }
    });
  // debug: expanded events count suppressed in production

    // Group by _display_date
    const grouped = {};
    expanded.forEach(ev => {
      const day = ev._display_date;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(ev);
    });

    Object.keys(grouped).sort().forEach(day => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "event-day-header";
      dayHeader.textContent = day;
      eventList.appendChild(dayHeader);
      grouped[day].forEach(ev => {
        const box = document.createElement("div");
        box.className = "event-box";
        if (ev.category_color) {
          box.style.backgroundColor = ev.category_color;
        }
        // Determine display times per-day. For intermediate days of a multi-day timed event
        // show it at 00:00 (so it appears at the top of that day), while the start and
        // end days show original times where available.
        const origStart = ev._orig_start || (ev.event_start_date || '').toString().slice(0,10);
        const origEnd = ev._orig_end || (ev.event_end_date || ev.event_start_date || '').toString().slice(0,10);
          let displayStart = 'All day';
          let displayEnd = getTimeString(ev.event_end_time);
          if (ev.event_start_time) {
            if (ev._display_date === origStart) {
              displayStart = getTimeString(ev.event_start_time);
            } else {
              // intermediate day of a timed multi-day -> show at 00:00
              displayStart = '00:00';
            }
          }
        // If the event ends on this display date, and has an end time, show it as range
        if (ev.event_end_time && ev._display_date === origEnd) {
          displayEnd = getTimeString(ev.event_end_time);
        }
  const timeText = displayEnd ? `${displayStart} - ${displayEnd}` : displayStart;
  box.innerHTML = `
          <strong>${ev.event_title || "(Untitled)"}</strong><br>
          <span>${timeText}</span><br>
          ${ev.notes ? `<em>${ev.notes}</em>` : ""}
        `;
        box.onclick = () => openForm(ev);
        eventList.appendChild(box);
      });
    });
  }

  function fetchEventsForDay(dateStr) {
    const [startDate, endDate] = getWeekRange(dateStr);
    // Robustly detect current user id (allow 0 or numeric string)
    const rawUid = typeof window.currentUserId !== 'undefined' ? window.currentUserId : null;
    const userId = (rawUid === null || rawUid === undefined) ? null : rawUid;

    // Don't create a persistent debug overlay in production; fall back to console logs
    if (!userId) {
      console.info(`No user id; skipping fetch for ${startDate} → ${endDate}`);
      showMessage('Sign in to see your personal events.', 'info');
      renderEvents([]);
      return;
    }

  const payload = { action: "read", startDate, endDate };
  payload.id_users = userId;
  console.debug('day.js: fetching events with payload', payload);

  // overlay removed

    fetch("CRUD.php", {
      method: "POST",
    credentials: 'same-origin',
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(async res => {
      const raw = await res.text().catch(() => '');
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = { __rawText: raw }; }
      if (parsed && typeof parsed === 'object') parsed.__httpStatus = res.status;
      return parsed;
    })
    .then(events => {
      try {
        if (!Array.isArray(events)) {
          // Server returned an error object or unexpected payload — surface it
          console.warn('day.js: unexpected server response for read:', events);
          showMessage('Server response: ' + (events?.message || JSON.stringify(events)), 'error');
          renderEvents([]);
          return;
        }
        console.info(`day.js: returned ${events.length} events for ${startDate} → ${endDate}`);
  /* overlay removed */
      } catch(e) { /* ignore dbg failures */ }
  // verbose debug suppressed in production

      renderEvents(events);
    })
    .catch(err => {
      console.error('day.js fetch error:', err);
      showMessage("Failed to load events: " + err.message, "error");
    });
  }

  // Add Event button — attach at runtime to avoid ReferenceError when element not in DOM
  (function attachAddEvent(){
    try {
      const _btn = document.getElementById('add-event-btn');
      if (!_btn) return;
      _btn.addEventListener('click', () => openForm());
    } catch(e) { /* silent */ }
  })();

  // Form submission — attach at runtime to avoid referencing missing form element
  (function attachFormSubmit(){
    try {
      const _form = document.getElementById('cell-event-form');
      if (!_form) return;
      _form.addEventListener('submit', function(e) {
        e.preventDefault();
        const isUpdate = editingEventId !== null && editingEventId !== undefined;
        // Safely read no-time state: checkbox may be missing in some templates
        const _nt = document.getElementById('no-time-checkbox');
        const noTime = (_nt && _nt.checked) ? true : false;
        const payload = {
          action: isUpdate ? "update" : "create",
          event_id: isUpdate ? editingEventId : undefined,
          event_start_date: eventStartDateInput ? eventStartDateInput.value : null,
          event_end_date: eventEndDateInput ? eventEndDateInput.value : null,
          event_start_time: noTime ? null : (eventStartInput && eventStartInput.value ? eventStartInput.value + ":00" : null),
          event_end_time:   noTime ? null : (eventEndInput && eventEndInput.value ? eventEndInput.value + ":00" : null),
          event_title: eventTitleInput ? eventTitleInput.value : "",
          notes: eventNotesInput ? eventNotesInput.value : "",
          category: eventCategoryInput ? eventCategoryInput.value || "other" : "other",
          id_users: window.currentUserId || null
        };
        // attach recurrence fields
        try { payload.recurrence = document.getElementById('event-recurrence')?.value || ''; } catch(e) {}
        try { payload.recurrence_until = document.getElementById('event-recurrence-until')?.value || ''; } catch(e) {}
        // if updating and scope set to series
        if (isUpdate) {
          try { if (document.getElementById('event-update-scope')?.value === 'series') payload.update_series = 1; } catch(e) {}
        }
        fetch("CRUD.php", {
          method: "POST",
            credentials: 'same-origin',
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.status === "success") {
            showMessage(isUpdate ? "Event updated." : "Event added.");
            fetchEventsForDay(eventStartDateInput ? eventStartDateInput.value : fmtYMD(new Date()));
            closeForm();
          } else {
            showMessage("Error: " + (data?.message || "Unknown error"), "error");
          }
        })
        .catch(err => { console.error('Request failed (day.js):', err); showMessage("Request failed: " + err.message, "error"); });
      });
    } catch (e) { /* silent */ }
  })();
  // Attach update handler using runtime lookup
  (function attachUpdateHandler(){
    try {
      const _u = document.getElementById('cell-event-update');
      if (!_u) return;
      _u.addEventListener('click', function(e) {
        e.preventDefault();
        if (editingEventId !== null && editingEventId !== undefined) {
          const _f = document.getElementById('cell-event-form');
          if (_f) _f.dispatchEvent(new Event('submit', {cancelable: true}));
        }
      });
    } catch (e) { /* silent */ }
  })();

  // Delete event
  if (typeof deleteEventBtn !== 'undefined' && deleteEventBtn) deleteEventBtn.onclick = function() {
    if (!editingEventId) return;
    const payload = { action: "delete", event_id: editingEventId };
    try { if (document.getElementById('event-delete-scope')?.value === 'series') payload.delete_series = 1; } catch(e) {}
    fetch("CRUD.php", {
      method: "POST",
    credentials: 'same-origin',
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.status === "success") {
        showMessage("Event deleted.");
        fetchEventsForDay(eventStartDateInput.value);
        closeForm();
      } else {
        showMessage("Error: " + (data?.message || "Unknown error"), "error");
      }
    })
    .catch(err => { console.error('Delete request failed (day.js):', err); showMessage("Request failed: " + err.message, "error"); });
  };

  // Unlink from series handler (runtime lookup)
  (function attachUnlinkHandler(){
    try {
      const unlinkBtn = document.getElementById('cell-event-unlink');
      if (!unlinkBtn) return;
      unlinkBtn.addEventListener('click', function(){
        if (!editingEventId) return;
        if (!confirm('Unlink this occurrence from its series? This will make it a standalone event.')) return;
        fetch('CRUD.php', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlink', event_id: editingEventId })
        }).then(res => res.json()).then(data => {
          if (data && data.status === 'success') {
            showMessage('Event unlinked from series.');
            fetchEventsForDay(eventStartDateInput.value);
            closeForm();
          } else {
            showMessage('Error: ' + (data?.message || 'Unknown error'), 'error');
          }
        }).catch(err => { console.error('Unlink failed', err); showMessage('Request failed: ' + err.message, 'error'); });
      });
    } catch(e) { /* silent */ }
  })();

  // Date picker navigation (use runtime lookup and guards)
  (function attachDatePicker(){
    try {
      const _dp = document.getElementById('date-picker-input');
      if (!_dp) return;
  _dp.value = fmtYMD(new Date());
  // show initial date text
  console.debug('day.js: initializing date picker with', _dp.value);
  updateDayDisplay(_dp.value);
  _dp.addEventListener('change', function() { console.debug('day.js: date-picker change', this.value); updateDayDisplay(this.value); fetchEventsForDay(this.value); });
  fetchEventsForDay(_dp.value);

      // Delegated click handler so nested elements (eg <pre>) don't intercept clicks
      const container = document.getElementById('date-picker-container') || document;
      container.addEventListener('click', function(evt){
        // accept either naming convention
        const target = evt.target.closest && evt.target.closest ? evt.target.closest('#prev-day, #next-day, #datePrev, #dateNext') : null;
          if (!target) return;
          const id = target.id;
          if (id === 'prev-day' || id === 'datePrev') changeDay(-1);
          if (id === 'next-day' || id === 'dateNext') changeDay(1);
      });

      // If templates use datePrev/dateNext (todo.php), attach direct handlers so click/key events reliably update the picker
      try {
        const directPrev = document.getElementById('datePrev');
        const directNext = document.getElementById('dateNext');
        if (directPrev) directPrev.addEventListener('click', function(){ changeDay(-1); });
        if (directNext) directNext.addEventListener('click', function(){ changeDay(1); });
      } catch(e) { /* ignore */ }

      // Also attach handlers to the explicit prev/next buttons (they sit outside the date-picker container)
      try {
        const btnPrev = document.getElementById('prev-day');
        const btnNext = document.getElementById('next-day');
        if (btnPrev) btnPrev.addEventListener('click', function(e){ if(e && e.preventDefault) e.preventDefault(); changeDay(-1); });
        if (btnNext) btnNext.addEventListener('click', function(e){ if(e && e.preventDefault) e.preventDefault(); changeDay(1); });
      } catch(e) { /* ignore */ }

      // Document-level fallback: catch clicks anywhere and map inner <pre> clicks to parent spans
      document.addEventListener('click', function(evt){
  const pre = evt.target.closest && evt.target.closest ? evt.target.closest('#prev-day pre, #next-day pre, #datePrev pre, #dateNext pre') : null;
        if (!pre) return;
        const span = pre.parentElement;
        if (!span) return;
  const id = span.id;
  if (id === 'prev-day' || id === 'datePrev') changeDay(-1);
  if (id === 'next-day' || id === 'dateNext') changeDay(1);
  console.debug('day.js: document-level prev/next click -> id:', id);
      }, { capture: true });
    } catch(e) { /* silent */ }
  })();
});