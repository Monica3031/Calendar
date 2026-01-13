<?php
session_start();
error_log('SESSION user_id (week.php): ' . ($_SESSION['user_id'] ?? 'not set'));
?>
<?php
require_once __DIR__ . '/assets/auth.php';
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
    <link rel="stylesheet" href="add_new_event.css" />
  <!-- No inline layout overrides needed here; keep styles in CSS files -->
    <script>
      window.currentUserId = <?php echo json_encode($_SESSION['user_id'] ?? null); ?>;
    </script>
  </head>


<body>
<?php include 'templates/header/header-fragment.php'; ?>

<div class="container">
  <div class="calendar">

    <div id="event-modal" class="modal">
          <div class="modal-content">
            <span class="close" id="close-modal">&times;</span>
            <h4>Event Details</h4>
            
            <form class="event-form" id="cell-event-form">
        <label>Start Date: <input type="date" id="cell-event-start-date" /></label><br />
        <label>End Date: <input type="date" id="cell-event-end-date" /></label><br />
        <label>Start Time: <input type="time" id="cell-event-start-time" /></label><br />
        <label>End Time: <input type="time" id="cell-event-end-time" /></label><br />
        <label for="no-time-checkbox">
          <input type="checkbox" id="no-time-checkbox" />
          All-day event (no time)
        </label><br />
        <label>Category:
          <select id="event-category">
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="friends">Friends</option>
            <option value="family">Family</option>
            <option value="other">Other</option>
          </select>
        </label><br />
        <label>Title: <input type="text" id="cell-event-title" /></label><br />
  <label>Notes: <input type="text" id="cell-event-notes" /></label><br />
  <input type="hidden" id="event-id" value="" />

        <div id="event-info" style="display:none;background:#fbfbfb;border:1px solid #eee;padding:8px;border-radius:6px;margin-top:8px">
          <strong>Editing:</strong>
          <div>Event ID: <span id="event-info-id"></span></div>
          <div>Recurrence group: <span id="event-info-group">(none)</span></div>
        </div>

        <label>Repeat:
          <select id="event-recurrence">
            <option value="">Does not repeat</option>
            <option value="P1D">Every day</option>
            <option value="P1W">Every week</option>
            <option value="P4W">Every 4 weeks</option>
            <option value="P1M">Every month</option>
            <option value="P1Y">Every year</option>
          </select>
        </label><br />
        <label>Repeat Until: <input type="date" id="event-recurrence-until" /></label><br />

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
        <div class="button-container" style="margin-top:8px">
          <button type="submit" id="create-event-btn">Add Event</button>
          <button type="button" id="update-event-btn">Update Event</button>
          <button type="button" id="delete-event-btn">Delete Event</button>
          <button type="button" id="unlink-event-btn">Unlink from series</button>
        </div>
            </form>
        </div>
    </div>
  <script src="Javascript/vendor/dayjs/dayjs.min.js"></script>
  <script src="Javascript/vendor/dayjs/plugin/isoWeek.js"></script>
  <script>try{ dayjs.extend(dayjs_plugin_isoWeek); }catch(e){console.warn('dayjs plugin extend failed', e);} </script>
    <script src="add_new_event.js"></script>
  </div> <!-- end .calendar -->
  </div> <!-- end .container -->
  </body>
</html>
<?php include 'templates/footer/footer.php'; ?>