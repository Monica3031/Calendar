<?php
// Initialize auth/session before any output so cookies and session restore work
require_once __DIR__ . '/assets/auth.php';
error_log('SESSION user_id (day.php): ' . ($_SESSION['user_id'] ?? 'not set'));
?>
<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Single Day</title>
        <link rel="stylesheet" href="day.css" />
        <script src="Javascript/vendor/dayjs/dayjs.min.js"></script>
        <script src="Javascript/vendor/dayjs/plugin/isoWeek.js"></script>
        <script>
            try { dayjs.extend(dayjs_plugin_isoWeek); } catch(e) { console.warn('dayjs extend noop', e); }
            window.currentUserId = <?php echo json_encode($_SESSION['user_id'] ?? null); ?>;
        </script>
        <script type="module" src="day.js"></script>
</head>
    <div id="message-container"></div>
    <div class="container">
    <?php include 'templates/header/header-fragment.php'; ?>
        <div class="calendar">
            <div class="calendar-header">
                <div class="day-selector">
                    <button type="button" class="day-change" id="prev-day" aria-label="Previous day">◀</button>
                                        <span id="date-picker-container">
                                            <input type="date" id="date-picker-input" title="Pick a date" placeholder="YYYY-MM-DD">
                                        </span>
                    <button type="button" class="day-change" id="next-day" aria-label="Next day">▶</button>
                </div>
                <!-- Visible day header updated by day.js -->
                <div id="day-display" class="day-display" aria-live="polite" style="font-weight:600; margin-top:8px;"></div>
            </div>

        <div class = "events-body">
        <div class="event-list" id="event-list"></div>
        </div>
    </div>
    </div>
        <!-- Event modal (used by day.js) -->
        <div id="event-modal" class="modal">
            <div class="modal-content">
                <span id="close-modal" class="close">&times;</span>
                <form id="cell-event-form" class="event-form">
                    <label>Start date<input type="date" id="cell-event-start-date" required></label>
                    <label>End date<input type="date" id="cell-event-end-date"></label>
                    <label>Start time<input type="time" id="cell-event-start"></label>
                    <label>End time<input type="time" id="cell-event-end"></label>
                    <label>Title<input type="text" id="cell-event-title" required></label>
                    <label>Notes<textarea id="cell-event-notes"></textarea></label>
                    <label>Category<select id="event-category"><option value="other">Other</option></select></label>
                                        <label><input type="checkbox" id="no-time-checkbox"> All day</label>
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
                                        <label>Repeat Until: <input type="date" id="event-recurrence-until" /></label>
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
                                            <button id="cell-event-create" type="submit">Create</button>
                                            <button id="cell-event-update" type="button" style="display:none">Update</button>
                                            <button id="cell-event-delete" type="button" style="display:none">Delete</button>
                                            <button id="cell-event-unlink" type="button" style="display:none">Unlink from series</button>
                                        </div>
                </form>
            </div>
        </div>
    <?php include 'templates/footer/footer.php'; ?>
</body>
</html>