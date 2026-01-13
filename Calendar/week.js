// week.js
window.addEventListener("DOMContentLoaded", () => {
  console.log("WEEK.JS LOADED");
  // ===== DOM ELEMENTS =====
  const weekDaysContainer = document.getElementById("week-days");
  const weekRange = document.getElementById("week-range");
  const currentWeekEl = document.getElementById("current-week");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");
  const timeEl = document.getElementById("time");
  const dateEl = document.getElementById("date");
  const scheduleBody = document.getElementById("schedule-body");
  console.log("scheduleBody:", scheduleBody);


  // Event form elements
  const eventModal = document.getElementById("event-modal");
  const closeModalBtn = document.getElementById("close-modal");
  const eventForm = document.getElementById("cell-event-form");
  const eventStartDateInput = document.getElementById("cell-event-start-date");
  const eventEndDateInput = document.getElementById("cell-event-end-date");
  const eventStartInput = document.getElementById("cell-event-start-time");
  const eventEndInput = document.getElementById("cell-event-end-time");
  const eventTitleInput = document.getElementById("cell-event-title");
  const eventNotesInput = document.getElementById("cell-event-notes");
  const eventCancelBtn = document.getElementById("cancel-event-btn");
  const noTimeCheckbox = document.getElementById("no-time-checkbox");
  const addEventBtn = document.getElementById("add-event-btn");

  const createEventBtn = document.getElementById("create-event-btn");
  const updateEventBtn = document.getElementById("update-event-btn");
  const deleteEventBtn = document.getElementById("delete-event-btn");

  const eventCategoryInput = document.getElementById("event-category");
  const messageContainer = document.getElementById("message-container");

  // Only return early if a truly critical element is missing
  if (!scheduleBody) {
    console.error("Critical: scheduleBody not found. Timetable cannot render.");
    return;
  }
  if (!weekDaysContainer) {
    console.error("Critical: weekDaysContainer not found. Week header cannot render.");
    return;
  }
  // For event modal/form, just warn but do not return
  if (!eventModal) console.warn("Warning: eventModal not found.");
  if (!eventForm) console.warn("Warning: eventForm not found.");

  // ...existing code...

  if (updateEventBtn) {
    updateEventBtn.onclick = function(e) {
      e.preventDefault();
      if (eventForm) {
        eventForm.dispatchEvent(new Event('submit', {cancelable: true}));
      }
    };
  }

  console.log("DOM Elements loaded:", {
    weekDaysContainer: !!weekDaysContainer,
    weekRange: !!weekRange,
    createEventBtn: !!createEventBtn,
    updateEventBtn: !!updateEventBtn,
    deleteEventBtn: !!deleteEventBtn,
    eventForm: !!eventForm,
    eventCancelBtn: !!eventCancelBtn // Logged the corrected cancel button ID
  });

  // ===== GLOBAL STATE =====
  // Initialize currentWeekDate from ?date=YYYY-MM-DD query param if provided
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
  const dateParam = getQueryParam('date');
  let currentWeekDate = dateParam && dayjs(dateParam, 'YYYY-MM-DD').isValid() ? dayjs(dateParam, 'YYYY-MM-DD') : dayjs(); // Day.js object
  const debugMode = getQueryParam('debug') === '1';
  let editingEventId = null;

  // ===== HELPERS =====
  // Respect user's first-day preference saved in localStorage by settings.php
  const FIRST_DAY_KEY = 'calendar_first_day';
  const getFirstDayPref = () => localStorage.getItem(FIRST_DAY_KEY) || 'sunday';
  console.debug('week.js: calendar_first_day from localStorage =', getFirstDayPref());

  // If the server expects an authenticated user id, ensure we have it before
  // making read/create/update/delete requests. If missing, surface a clear
  // message in the UI and short-circuit network calls to avoid the server
  // returning the 'Missing date range or user ID' error.
  function getUserIdOrNotify(showNotify = true) {
    const uid = window.currentUserId ?? null;
    if (!uid && showNotify) {
      showMessage('You must be signed in to view or modify calendar events.', 'error');
    }
    return uid;
  }

  // Compute start of week without requiring isoWeek plugin.
  // Returns a dayjs object representing the first day (00:00) of the week
  // according to user's preference ('monday' or 'sunday').
  const startOfWeek = (d) => {
    const pref = getFirstDayPref();
    const day = dayjs(d);
    if (pref === 'monday') {
      // day.day(): 0 (Sunday) .. 6 (Saturday)
      const dow = (day.day() + 6) % 7; // Monday -> 0
      return day.subtract(dow, 'day').startOf('day');
    }
    // sunday -> start on Sunday
    return day.subtract(day.day(), 'day').startOf('day');
  };
  const endOfWeek = (d) => startOfWeek(d).add(6, 'day');
  const fmtYMD = (d) => dayjs(d).format("YYYY-MM-DD");

  // Safe compact formatter that tolerates dayjs Day objects or native Date
  function formatCompact(d) {
    try {
      if (d && typeof d.format === 'function') {
        const res = d.format('ddd D MMM');
        // some older shims or unexpected format implementations may return a full Date string
        if (typeof res === 'string' && res.includes('GMT')) {
          // fall back to native Date formatting
        } else {
          return res;
        }
      }
      const dt = d && d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) { return String(d); }
  }

  // ISO week number fallback when isoWeek plugin is not present.
  function isoWeekNumber(d) {
    try {
  // Use plain JS Date math to compute ISO week number to avoid depending
  // on Day.js plugins that may be missing in some environments.
  const date = (d && d instanceof Date) ? d : (dayjs && dayjs.isDayjs && dayjs.isDayjs(d) ? d.toDate() : new Date(d));
  // copy date
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday (0) become 7
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  // January 4th is always in week 1
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  // Calculate full weeks to nearest Thursday
  const weekNumber = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return weekNumber;
    } catch (e) {
      console.warn('isoWeekNumber fallback failed', e);
      return null;
    }
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
      const s = val.slice(0,5);
      return s;
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

  

  function showMessage(message, type = "success") {
    if (!messageContainer) { alert(message); return; }
    messageContainer.textContent = message;
    messageContainer.className = `message message-${type}`;
    setTimeout(() => {
      messageContainer.textContent = "";
      messageContainer.className = "message";
    }, 3000);
  }

  // ===== RENDER WEEK HEADER =====
  function renderWeekHeader() {
    if (!weekRange || !currentWeekEl) return;

    // We intentionally do NOT render the stacked vertical day/time block
    // that was previously inserted into `#week-days`. Hiding that element
    // removes the unwanted list seen under the blue header.
    if (weekDaysContainer) {
      weekDaysContainer.innerHTML = '';
      weekDaysContainer.style.display = 'none';
    }

  const start = startOfWeek(currentWeekDate);
    const end = start.add(6, 'day');

  // Display only dates (no time or timezone). Use YYYY-MM-DD to avoid locale/time
  // Show compact human-friendly dates without time or timezone
  weekRange.textContent = `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`;
  // Compute week number using pure-JS fallback
  const weekNum = isoWeekNumber(start.toDate ? start.toDate() : start) || '';
  currentWeekEl.textContent = weekNum ? `Week ${weekNum}` : '';
  // Show a compact single date like 'Mon 29 Dec'
  if (dateEl) dateEl.textContent = start.format('ddd D MMM');

  // Make the week header clickable so user can jump to a specific date or ISO week
  if (currentWeekEl) {
    currentWeekEl.style.cursor = 'pointer';
    currentWeekEl.title = 'Click to jump to a date (YYYY-MM-DD) or ISO week (YYYY-Wnn)';
    currentWeekEl.onclick = () => {
      try {
        const val = prompt('Enter date (YYYY-MM-DD) or ISO week (YYYY-W52):');
        if (!val) return;
        if (val.includes('-W')) {
          const parts = val.split('-W');
          if (parts.length === 2) {
            const y = parseInt(parts[0], 10);
            const w = parseInt(parts[1], 10);
            if (!isNaN(y) && !isNaN(w)) {
              // compute Monday of ISO week w in year y
              const monday = isoWeekStart(y, w);
              if (monday) {
                currentWeekDate = dayjs(monday);
                renderAll();
                return;
              }
            }
          }
          alert('Invalid ISO week format. Use YYYY-Wnn');
          return;
        }
        // otherwise try YYYY-MM-DD
        const dt = dayjs(val, 'YYYY-MM-DD');
        if (dt && dt.isValid && dt.isValid()) {
          currentWeekDate = dt;
          renderAll();
          return;
        }
        alert('Invalid date. Use YYYY-MM-DD or YYYY-Wnn');
      } catch (err) { console.error('jump-to-week error', err); }
    };
  }
  }

  // Compute the Monday (start) date of an ISO week given year and week number
  function isoWeekStart(year, week) {
    try {
      // Find the Thursday of the target week
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = (jan4.getUTCDay() + 6) % 7; // Monday=0
      // Date of the first Thursday of the year
      const firstThursday = new Date(jan4);
      firstThursday.setUTCDate(jan4.getUTCDate() - jan4Day + 3);
      // Target week's Thursday
      const targetThursday = new Date(firstThursday);
      targetThursday.setUTCDate(firstThursday.getUTCDate() + (week - 1) * 7);
      // Monday is 3 days before Thursday
      const monday = new Date(targetThursday);
      monday.setUTCDate(targetThursday.getUTCDate() - 3);
      return monday;
    } catch (e) { console.warn('isoWeekStart failed', e); return null; }
  }

  // ===== MODAL & FORM =====
  async function fetchAndPopulateCategories() {
    if (!eventCategoryInput) return;
    try {
      const res = await fetch("CRUD.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "categories" })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cats = await res.json();
      // Clear existing options and add a default "other" option
      eventCategoryInput.innerHTML = '';
      const otherOpt = document.createElement('option');
      otherOpt.value = 'other';
      otherOpt.textContent = 'Other';
      eventCategoryInput.appendChild(otherOpt);
      if (Array.isArray(cats)) {
        cats.forEach(c => {
          const opt = document.createElement('option');
          opt.value = String(c.id);
          opt.textContent = c.name;
          if (c.color) opt.dataset.color = c.color;
          eventCategoryInput.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      // Leave any existing options intact on error
    }
  }

  async function openForm(eventData = null, date = null, hour = null) {
    console.log('Entering openForm. eventData:', eventData, 'date:', date, 'hour:', hour);
    if (!eventModal || !eventForm) {
      console.error('Modal or form element not found.');
      return;
    }
    eventModal.style.display = 'block';
    eventForm.reset();

  if (eventData) {
      editingEventId = eventData.id ?? eventData.event_id ?? editingEventId;
      eventStartDateInput.value = eventData.event_start_date ? dayjs(eventData.event_start_date).format('YYYY-MM-DD') : '';
      eventEndDateInput.value = eventData.event_end_date ? dayjs(eventData.event_end_date).format('YYYY-MM-DD') : '';
      eventStartInput.value = eventData.event_start_time ? eventData.event_start_time.slice(0,5) : '';
      eventEndInput.value = eventData.event_end_time ? eventData.event_end_time.slice(0,5) : '';
      eventTitleInput.value = eventData.event_title || '';
      eventNotesInput.value = eventData.notes || '';
      // Ensure categories are populated before selecting
      await fetchAndPopulateCategories();
      const defaultCat = localStorage.getItem('calendar_default_category_id');
      const desiredRaw = (eventData.category !== undefined && eventData.category !== null) ? eventData.category : (defaultCat ? String(defaultCat) : 'other');
      const desired = String(desiredRaw);
      try { eventCategoryInput.value = desired; } catch (e) { /* ignore if value not present */ }
      // If the select didn't accept the desired value (for example backend returned a name while options use numeric ids),
      // try to find an option whose text matches the desired name (case-insensitive) and select its value.
      if (String(eventCategoryInput.value) !== desired) {
        const desiredName = String(desiredRaw).toLowerCase();
        const match = Array.from(eventCategoryInput.options).find(o => (o.textContent || '').toLowerCase() === desiredName);
        if (match) eventCategoryInput.value = match.value;
      }
  const isAllDay = !eventData.event_start_time && !eventData.event_end_time;
  noTimeCheckbox.checked = isAllDay;
  // Allow editing an all-day event by enabling the time inputs when the
  // user unchecks the "no time" checkbox. Default times are left empty
  // so user can set them explicitly.
  eventStartInput.disabled = isAllDay;
  eventEndInput.disabled = isAllDay;

      if (createEventBtn) createEventBtn.style.display = 'none';
      if (updateEventBtn) updateEventBtn.style.display = 'inline-block';
      if (deleteEventBtn) deleteEventBtn.style.display = 'inline-block';
      // Populate recurrence fields if present in payload
      try { document.getElementById('event-recurrence').value = eventData.recurrence || eventData.recurrence_rule || ''; } catch(e){}
      try { document.getElementById('event-recurrence-until').value = eventData.recurrence_until || eventData.recurrenceEnd || ''; } catch(e){}
      // Ensure scope selectors default to 'single'
      try { document.getElementById('event-update-scope').value = 'single'; } catch(e){}
      try { document.getElementById('event-delete-scope').value = 'single'; } catch(e){}
      // Show unlink button only when event appears to belong to a recurrence group
      try {
        const unlinkBtn = document.getElementById('unlink-event-btn');
        if (unlinkBtn) {
          const hasGroup = !!(eventData.recurrence_group_id || eventData.recurrence_group || eventData.recurrence_groupid);
          unlinkBtn.style.display = hasGroup ? 'inline-block' : 'none';
        }
      } catch(e) {}
    } else {
      editingEventId = null;
      eventStartDateInput.value = date || fmtYMD(dayjs());
      eventEndDateInput.value = date || fmtYMD(dayjs());
      eventStartInput.value = hour != null ? `${hour.toString().padStart(2,'0')}:00` : '';
      eventEndInput.value = '';
  await fetchAndPopulateCategories();
  const defaultCat = localStorage.getItem('calendar_default_category_id');
  try { eventCategoryInput.value = defaultCat ? String(defaultCat) : 'other'; } catch (e) { /* ignore */ }
  // Ensure default selection falls back to matching by name if needed
  if (String(eventCategoryInput.value) !== (defaultCat ? String(defaultCat) : 'other')) {
    const defName = String(defaultCat || '').toLowerCase();
    if (defName) {
      const match = Array.from(eventCategoryInput.options).find(o => (o.textContent || '').toLowerCase() === defName);
      if (match) eventCategoryInput.value = match.value;
    }
  }
      noTimeCheckbox.checked = false;
      eventStartInput.disabled = false;
      eventEndInput.disabled = false;

      if (createEventBtn) createEventBtn.style.display = 'inline-block';
      if (updateEventBtn) updateEventBtn.style.display = 'none';
      if (deleteEventBtn) deleteEventBtn.style.display = 'none';
  // Clear recurrence inputs for new events
  try { document.getElementById('event-recurrence').value = ''; } catch(e){}
  try { document.getElementById('event-recurrence-until').value = ''; } catch(e){}
  try { document.getElementById('event-update-scope').value = 'single'; } catch(e){}
  try { document.getElementById('event-delete-scope').value = 'single'; } catch(e){}
  try { const unlinkBtn = document.getElementById('unlink-event-btn'); if (unlinkBtn) unlinkBtn.style.display = 'none'; } catch(e){}
    }
  }

    // ===== HANDLERS: No-time checkbox toggling =====
    // Allow converting an all-day event into a timed event (and vice versa)
    if (noTimeCheckbox) {
      noTimeCheckbox.addEventListener('change', () => {
        const isNoTime = noTimeCheckbox.checked;
        if (eventStartInput) eventStartInput.disabled = isNoTime;
        if (eventEndInput) eventEndInput.disabled = isNoTime;
        // If the user is enabling times and the inputs are empty, provide sensible defaults
        if (!isNoTime) {
          if (eventStartInput && !eventStartInput.value) eventStartInput.value = '09:00';
          if (eventEndInput && !eventEndInput.value) eventEndInput.value = '10:00';
        } else {
          // When converting to all-day, clear times to avoid accidental submission
          if (eventStartInput) eventStartInput.value = '';
          if (eventEndInput) eventEndInput.value = '';
        }
      });
    }
  // No placeholder row if no events; timetable grid is always rendered above

  // ===== FETCH EVENTS FOR CURRENT WEEK =====
  function fetchAndRenderEvents() {
  console.log("fetchAndRenderEvents CALLED");
    const start = startOfWeek(currentWeekDate);
    const end   = start.add(6, "day");
    // Expand the fetch window so events that start before or end after the
    // visible week are included (covers multi-day events that cross week
    // boundaries). We expand by 7 days on each side as a safe buffer.
    const fetchStart = start.subtract(7, 'day');
    const fetchEnd = end.add(7, 'day');
    const userId = getUserIdOrNotify(false); // don't show an error for anonymous viewers
    if (!userId) {
      console.info('No user id present; backend requires id_users for read; skipping fetch.');
      showMessage('Sign in to see your personal events.', 'info');
      buildScheduleTable([]);
      return;
    }
    const payload = {
      action: "read",
      // Use the field names expected by the existing CRUD.php
      startDate: fetchStart.format("YYYY-MM-DD"),
      endDate: fetchEnd.format("YYYY-MM-DD"),
      // include id_users only when available
    };
  payload.id_users = userId;
    console.log('Fetch events payload (WEEK):', payload, {visibleStart: start.format('YYYY-MM-DD'), visibleEnd: end.format('YYYY-MM-DD')});
  console.log("About to fetch CRUD.php");
  fetch("CRUD.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(events => {
        console.log("Events received from backend:", events);
        if (!Array.isArray(events)) {
          console.error("Unexpected response (expected array):", events);
          showMessage("Unexpected data from server.", "error");
          buildScheduleTable([]);
          return;
        }
        buildScheduleTable(events);
      })
      .catch(err => {
        console.error("Fetch Error:", err);
        showMessage("Failed to load events: " + err.message, "error");
        buildScheduleTable([]);
      });
  }

  // ===== CREATE / UPDATE =====
  function handleFormSubmission(e) {
    e.preventDefault();
    console.log("handleFormSubmission triggered.");
    console.log("Current editingEventId:", editingEventId);

    if (!eventTitleInput.value.trim() || !eventStartDateInput.value.trim()) {
      showMessage("Event title and date are required.", "error");
      return;
    }

    const endDateValue = eventEndDateInput.value || eventStartDateInput.value;

    if (!noTimeCheckbox.checked && eventStartInput.value && eventEndInput.value && eventStartInput.value >= eventEndInput.value) {
      showMessage("End time must be after start time.", "error");
      return;
    }

    // Determine action based on whether we're editing an event
    const action = editingEventId ? "update" : "create";
    console.log("Determined action:", action);

    const payload = {
      action,
      event_id: editingEventId, // This will be null for create, and the ID for update
      event_start_date: eventStartDateInput.value,
      event_end_date: endDateValue,
      event_start_time: noTimeCheckbox.checked ? null : (eventStartInput.value ? eventStartInput.value + ":00" : null),
      event_end_time:   noTimeCheckbox.checked ? null : (eventEndInput.value ? eventEndInput.value + ":00" : null),
      event_title: eventTitleInput.value,
      notes: eventNotesInput.value,
      category: eventCategoryInput.value || "other",
  id_users: getUserIdOrNotify() || null
    };
    // attach recurrence info when present
    try { payload.recurrence = document.getElementById('event-recurrence')?.value || ''; } catch(e) {}
    try { payload.recurrence_until = document.getElementById('event-recurrence-until')?.value || ''; } catch(e) {}
    // If updating and user selected 'series', set update_series flag
    if (action === 'update') {
      try {
        const updateScope = document.getElementById('event-update-scope')?.value || 'single';
        if (updateScope === 'series') payload.update_series = 1;
      } catch(e) {}
    }
    console.log("week.js event form payload:", payload);

    // If user chose to update the whole series, confirm intent
    if (action === 'update') {
      try {
        const updateScope = document.getElementById('event-update-scope')?.value || 'single';
        if (updateScope === 'series' && !confirm('Update entire series? This will apply changes to all occurrences.')) return;
      } catch (e) {}
    }

    fetch("CRUD.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async res => {
        const raw = await res.text().catch(() => '');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = { __rawText: raw }; }
        if (parsed && typeof parsed === 'object') parsed.__httpStatus = res.status;
        return parsed;
      })
      .then(data => {
        if (data && data.status === "success") {
          console.log("Success, fetching events and closing form.");
          showMessage(action === "create" ? "Event added." : "Event updated.");
          fetchAndRenderEvents();
          closeForm();
        } else {
          // Surface the full server object to help diagnose DB/debug fields
          console.error("Server returned an error (full):", data);
          let userMsg = data?.message || data?.__rawText || "Unknown error";
          if (data?.debug) {
            console.error("Server debug:", data.debug);
            userMsg += " (debug available; see console)",
            userMsg = userMsg.replace(/,\s*$/, '');
          }
          if (data?.exception) {
            console.error("Server exception:", data.exception);
            userMsg += " (exception: " + data.exception + ")";
          }
          showMessage("Error: " + userMsg, "error");
        }
      })
      .catch(err => showMessage("Request failed: " + err.message, "error"));
  }

  // ===== DELETE =====
  function handleDelete() {
    if (!editingEventId) {
      console.warn("Delete called but editingEventId is null.");
      return;
    }
    const payload = { action: "delete", event_id: editingEventId };
    try {
      const delScope = document.getElementById('event-delete-scope')?.value || 'single';
      if (delScope === 'series') payload.delete_series = 1;
    } catch(e) {}

    // Confirm destructive delete of a series
    try {
      if (payload.delete_series && !confirm('Delete entire series? This cannot be undone.')) return;
    } catch(e) {}

    fetch("CRUD.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, payload, { id_users: getUserIdOrNotify() })) ,
    })
      .then(async res => {
        const raw = await res.text().catch(() => '');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = { __rawText: raw }; }
        if (parsed && typeof parsed === 'object') parsed.__httpStatus = res.status;
        return parsed;
      })
      .then(data => {
        if (data && data.status === "success") {
          showMessage("Event deleted.");
          fetchAndRenderEvents();
          closeForm();
        } else {
          console.error("Delete failed, server response:", data?.message || data?.__rawText || "Unknown error");
          showMessage("Error: " + (data?.message || data?.__rawText || "Unknown error"), "error");
        }
      })
      .catch(err => showMessage("Request failed: " + err.message, "error"));
  }


  // Attach unlink handler for week modal
  (function attachUnlinkHandler(){
    try {
      const unlinkBtn = document.getElementById('unlink-event-btn');
      if (!unlinkBtn) return;
      unlinkBtn.addEventListener('click', function(){
        if (!editingEventId) return;
        if (!confirm('Unlink this occurrence from its series? This will make it a standalone event.')) return;
        fetch('CRUD.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlink', event_id: editingEventId })
        })
        .then(async res => {
          const raw = await res.text().catch(() => '');
          let parsed;
          try { parsed = JSON.parse(raw); } catch (e) { parsed = { __rawText: raw }; }
          if (parsed && typeof parsed === 'object') parsed.__httpStatus = res.status;
          return parsed;
        })
        .then(data => {
          if (data && data.status === 'success') {
            showMessage('Event unlinked from series.');
            fetchAndRenderEvents();
            closeForm();
          } else {
            showMessage('Error: ' + (data?.message || data?.__rawText || 'Unknown error'), 'error');
          }
        })
        .catch(err => { console.error('Unlink failed', err); showMessage('Request failed: ' + err.message, 'error'); });
      });
    } catch(e) { /* silent */ }
  })();
  // ===== FORM CLOSE & TABLE BUILD =====
  function closeForm() {
    if (eventModal) eventModal.style.display = 'none';
    editingEventId = null;
    if (createEventBtn) createEventBtn.style.display = 'inline-block';
    if (updateEventBtn) updateEventBtn.style.display = 'none';
    if (deleteEventBtn) deleteEventBtn.style.display = 'none';
    if (eventForm) eventForm.reset();
  }

  function buildScheduleTable(events) {
    console.log('buildScheduleTable called with events:', events);
    // Normalize backend shapes: some responses serialize dates/times as
    // objects { date: 'YYYY-MM-DD HH:MM:SS.ffffff', timezone: ... }
    // Convert those to plain strings the client rendering expects.
    const normalize = (ev) => {
      const e = Object.assign({}, ev);
      const extractDate = (v) => {
        if (!v && v !== 0) return null;
        if (typeof v === 'string') return v.slice(0, 10);
        if (typeof v === 'object') {
          if (v.date && typeof v.date === 'string') return v.date.slice(0, 10);
          // fallback if object stores Date-like fields
          try { const d = new Date(v); if (!isNaN(d.getTime())) return dayjs(d).format('YYYY-MM-DD'); } catch (e) {}
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
          try { const d = new Date(v); if (!isNaN(d.getTime())) return dayjs(d).format('HH:mm:ss'); } catch (e) {}
        }
        return null;
      };
      e.event_start_date = extractDate(e.event_start_date) || e.event_start_date;
      e.event_end_date = extractDate(e.event_end_date) || e.event_end_date;
      e.event_date = extractDate(e.event_date) || e.event_start_date || e.event_end_date;
      e.event_start_time = extractTime(e.event_start_time) || e.event_start_time;
      e.event_end_time = extractTime(e.event_end_time) || e.event_end_time;
      // expose category_color fallback if missing
      e.category_color = e.category_color || e.category_color || null;
      return e;
    };
    try { events = Array.isArray(events) ? events.map(normalize) : events; } catch (err) { console.warn('Normalization failed', err); }
    let tbody = document.getElementById('schedule-body');
    if (!tbody) {
      console.error('schedule-body tbody not found in DOM.');
      return;
    }

    // If tbody exists but isn't inside a table, wrap it into a new table to avoid duplicate IDs
    let table = tbody.closest('table');
    if (!table) {
      console.warn('schedule-body found but not inside a <table>. Wrapping it into a new table.');
      const container = document.querySelector('.schedule-container') || document.body;
      const newTable = document.createElement('table');
      newTable.className = 'schedule-table';
      const newThead = document.createElement('thead');
      newTable.appendChild(newThead);
      // Move existing tbody into the new table (preserves existing DOM node and its id)
      newTable.appendChild(tbody);
      container.appendChild(newTable);
      table = newTable;
    }

    // Ensure thead exists on the table
    let thead = table.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      table.insertBefore(thead, table.firstChild);
    }

    // Use the tbody that's actually inside the table
    const tbodyFinal = table.querySelector('tbody') || tbody;
    tbodyFinal.id = 'schedule-body';
    thead.innerHTML = '';
    tbodyFinal.innerHTML = '';

    const start = startOfWeek(currentWeekDate);
    const headerRow = document.createElement('tr');
    const thTime = document.createElement('th');
    thTime.textContent = 'Time';
    headerRow.appendChild(thTime);
    for (let i = 0; i < 7; i++) {
      const th = document.createElement('th');
      const d = start.add(i, 'day');
      th.textContent = formatCompact(d);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

    const hasEvents = Array.isArray(events) && events.length > 0;
    for (let hour = 0; hour < 24; hour++) {
      const row = document.createElement('tr');
      const timeCell = document.createElement('td');
      timeCell.classList.add('time-cell');
      timeCell.textContent = `${hour.toString().padStart(2, '0')}:00`;
      row.appendChild(timeCell);
      for (let day = 0; day < 7; day++) {
        const date = start.add(day, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const cell = document.createElement('td');
        cell.classList.add('event-cell');
        cell.dataset.date = dateStr;
        cell.dataset.hour = String(hour);
        cell.addEventListener('click', () => openForm(null, dateStr, hour));

        if (hasEvents) {
          // Build a list of events that should appear in this cell (dateStr + hour)
          const eventsToRender = [];
          events.forEach(ev => {
            // Parse and normalize start/end; be defensive about missing end or time-overflow
            const rawStart = dayjs(ev.event_start_date);
            let rawEnd = ev.event_end_date ? dayjs(ev.event_end_date) : rawStart;
            // If times are provided and end time is before start time, assume it wraps to next day
            if (ev.event_start_time !== undefined && ev.event_end_time !== undefined && ev.event_start_time !== null && ev.event_end_time !== null) {
              const s = parseHourFromTime(ev.event_start_time);
              const e = parseHourFromTime(ev.event_end_time);
              if (!isNaN(s) && !isNaN(e) && e < s) {
                // end on next day
                rawEnd = rawEnd.add(1, 'day');
              }
            }
            const evStart = rawStart.startOf('day');
            const evEnd = rawEnd.startOf('day');
            const targetDate = dayjs(dateStr).startOf('day');

            // Inclusive coverage check
            const coversDate = (targetDate.isSame(evStart, 'day') || targetDate.isAfter(evStart, 'day')) && (targetDate.isSame(evEnd, 'day') || targetDate.isBefore(evEnd, 'day'));
            if (!coversDate) {
              if (debugMode) console.debug('Event does not cover target', { id: ev.event_id || ev.id, evStart: evStart.format('YYYY-MM-DD'), evEnd: evEnd.format('YYYY-MM-DD'), target: targetDate.format('YYYY-MM-DD') });
              return;
            }

            const hasStartTime = !!ev.event_start_time;
            const hasEndTime = !!ev.event_end_time;

            // No time specified (all-day spanning one or more days) -> show at 00:00
            if (!hasStartTime && !hasEndTime) {
              if (hour === 0) eventsToRender.push(ev);
              return;
            }

            // Parse hours (fallbacks)
            const sHr = hasStartTime ? parseHourFromTime(ev.event_start_time) : 0;
            const eHr = hasEndTime ? parseHourFromTime(ev.event_end_time) : (hasStartTime && !isNaN(sHr) ? sHr + 1 : 24);

            // Single-day timed event
            if (evStart.isSame(evEnd, 'day')) {
              if (hour >= sHr && hour < eHr) eventsToRender.push(ev);
            } else {
              // Multi-day event with times
              if (targetDate.isSame(evStart, 'day')) {
                // On the first day: show from start hour to midnight
                if (hour >= sHr) eventsToRender.push(ev);
              } else if (targetDate.isSame(evEnd, 'day')) {
                // On the last day: show from 00:00 up to end hour
                if (hour < eHr) eventsToRender.push(ev);
              } else {
                // Intermediate day: show once at 00:00
                if (hour === 0) eventsToRender.push(ev);
              }
            }
          });

            eventsToRender.forEach(event => {
            const box = document.createElement('div');
            box.className = 'event-box event';
            // Ensure a visible background even when category color is missing
            if (event.category_color) {
              box.style.backgroundColor = event.category_color;
              box.dataset.categoryColor = event.category_color;
            } else {
              box.style.backgroundColor = '#cce5ff';
              box.dataset.categoryColor = '';
            }
            // Ensure readable text color
            if (!box.style.color) box.style.color = '#000';
            // Ensure event boxes don't overlap the navbar and allow clicks to pass to top-level nav
            box.style.zIndex = '2';
            box.style.pointerEvents = 'auto';
            const timeRange = (event.event_start_time || event.event_end_time)
              ? `${getTimeString(event.event_start_time)}${event.event_end_time ? ' - ' + getTimeString(event.event_end_time) : ''}`
              : 'All day';
            box.innerHTML = `<strong>${event.event_title || '(Untitled)'}</strong><br><span>${timeRange}</span>${event.notes ? `<br><em>${event.notes}</em>` : ''}`;
            box.onclick = (e) => { e.stopPropagation(); openForm(event); };
            cell.appendChild(box);
          });
        }

        row.appendChild(cell);
      }
      tbodyFinal.appendChild(row);
    }

    // Ensure schedule container sits under the navbar and apply dark-mode styles
    (function applyScheduleTheme() {
      try {
        const scheduleContainer = document.querySelector('.schedule-container');
        if (scheduleContainer) {
          // keep the schedule below the navbar (navbar z-index is higher)
          scheduleContainer.style.zIndex = '1';
          scheduleContainer.style.position = scheduleContainer.style.position || 'relative';
        }

        const generatedTable = table || document.querySelector('.schedule-table');
        if (!generatedTable) return;

        const isDark = document.documentElement.classList.contains('dark-mode');
        if (isDark) {
          generatedTable.style.backgroundColor = '#000';
          generatedTable.style.color = '#fff';
          // style header and cells
          generatedTable.querySelectorAll('th, td').forEach(cell => {
            cell.style.backgroundColor = '#000';
            cell.style.color = '#fff';
            cell.style.borderColor = '#333';
          });
          // event boxes need a darker background if they don't already have color
          generatedTable.querySelectorAll('.event-box').forEach(b => {
            // Preserve explicit category colors stored on the element if present
            if (b.dataset && b.dataset.categoryColor) {
              b.style.backgroundColor = b.dataset.categoryColor;
            } else if (!b.style.backgroundColor) {
              b.style.backgroundColor = '#222';
            }
            b.style.color = '#fff';
            b.style.borderColor = '#444';
          });
        } else {
          // remove inline theme overrides when leaving dark mode
          generatedTable.style.backgroundColor = '';
          generatedTable.style.color = '';
          generatedTable.querySelectorAll('th, td').forEach(cell => {
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.style.borderColor = '';
          });
          generatedTable.querySelectorAll('.event-box').forEach(b => {
            // If a category color was provided, restore it; otherwise clear inline bg
            if (b.dataset && b.dataset.categoryColor) b.style.backgroundColor = b.dataset.categoryColor;
            else b.style.backgroundColor = '';
            b.style.color = '';
            b.style.borderColor = '';
          });
        }
      } catch (err) { console.error('applyScheduleTheme error', err); }
    })();
    // Add a visible debug dump so we can inspect returned events when UI looks empty
    try {
      // Only render the verbose debug dump when debugMode is enabled
      if (debugMode) {
        let wdbg = document.getElementById('__week_fetch_debug');
        if (!wdbg) {
          wdbg = document.createElement('pre');
          wdbg.id = '__week_fetch_debug';
          wdbg.style.position = 'fixed'; wdbg.style.right = '8px'; wdbg.style.top = '8px';
          wdbg.style.padding = '8px'; wdbg.style.background = 'rgba(0,0,0,0.75)'; wdbg.style.color = '#fff';
          wdbg.style.zIndex = '99999'; wdbg.style.maxHeight = '40vh'; wdbg.style.overflow = 'auto'; wdbg.style.fontSize = '12px';
          document.body.appendChild(wdbg);
        }
        wdbg.textContent = `week events: ${Array.isArray(events)?events.length:0}\n` + JSON.stringify(events, null, 2);
      } else {
        // Remove any existing debug dump when not in debug mode
        const existing = document.getElementById('__week_fetch_debug');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      }
    } catch (e) { console.warn('failed to render/cleanup week debug dump', e); }
  }

  // ===== NAV / CLOCK / INIT =====
  if (prevWeekBtn) prevWeekBtn.onclick = (e) => { if(e && e.preventDefault) e.preventDefault(); console.debug('week.js: prev-week clicked'); currentWeekDate = currentWeekDate.subtract(7, "day"); renderAll(); };
  if (nextWeekBtn) nextWeekBtn.onclick = (e) => { if(e && e.preventDefault) e.preventDefault(); console.debug('week.js: next-week clicked'); currentWeekDate = currentWeekDate.add(7, "day"); renderAll(); };

  // This button should open the form for adding a new event
  if (addEventBtn) addEventBtn.onclick = () => {
      console.log("Add New Event button clicked.");
      openForm(null, fmtYMD(dayjs()), null); // Clear previous data, set current date/time
  };

  // This button is now explicitly tied to the delete action
  if (deleteEventBtn) deleteEventBtn.onclick = handleDelete;

  // The form submission listener handles both create and update actions
  if (eventForm) {
    eventForm.addEventListener("submit", handleFormSubmission);
  }

  if (eventModal) {
    // Use addEventListener instead of assigning window.onclick to avoid overwriting
    // other global click handlers used by the header dropdown.
    window.addEventListener('click', function _weekModalOutsideClick(e) {
      try {
        if (e.target === eventModal) closeForm();
      } catch (err) { console.error('modal outside click handler error', err); }
    });
  }

  // Hook the explicit close button (the 'X') to close the modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeForm();
    });
  }

  function updateTime() {
    if (timeEl) timeEl.textContent = dayjs().format("HH:mm:ss");
  }
  setInterval(updateTime, 1000);

  function renderAll() {
    console.log("renderAll CALLED");
    renderWeekHeader();
    fetchAndRenderEvents();
    updateTime();
  }
  // Initial render (must be after function definition)
  renderAll();
  console.log("DOMContentLoaded callback reached end");

  // Reapply schedule theme after initial render and when preferences change
  function reapplyScheduleStyling() {
    try {
      // small delay to ensure table exists
      setTimeout(() => {
        const evt = new Event('reapply-schedule-theme');
        window.dispatchEvent(evt);
      }, 80);
    } catch (err) { console.error('reapplyScheduleStyling error', err); }
  }

  // Listen for custom event to reapply styling (used above)
  window.addEventListener('reapply-schedule-theme', () => {
    try {
      // Attempt to reuse the inline function created earlier by calling fetchAndRenderEvents -> buildScheduleTable
      // If schedule table already exists, call the same styling logic used at end of buildScheduleTable
      const generatedTable = document.querySelector('.schedule-table');
      if (!generatedTable) return;
      const isDark = document.documentElement.classList.contains('dark-mode');
      generatedTable.querySelectorAll('th, td').forEach(cell => {
        if (isDark) { cell.style.backgroundColor = '#000'; cell.style.color = '#fff'; cell.style.borderColor = '#333'; }
        else { cell.style.backgroundColor = ''; cell.style.color = ''; cell.style.borderColor = ''; }
      });
      generatedTable.querySelectorAll('.event-box').forEach(b => {
        if (isDark) { if (!b.style.backgroundColor) b.style.backgroundColor = '#222'; b.style.color = '#fff'; }
        else { b.style.backgroundColor = ''; b.style.color = ''; }
      });
      const scheduleContainer = document.querySelector('.schedule-container');
      if (scheduleContainer) scheduleContainer.style.zIndex = '1';
    } catch (err) { console.error('reapply-schedule-theme handler error', err); }
  });

  // Listen for preference change events (dispatched from settings page)
  window.addEventListener('calendarPrefChanged', (ev) => {
    try {
      const detail = ev && ev.detail;
      if (!detail) return;
      if (detail.key === 'firstDay') {
        console.debug('week.js: received calendarPrefChanged.firstDay ->', detail.value);
        // Re-render the week with the new first-day preference
        renderAll();
      }
  // If the theme changed, reapply schedule theme
  if (detail.key === 'darkMode' || detail.key === 'palette') reapplyScheduleStyling();
    } catch (err) { console.error('Error handling calendarPrefChanged', err); }
  });

  // Expose a convenience setter that other pages/console can call
  window.setCalendarFirstDay = (val) => {
    try {
      localStorage.setItem('calendar_first_day', val);
      window.dispatchEvent(new CustomEvent('calendarPrefChanged', { detail: { key: 'firstDay', value: val } }));
    } catch (err) { console.error('setCalendarFirstDay error', err); }
  };

  // Cross-tab: listen for storage events so changes in other tabs/windows
  // (for example when the user saves settings in a different tab) will
  // cause this page to re-read preferences and re-render.
  window.addEventListener('storage', (e) => {
    try {
      if (!e) return;
      if (e.key === FIRST_DAY_KEY) {
        console.debug('week.js: storage event detected for', e.key, 'newValue=', e.newValue);
        // No need to set localStorage here; just re-render which will pick up the new value
        renderAll();
      }
  if (e.key === 'calendar_dark_mode' || e.key === 'calendar_palette' || e.key === 'calendar_palette_bg' || e.key === 'calendar_palette_accent') {
        // Theme or palette changed in another tab; reapply schedule styling after a short delay
        reapplyScheduleStyling();
      }
    } catch (err) { console.error('Error handling storage event', err); }
  });
});