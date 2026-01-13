window.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const monthYearEl = document.getElementById("month-year");
  const yearLabelEl = document.getElementById("year-label");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const prevYearBtn = document.getElementById("prev-year");
  const nextYearBtn = document.getElementById("next-year");

  let currentDate = new Date();

  function pad(n) { return n.toString().padStart(2, "0"); }
  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function fetchEventsAndRender() {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const rawUid = typeof window.currentUserId !== 'undefined' ? window.currentUserId : null;
  const userId = (rawUid === null || rawUid === undefined) ? null : rawUid;
    // Removed debug badge and verbose payload logging; skip fetch if no user id
    if (!userId) {
      console.info('month.js: no currentUserId present; calendar will be empty until sign-in.');
      renderCalendar([]);
      return;
    }

    fetch("CRUD.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10), id_users: userId })
    })
    .then(res => res.text().then(txt => {
      // Try to parse JSON; if server returned HTML (PHP warnings/errors), warn and abort
      try {
        return JSON.parse(txt);
      } catch (e) {
        console.warn('month.js: server returned non-JSON response', txt);
        throw new Error('Invalid JSON from server');
      }
    }))
    .then(events => {
      try {
        if (!Array.isArray(events)) {
          console.warn('month.js: unexpected server response for read:', events);
          renderCalendar([]);
          return;
        }
      } catch(e) { /* ignore */ }
      renderCalendar(events);
    })
    .catch(err => {
      console.error('month.js fetch error:', err);
      renderCalendar([]);
    });
  }

  function renderCalendar(events) {
    calendarEl.innerHTML = "";
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYearEl.textContent = currentDate.toLocaleString("default", { month: "long" });
    yearLabelEl.textContent = year;

    const totalDays = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  // Respect user preference: if Monday-first, shift so Monday is first column;
  // if Sunday-first, keep native Sunday=0 mapping.
  const savedFirst = localStorage.getItem('calendar_first_day') || 'sunday';
  console.debug('style.js: calendar_first_day from localStorage =', savedFirst);
  const offset = (savedFirst === 'monday') ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
    let dayCounter = 1;

    for (let i = 0; i < offset; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-day empty";
      calendarEl.appendChild(emptyCell);
    }

    // Fill actual days
    for (let day = 1; day <= totalDays; day++) {
      const dayStr = `${year}-${pad(month+1)}-${pad(day)}`;
      const cell = document.createElement("div");
      cell.className = "calendar-day";

      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

          // Show events that cover this day (multi-day support)
          // helper: parse various shapes into Date
          function parseEventDate(val) {
            if (!val) return null;
            if (typeof val === 'string' || typeof val === 'number') {
              const d = new Date(val);
              return isNaN(d) ? null : d;
            }
            if (typeof val === 'object') {
              // common shapes: { date: 'YYYY-MM-DD' } or { year, month, day }
              if (val.date && typeof val.date === 'string') {
                const d = new Date(val.date);
                if (!isNaN(d)) return d;
              }
              if (val.year && val.month && val.day) {
                const y = parseInt(val.year,10);
                const m = parseInt(val.month,10) - 1;
                const dd = parseInt(val.day,10);
                const d = new Date(y, m, dd);
                if (!isNaN(d)) return d;
              }
              // fallback: try toString
              try {
                const s = val.toString();
                const d = new Date(s);
                if (!isNaN(d)) return d;
              } catch (e) {}
            }
            return null;
          }

          function parseHourFromTime(val) {
            if (!val && val !== 0) return NaN;
            if (typeof val === 'string') {
              const parts = val.split(':');
              return parseInt(parts[0], 10);
            }
            if (typeof val === 'number') return Math.floor(val);
            if (typeof val === 'object') {
              // common shapes: { hours: 9, minutes: 30 } or { hour: 9 }
              const h = val.hours ?? val.hour ?? val.h ?? val.H;
              if (typeof h === 'number') return Math.floor(h);
              if (typeof h === 'string') return parseInt(h, 10);
            }
            return NaN;
          }

          const dayEvents = (events || []).filter(ev => {
            try {
              const evStart = parseEventDate(ev.event_start_date);
              let evEnd = parseEventDate(ev.event_end_date) || parseEventDate(ev.event_start_date);
              if (!evStart || !evEnd) return false;
              // If times exist and end time is earlier than start time, assume it wraps to next day
              if ((ev.event_start_time || ev.event_end_time) && (ev.event_start_time !== undefined && ev.event_end_time !== undefined)) {
                const sHr = parseHourFromTime(ev.event_start_time);
                const eHr = parseHourFromTime(ev.event_end_time);
                if (!isNaN(sHr) && !isNaN(eHr) && eHr < sHr) {
                  evEnd = new Date(evEnd.getTime() + 24 * 60 * 60 * 1000);
                }
              }
              // Normalize to date-only comparison
              evStart.setHours(0,0,0,0);
              evEnd.setHours(0,0,0,0);
              const target = new Date(year, month, day);
              target.setHours(0,0,0,0);
              return target >= evStart && target <= evEnd;
            } catch (err) {
              console.warn('Error parsing event date for month view', ev, err);
              return false;
            }
          });
          dayEvents.forEach(ev => {
            const line = document.createElement("div");
            line.className = "event-line";
            line.style.backgroundColor = ev.category_color || "#888";
            // For multi-day events we simply show the title in the month cell
            line.textContent = ev.event_title;
            cell.appendChild(line);
          });

          cell.addEventListener("click", () => {
            // Navigate to the week view for the clicked day
            const target = `week.php?date=${dayStr}`;
            window.location.href = target;
          });

      calendarEl.appendChild(cell);
    }
  }

  // Render weekday header labels in the page (calendar.php has a .calendar-week-days container)
  function renderWeekdayLabels() {
    const container = document.querySelector('.calendar-week-days');
    if (!container) return;
    const savedFirst = localStorage.getItem('calendar_first_day') || 'sunday';
    const sundayFirst = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const mondayFirst = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const labels = (savedFirst === 'monday') ? mondayFirst : sundayFirst;
    container.innerHTML = '';
    labels.forEach(l => {
      const d = document.createElement('div');
      d.textContent = l;
      container.appendChild(d);
    });
  }

  // Navigation
  prevMonthBtn?.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()-1); fetchEventsAndRender(); });
  nextMonthBtn?.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()+1); fetchEventsAndRender(); });
  prevYearBtn?.addEventListener("click", () => { currentDate.setFullYear(currentDate.getFullYear()-1); fetchEventsAndRender(); });
  nextYearBtn?.addEventListener("click", () => { currentDate.setFullYear(currentDate.getFullYear()+1); fetchEventsAndRender(); });

  fetchEventsAndRender();

  // Also render weekday labels on init
  renderWeekdayLabels();

  // Cross-tab: listen for storage changes so month view updates when
  // preferences are changed in another tab (settings page save).
  window.addEventListener('storage', (e) => {
    try {
      if (!e) return;
      if (e.key === 'calendar_first_day') {
        console.debug('style.js: storage event detected for', e.key, 'newValue=', e.newValue);
        // Update weekday labels and re-render calendar which will pick up the updated preference
        renderWeekdayLabels();
        fetchEventsAndRender();
      }
    } catch (err) { console.error('style.js storage event error', err); }
  });
});
