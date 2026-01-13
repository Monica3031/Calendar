<?php
// Initialize session and authentication before any output so cookies can be set
require_once __DIR__ . '/assets/auth.php';
error_log('SESSION user_id (week.php): ' . ($_SESSION['user_id'] ?? 'not set'));
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Weekly Calendar</title>
    <script>
      // Ensure theme class is applied early to avoid flash
      try {
        const m = localStorage.getItem('calendar_dark_mode') || 'system';
        if (m === 'dark') document.documentElement.classList.add('dark-mode');
        else if (m === 'light') document.documentElement.classList.remove('dark-mode');
        else {
          // system: let CSS handle prefers-color-scheme but remove any stale class
        }
      } catch (e) { console.warn('theme init failed', e); }
    </script>
  <link rel="stylesheet" href="week.css" />
    <style>
      /* Inline overrides to ensure horizontal scrolling and left alignment on this page.
         These use !important so they win over other global styles without editing them. */
      html, body {
        overflow-x: auto !important;
        overflow-y: visible !important;
        justify-content: flex-start !important;
        align-items: flex-start !important;
      }
      /* ensure container sits at the left edge and doesn't add extra left padding */
      .container { padding-left: 0 !important; margin-left: 0 !important; }
      .calendar { margin-left: 0 !important; }
  /* Ensure navbar dropdown appears above the calendar/schedule - rely on global css for z-index */
  .navbar { position: relative; }
  .dropdown-content { position: absolute; z-index: 100000 !important; }
  /* Keep calendar below the navbar */
  .calendar { position: relative; z-index: 1; }
    </style>
    <script>
      window.currentUserId = <?php echo json_encode($_SESSION['user_id'] ?? null); ?>;
    </script>
  </head>


<body>
<?php include 'templates/header/header-fragment.php'; ?>
  <div class="container">
    <div class="calendar">
        <div class="calendar-header">
          <span class="week-range" id="week-range"> Aug 18 - Aug 24, 2025 </span>
      <div class="week-picker" id="week-picker">
        <button id="prev-week" class="week-change">◀</button>
        <span class="current-week" id="current-week">Week 34</span>
        <button id="next-week" class="week-change">▶</button>
      </div>
          </div>
          <div class="calendar-body">
          <div class="time-header"></div>
          <div class="calendar-days week-view" id="week-days"></div>
        </div>

        <div class="schedule-container">
          <table class="schedule-table">
            <tbody id="schedule-body"></tbody>
          </table>
        </div>

        <br />

  <!-- Event modal (used by week.js) -->
  <div id="event-modal" class="modal">
    <div class="modal-content">
      <span id="close-modal" class="close">&times;</span>
      <form id="cell-event-form" class="event-form">
        <label>Start date<input type="date" id="cell-event-start-date" required></label>
        <label>End date<input type="date" id="cell-event-end-date"></label>
        <label>Start time<input type="time" id="cell-event-start-time"></label>
        <label>End time<input type="time" id="cell-event-end-time"></label>
        <label>Title<input type="text" id="cell-event-title" required></label>
        <label>Notes<textarea id="cell-event-notes"></textarea></label>
        <label>Category<select id="event-category"><option value="other">Other</option></select></label>
          <label>Repeat:
            <select id="event-recurrence">
              <option value="">Does not repeat</option>
              <option value="P1D">Every day</option>
              <option value="P1W">Every week</option>
              <option value="P4W">Every 4 weeks</option>
              <option value="P1M">Every month</option>
              <option value="P1Y">Every year</option>
            </select>
          </label>
          <label>Repeat Until<input type="date" id="event-recurrence-until"></label>
        <label><input type="checkbox" id="no-time-checkbox"> All day</label>
        <div style="margin-top:8px">
          <label>When updating:
            <select id="event-update-scope">
              <option value="single">Only this event</option>
              <option value="series">Entire series</option>
            </select>
          </label>
          <label style="margin-left:12px">When deleting:
            <select id="event-delete-scope">
              <option value="single">Only this event</option>
              <option value="series">Entire series</option>
            </select>
          </label>
        </div>
        <div class="button-container">
          <button id="create-event-btn" type="submit">Create</button>
          <button id="update-event-btn" type="button" style="display:none">Update</button>
          <button id="delete-event-btn" type="button" style="display:none">Delete</button>
          <button id="unlink-event-btn" type="button" style="display:none">Unlink from series</button>
        </div>
      </form>
    </div>
  </div>

    <div id="message-container"></div>

  <!-- Local Day.js + isoWeek plugin (vendored to avoid third-party storage blocks) -->
  <script src="Javascript/vendor/dayjs/dayjs.min.js"></script>
  <script src="Javascript/vendor/dayjs/plugin/isoWeek.js"></script>
  <script>try{ dayjs.extend(dayjs_plugin_isoWeek); }catch(e){console.warn('dayjs plugin extend failed', e);} </script>
  <script src="week.js"></script>
  </div> <!-- end .container -->
  </body>
</html>
<?php include 'templates/footer/footer.php'; ?>