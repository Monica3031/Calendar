<?php
// Initialize auth/session before any output
require_once __DIR__ . '/assets/auth.php';
error_log('SESSION user_id: ' . ($_SESSION['user_id'] ?? 'not set'));
// ...existing server-side logic (load events, permissions) should remain above the HTML when present...
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Calendar</title>
  <link rel="stylesheet" href="month.css">
  <!-- Load local vendored Day.js to avoid CDN/tracking issues -->
  <script src="Javascript/vendor/dayjs/dayjs.min.js"></script>
  <script src="Javascript/vendor/dayjs/plugin/isoWeek.js"></script>
  <script src="month.js" defer></script>
</head>

<body>
  <div class="container">

    <!-- Top menu -->
    <?php include 'templates/header/header-fragment.php'; ?>

    <!-- Calendar -->
    <div class="calendar">

      <!-- Row 1: Month + Year controls -->
      <div class="calendar-header">
        <div class="month-picker">
          <button id="prev-month">◀</button>
          <span id="month-year"></span>
          <button id="next-month">▶</button>
        </div>

        <div class="year-picker">
          <button id="prev-year">◀</button>
          <span id="year-label"></span>
          <button id="next-year">▶</button>
        </div>
      </div>

      <!-- Row 2: Weekdays -->
      <div class="calendar-week-days">
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
        <div>Sun</div>
      </div>

      <!-- Row 3: Calendar grid -->
      <div id="calendar" class="calendar-grid"></div>
    </div>
  </div>

  <?php include 'templates/footer/footer.php'; ?>

  <!-- Initialize dayjs plugin safely and expose current user id -->
  <script>
    try {
      if (typeof dayjs !== 'undefined' && typeof dayjs.extend === 'function' && typeof dayjs_plugin_isoWeek !== 'undefined') {
        dayjs.extend(dayjs_plugin_isoWeek);
      }
    } catch (e) {
      console.warn('dayjs plugin init failed', e);
    }

    window.currentUserId = <?php echo json_encode($_SESSION['user_id'] ?? null); ?>;
  </script>

</body>

</html>
