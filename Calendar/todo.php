
<?php
// To-Do page using the day.php layout so formatting matches.
require_once __DIR__ . '/assets/auth.php';
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/'); if ($base === '/' || $base === '.') $base = '';
$currentUserId = current_user_id();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>To-Do — Calendar</title>
    <link rel="stylesheet" href="<?php echo $base; ?>/todo.css" />
</head>
<body>
    <div id="message-container"></div>
    <div class="container">
        <?php include __DIR__ . '/templates/header/header-fragment.php'; ?>
        <div class="calendar">
      <div class="calendar-header">
          <div class="day-selector">
            <span id="date-picker-container">
              <button class="day-change" id="datePrev" aria-label="Previous day">◀</button>
              <span class="day-name" id="day-display" aria-hidden="true"></span>
              <input type="date" id="date-picker-input" title="Pick a date" placeholder="YYYY-MM-DD">
              <button class="day-change" id="dateNext" aria-label="Next day">▶</button>
            </span>
        </div>
      </div>

            <div class="events-body">
                <main class="todo-main">
                  <!-- Quick bullets: single short items without title -->
                  <section style="margin-bottom:18px;">
                    <div class="todo-add">
                      <input id="quickInput" placeholder="Add a quick bullet..." aria-label="Quick bullet" />
                      <button id="quickAddBtn">Add</button>
                    </div>
                    <div id="quickList" class="todo-list" aria-live="polite"></div>
                    <div id="quickEmpty" class="todo-empty">No quick bullets yet.</div>
                  </section>
                </main>
            </div>
        </div>
    </div>

    <?php include __DIR__ . '/templates/footer/footer.php'; ?>

    <script>
      const API_BASE = '<?php echo $base; ?>';
      window.currentUserId = <?php echo json_encode($currentUserId); ?>;
    </script>
    <?php
      $todoJs = __DIR__ . '/todo.js';
      $ver = file_exists($todoJs) ? filemtime($todoJs) : time();
    ?>
    <script src="<?php echo $base; ?>/todo.js?v=<?php echo $ver; ?>" defer></script>
</body>
</html>

