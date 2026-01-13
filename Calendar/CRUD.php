<?php
// enable session access so API can use logged-in user id when client omits it
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// Provide a compatibility wrapper so older deployments that expect get_db_connection()
// will work. assets/database.php returns a connection/adapter when included.
if (!function_exists('get_db_connection')) {
    function get_db_connection() {
        $conn = include __DIR__ . '/assets/database.php';
        if ($conn === false || !$conn) {
            throw new Exception('DB connect failed (assets/database.php returned false). Check assets/db_diagnostics.log');
        }
        return $conn;
    }
}
    // Helper: detect which recurrence-group column names exist on the `events` table
    function detectRecurrenceColumns($conn) {
        static $cached = null;
        if ($cached !== null) return $cached;
        $candidates = ['recurrence_group_id','recurrence_group','recurrence_groupid'];
        $found = [];
        try {
            // Use INFORMATION_SCHEMA which is supported on most SQL backends (SQL Server, MySQL)
            $inList = implode("','", $candidates);
            $sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'events' AND COLUMN_NAME IN ('$inList')";
            $stmt = $conn->prepare($sql);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if ($rows) {
                foreach ($rows as $r) $found[] = $r;
            }
        } catch (Exception $e) {
            // Fallback: probe each candidate individually (safer on adapters that error on the above)
            try {
                foreach ($candidates as $col) {
                    $s = $conn->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'events' AND COLUMN_NAME = ?");
                    $s->execute([$col]);
                    $r = $s->fetch(PDO::FETCH_COLUMN);
                    if ($r) $found[] = $col;
                }
            } catch (Exception $e2) {
                // give up quietly; $found remains empty
                $found = [];
            }
        }
        $cached = $found;
        // Normalize to flat list of scalar column names (avoid arrays/objects leaking through)
        $normalized = [];
        foreach ((array)$found as $f) {
            if (is_string($f) && $f !== '') { $normalized[] = $f; continue; }
            if (is_int($f)) { $normalized[] = (string)$f; continue; }
            if (is_array($f) && isset($f[0]) && is_scalar($f[0])) { $normalized[] = (string)$f[0]; continue; }
            if (is_object($f)) {
                // common case: stdClass with COLUMN_NAME property
                if (isset($f->COLUMN_NAME) && is_scalar($f->COLUMN_NAME)) { $normalized[] = (string)$f->COLUMN_NAME; continue; }
                // try to extract first scalar property
                foreach ($f as $prop) { if (is_scalar($prop)) { $normalized[] = (string)$prop; break; } }
            }
        }
        $normalized = array_values(array_unique(array_filter($normalized, function($v){ return $v !== '' && is_scalar($v); })));
        $cached = $normalized;
        return $cached;
    }

if (file_exists(__DIR__ . '/assets/helpers.php')) require_once __DIR__ . '/assets/helpers.php';

header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
// Safe logger: try project asset path first, fall back to system temp dir so we capture logs
function safe_log($msg) {
    $basePath = __DIR__ . '/assets';
    $file = $basePath . '/crud_requests.log';
    $line = date('c') . ' ' . $msg . PHP_EOL;
    // Attempt to write to assets/ path
    $ok = @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
    if ($ok === false) {
        // Fallback to system temp dir
        $tmp = sys_get_temp_dir() . '/calendar_crud_requests.log';
        @file_put_contents($tmp, $line, FILE_APPEND | LOCK_EX);
        // Also write a short notice to PHP error log so operators notice
        error_log("CRUD.LOG (assets unwritable) wrote to {$tmp}");
        return $tmp;
    }
    return $file;
}
// Log raw incoming request
safe_log("REQUEST: " . ($raw ?: ''));
if (!$input) { echo json_encode(['status'=>'error','message'=>'Invalid JSON input','raw'=>$raw]); exit; }

$action = $input['action'] ?? null;
// If client didn't provide id_users but a session user is available, default to session user
if (empty($input['id_users']) && !empty($_SESSION['user_id'])) {
    $input['id_users'] = $_SESSION['user_id'];
}
if (!$action) { echo json_encode(['status'=>'error','message'=>'Missing action']); exit; }

// Get connection via wrapper which throws on failure
try {
    $conn = get_db_connection();
    safe_log("DB: connected");
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

// Helper: look for known recurrence column names in an associative row
function getRecurrenceColsFromRow($row) {
    $candidates = ['recurrence_group_id','recurrence_group','recurrence_groupid'];
    $found = [];
    if (!is_array($row)) return [];
    foreach ($candidates as $c) { if (array_key_exists($c, $row)) $found[] = $c; }
    return $found;
}

switch ($action) {
    case 'todo_get_lists':
        // returns lists for a user within an optional date
        if (empty($input['id_users'])) { echo json_encode(['status'=>'error','message'=>'Missing id_users']); exit; }
        $userId = $input['id_users'];
        $dateCond = ''; $params = [$userId];
        // If the client requested a specific date, move any incomplete items from earlier dates
        // forward into a (possibly new) carry-over list for the requested date. Done items remain on
        // the day they were completed.
        if (!empty($input['list_date'])) {
            $targetDate = $input['list_date'];
            try {
                $useTrans = is_object($conn) && method_exists($conn, 'beginTransaction');
                if ($useTrans) $conn->beginTransaction();
                        // find incomplete items that belong to lists from any earlier date
                        // Move unfinished items from previous days into the carry-over list for the requested date.
                        // This selects items where the owning list_date is strictly before the target date.
                        $probe = $conn->prepare("SELECT ti.id AS item_id FROM todo_items ti JOIN todo_lists tl ON ti.list_id = tl.id WHERE tl.list_date < ? AND ti.done = 0 AND ti.user_id = ?");
                        $probe->execute([$targetDate, $userId]);
                $rows = $probe->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($rows)) {
                    // ensure a carry-over list exists for this user/date (title empty)
                    $finder = $conn->prepare("SELECT id FROM todo_lists WHERE user_id = ? AND (title IS NULL OR title = '') AND list_date = ?");
                    $finder->execute([$userId, $targetDate]);
                    $found = $finder->fetch(PDO::FETCH_COLUMN);
                    if (!$found) {
                        $ins = $conn->prepare("INSERT INTO todo_lists (user_id, title, list_date) VALUES (?, ?, ?)");
                        $ins->execute([$userId, '', $targetDate]);
                        // try to get created id with a few fallbacks
                        $newListId = null;
                        try { if (method_exists($conn, 'lastInsertId')) { $lid = $conn->lastInsertId(); if ($lid) $newListId = $lid; } } catch (Exception $e) {}
                        if (empty($newListId)) {
                            try { $s = $conn->prepare("SELECT LAST_INSERT_ID() AS id"); $s->execute(); $newListId = $s->fetch(PDO::FETCH_COLUMN); } catch (Exception $e) {}
                        }
                        if (empty($newListId)) {
                            try { $s = $conn->prepare("SELECT SCOPE_IDENTITY() AS id"); $s->execute(); $newListId = $s->fetch(PDO::FETCH_COLUMN); } catch (Exception $e) {}
                        }
                        $found = $newListId ?: null;
                    }
                    if ($found) {
                        // move items into the carry-over list
                        $ids = array_map(function($r){ return intval($r['item_id']); }, $rows);
                        if (!empty($ids)) {
                            // build placeholders safely
                            $placeholders = implode(',', array_fill(0, count($ids), '?'));
                            $sql = "UPDATE todo_items SET list_id = ? WHERE id IN ($placeholders) AND user_id = ?";
                            $stmtU = $conn->prepare($sql);
                            $execParams = array_merge([$found], $ids, [$userId]);
                            $stmtU->execute($execParams);
                        }
                    }
                }
                if ($useTrans) $conn->commit();
            } catch (Exception $e) {
                if ($useTrans && is_object($conn) && method_exists($conn, 'rollBack')) { try { $conn->rollBack(); } catch (Exception $ex) {} }
                // don't block the request on carry-forward failures; log and continue
                safe_log("CARRY_FORWARD_ERROR: " . $e->getMessage());
            }
        }
        if (!empty($input['list_date'])) { $dateCond = ' AND list_date = ?'; $params[] = $input['list_date']; }
        $stmt = $conn->prepare("SELECT id, user_id, title, list_date, created_at FROM todo_lists WHERE user_id = ?" . $dateCond . " ORDER BY list_date DESC, created_at DESC");
        $stmt->execute($params);
        $lists = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Attach items for each list
        foreach ($lists as &$l) {
            try {
                $it = $conn->prepare("SELECT id AS item_id, list_id, title, done, created_at FROM todo_items WHERE list_id = ? ORDER BY created_at");
                $it->execute([$l['id']]);
                $l['items'] = $it->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) { $l['items'] = []; }
        }
        echo json_encode(['status'=>'success','lists'=>$lists]);
        break;

    case 'todo_create_list':
        if (empty($input['id_users'])) { echo json_encode(['status'=>'error','message'=>'Missing id_users']); exit; }
        $title = $input['title'] ?? null; $listDate = $input['list_date'] ?? null; $userId = $input['id_users'];
        $stmt = $conn->prepare("INSERT INTO todo_lists (user_id, title, list_date) VALUES (?, ?, ?)");
        $executed = false;
        try {
            $executed = $stmt->execute([$userId, $title, $listDate]);
        } catch (Exception $e) {
            $executed = false;
        }
        // If insert failed due to missing column, attempt to add it and retry once
        if (!$executed) {
            $errInfo = $stmt->errorInfo();
            $errMsg = is_array($errInfo) ? implode(' | ', $errInfo) : (string)$errInfo;
            // Look for patterns like "Invalid column name 'title'" (SQL Server)
            if (stripos($errMsg, "Invalid column name") !== false || stripos($errMsg, 'unknown column') !== false || stripos($errMsg, 'column') !== false) {
                // extract quoted column name if present
                if (preg_match("/['\"]([a-zA-Z0-9_]+)['\"]/", $errMsg, $m)) { $missingCol = $m[1]; } else { $missingCol = null; }
                if ($missingCol) {
                    safe_log("todo_create_list detected missing column: " . $missingCol . "; attempting ALTER TABLE to add it");
                    try {
                        // Try SQL Server-friendly ALTER first
                        $alterSql = "ALTER TABLE todo_lists ADD " . $missingCol . " NVARCHAR(255) NULL";
                        $a = $conn->prepare($alterSql);
                        $a->execute();
                        safe_log("todo_create_list: ALTER TABLE added column " . $missingCol);
                        // Retry insert once
                        try { $executed = $stmt->execute([$userId, $title, $listDate]); } catch (Exception $e) { $executed = false; }
                    } catch (Exception $e) {
                        safe_log("todo_create_list: ALTER TABLE failed for " . $missingCol . ": " . $e->getMessage());
                        // try with dbo. prefix as fallback
                        try {
                            $alterSql2 = "ALTER TABLE dbo.todo_lists ADD " . $missingCol . " NVARCHAR(255) NULL";
                            $a2 = $conn->prepare($alterSql2);
                            $a2->execute();
                            safe_log("todo_create_list: ALTER TABLE dbo added column " . $missingCol);
                            try { $executed = $stmt->execute([$userId, $title, $listDate]); } catch (Exception $e2) { $executed = false; }
                        } catch (Exception $e3) {
                            safe_log("todo_create_list: second ALTER TABLE attempt failed: " . $e3->getMessage());
                        }
                    }
                }
            }
        }

        if ($executed) {
            $newId = null;
            // Prefer PDO::lastInsertId when available
            try {
                if (method_exists($conn, 'lastInsertId')) {
                    $lid = $conn->lastInsertId();
                    if ($lid) $newId = $lid;
                }
            } catch (Exception $e) { /* ignore */ }
            // MySQL fallback
            if (empty($newId)) {
                try { $s = $conn->prepare("SELECT LAST_INSERT_ID() AS id"); $s->execute(); $r = $s->fetch(PDO::FETCH_COLUMN); if ($r) $newId = $r; } catch (Exception $e) { }
            }
            // SQL Server fallback using SCOPE_IDENTITY()
            if (empty($newId)) {
                try { $s = $conn->prepare("SELECT SCOPE_IDENTITY() AS id"); $s->execute(); $r2 = $s->fetch(PDO::FETCH_COLUMN); if ($r2) $newId = $r2; } catch (Exception $e) { }
            }

            // If we still don't have an id, attempt to find the most recent list matching the user/title/date
            if (empty($newId)) {
                try {
                    $finder = $conn->prepare("SELECT id FROM todo_lists WHERE user_id = ? AND (title = ? OR (title IS NULL AND ? IS NULL)) AND (list_date = ? OR (list_date IS NULL AND ? IS NULL)) ORDER BY created_at DESC LIMIT 1");
                    $finder->execute([$userId, $title, $title, $listDate, $listDate]);
                    $cand = $finder->fetch(PDO::FETCH_COLUMN);
                    if ($cand) $newId = $cand;
                } catch (Exception $e) {
                    // Some DBs (SQL Server) do not support LIMIT; try a SQL Server compatible attempt
                    try {
                        $finder2 = $conn->prepare("SELECT TOP 1 id FROM todo_lists WHERE user_id = ? AND (title = ? OR (title IS NULL AND ? IS NULL)) AND (list_date = ? OR (list_date IS NULL AND ? IS NULL)) ORDER BY created_at DESC");
                        $finder2->execute([$userId, $title, $title, $listDate, $listDate]);
                        $cand2 = $finder2->fetch(PDO::FETCH_COLUMN);
                        if ($cand2) $newId = $cand2;
                    } catch (Exception $e2) { /* give up */ }
                }
            }

            if ($newId) {
                try {
                    $sel = $conn->prepare("SELECT id, user_id, title, list_date, created_at FROM todo_lists WHERE id = ?");
                    $sel->execute([$newId]);
                    $row = $sel->fetch(PDO::FETCH_ASSOC);
                    echo json_encode(['status'=>'success','list'=>$row]);
                } catch (Exception $e) {
                    echo json_encode(['status'=>'success','created_id'=>$newId]);
                }
            } else {
                echo json_encode(['status'=>'success','created_id'=>null]);
            }
    } else { $err = $stmt->errorInfo(); safe_log('todo_create_list DB error: ' . json_encode($err)); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'todo_delete_list':
        if (empty($input['id_users']) || empty($input['list_id'])) { echo json_encode(['status'=>'error','message'=>'Missing parameters']); exit; }
        $stmt = $conn->prepare("DELETE FROM todo_items WHERE list_id = ? AND user_id = ?"); $stmt->execute([$input['list_id'],$input['id_users']]);
        $stmt2 = $conn->prepare("DELETE FROM todo_lists WHERE id = ? AND user_id = ?");
        if ($stmt2->execute([$input['list_id'],$input['id_users']])) echo json_encode(['status'=>'success']); else { $err = $stmt2->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'todo_add_item':
        if (empty($input['id_users']) || empty($input['title'])) { echo json_encode(['status'=>'error','message'=>'Missing parameters']); exit; }
        $userId = $input['id_users']; $title = $input['title']; $listId = $input['list_id'] ?? null;
        $stmt = $conn->prepare("INSERT INTO todo_items (list_id, user_id, title, done) VALUES (?, ?, ?, 0)");
        if ($stmt->execute([$listId, $userId, $title])) {
            $newItemId = null;
            try { if (method_exists($conn, 'lastInsertId')) { $lid = $conn->lastInsertId(); if ($lid) $newItemId = $lid; } } catch (Exception $e) {}
            if (empty($newItemId)) {
                try { $s = $conn->prepare("SELECT LAST_INSERT_ID() AS id"); $s->execute(); $r = $s->fetch(PDO::FETCH_COLUMN); if ($r) $newItemId = $r; } catch (Exception $e) {}
            }
            if (empty($newItemId)) {
                try { $s = $conn->prepare("SELECT SCOPE_IDENTITY() AS id"); $s->execute(); $r2 = $s->fetch(PDO::FETCH_COLUMN); if ($r2) $newItemId = $r2; } catch (Exception $e) {}
            }
            if (empty($newItemId)) {
                // attempt to find by matching attributes
                try {
                    $finder = $conn->prepare("SELECT id FROM todo_items WHERE user_id = ? AND title = ? AND (list_id = ? OR (list_id IS NULL AND ? IS NULL)) ORDER BY created_at DESC LIMIT 1");
                    $finder->execute([$userId, $title, $listId, $listId]);
                    $cand = $finder->fetch(PDO::FETCH_COLUMN);
                    if ($cand) $newItemId = $cand;
                } catch (Exception $e) {
                    try {
                        $finder2 = $conn->prepare("SELECT TOP 1 id FROM todo_items WHERE user_id = ? AND title = ? AND (list_id = ? OR (list_id IS NULL AND ? IS NULL)) ORDER BY created_at DESC");
                        $finder2->execute([$userId, $title, $listId, $listId]);
                        $cand2 = $finder2->fetch(PDO::FETCH_COLUMN);
                        if ($cand2) $newItemId = $cand2;
                    } catch (Exception $e2) { /* ignore */ }
                }
            }
            if ($newItemId) {
                try { $sel = $conn->prepare("SELECT id AS item_id, list_id, user_id, title, done, created_at FROM todo_items WHERE id = ?"); $sel->execute([$newItemId]); $row = $sel->fetch(PDO::FETCH_ASSOC); echo json_encode(['status'=>'success','item'=>$row]); } catch (Exception $e) { echo json_encode(['status'=>'success','created_id'=>$newItemId]); }
            } else { echo json_encode(['status'=>'success','created_id'=>null]); }
        } else { $err = $stmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'todo_update_item':
        if (empty($input['id_users']) || empty($input['item_id'])) { echo json_encode(['status'=>'error','message'=>'Missing parameters']); exit; }
        $done = !empty($input['done']) ? 1 : 0; $title = $input['title'] ?? null; $params = [];
        $sets = [];
        if ($title !== null) { $sets[] = 'title = ?'; $params[] = $title; }
        $sets[] = 'done = ?'; $params[] = $done;
        $params[] = $input['item_id']; $params[] = $input['id_users'];
        $sql = "UPDATE todo_items SET " . implode(', ', $sets) . " WHERE id = ? AND user_id = ?";
        $stmt = $conn->prepare($sql);
        if ($stmt->execute($params)) echo json_encode(['status'=>'success']); else { $err = $stmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'todo_delete_item':
        if (empty($input['id_users']) || empty($input['item_id'])) { echo json_encode(['status'=>'error','message'=>'Missing parameters']); exit; }
        $stmt = $conn->prepare("DELETE FROM todo_items WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$input['item_id'],$input['id_users']])) echo json_encode(['status'=>'success']); else { $err = $stmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'debug_todo':
        // Lightweight diagnostics endpoint for local debugging. Returns the parsed input,
        // session user id, DB adapter info and simple counts from todo tables (or errors).
        $out = ['status'=>'ok','input'=>$input];
        $out['session_user_id'] = $_SESSION['user_id'] ?? null;
        try {
            $dconn = get_db_connection();
            $out['db_adapter'] = is_object($dconn) ? get_class($dconn) : gettype($dconn);
            safe_log('DEBUG: debug_todo connected adapter=' . $out['db_adapter']);
            // Attempt simple queries
            try {
                $s = $dconn->prepare("SELECT COUNT(*) AS c FROM todo_lists");
                $s->execute();
                $res = $s->fetch(PDO::FETCH_ASSOC);
                $out['todo_lists_count'] = is_array($res) ? ($res['c'] ?? array_values($res)[0] ?? $res) : $res;
            } catch (Exception $e) { $out['todo_lists_error'] = $e->getMessage(); safe_log('DEBUG LISTS ERR: '.$e->getMessage()); }
            try {
                $s2 = $dconn->prepare("SELECT COUNT(*) AS c FROM todo_items");
                $s2->execute();
                $res2 = $s2->fetch(PDO::FETCH_ASSOC);
                $out['todo_items_count'] = is_array($res2) ? ($res2['c'] ?? array_values($res2)[0] ?? $res2) : $res2;
            } catch (Exception $e) { $out['todo_items_error'] = $e->getMessage(); safe_log('DEBUG ITEMS ERR: '.$e->getMessage()); }
        } catch (Exception $e) {
            $out['db_connect_error'] = $e->getMessage(); safe_log('DEBUG DB CONNECT ERR: '.$e->getMessage());
        }
        echo json_encode($out);
        break;
    case 'create':
        if (empty($input['event_start_date']) || empty($input['event_end_date']) || empty($input['event_title']) || !isset($input['id_users'])) {
            echo json_encode(['status'=>'error','message'=>'Missing required fields','debug'=>$input]); exit;
        }
        $eventStart = $input['event_start_date'];
        $eventEnd = $input['event_end_date'] ?? $eventStart;
        $categoryId = null;
        if (isset($input['category']) && is_numeric($input['category'])) $categoryId = (int)$input['category'];
        else if (function_exists('getCategoryId')) $categoryId = getCategoryId($input['category'] ?? 'other', $conn);
        if ($categoryId === null) $categoryId = 1;

        $recurrenceRule = trim($input['recurrence'] ?? '');
        $recurrenceUntil = trim($input['recurrence_until'] ?? '');

    // Prepare two INSERT variants: with and without recurrence_group_id.
    // Some deployments lack the `recurrence_group_id` column; attempt the
    // full insert first and fall back gracefully so events can still be
    // created while we inform the operator to add the missing column.
    $insertSqlWith = "INSERT INTO events (event_start_date, event_end_date, event_start_time, event_end_time, event_title, notes, category, id_users, recurrence_group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $insertSqlNoGroup = "INSERT INTO events (event_start_date, event_end_date, event_start_time, event_end_time, event_title, notes, category, id_users) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    $stmtWith = $conn->prepare($insertSqlWith);
    $stmtNoGroup = $conn->prepare($insertSqlNoGroup);
    // Flag to detect whether DB supports recurrence_group_id column
    $dbHasGroupColumn = true;

        if ($recurrenceRule !== '' && $recurrenceUntil !== '') {
            try {
                $origStart = new DateTime($eventStart);
                $origEnd = new DateTime($eventEnd);
                $durationDays = (int)$origStart->diff($origEnd)->format('%a');
                $durationSpec = $durationDays > 0 ? 'P'.$durationDays.'D' : 'P0D';
                $interval = new DateInterval($recurrenceRule);
                $until = new DateTime($recurrenceUntil);

                $useTrans = is_object($conn) && method_exists($conn,'beginTransaction');
                if ($useTrans) $conn->beginTransaction();
                $cur = new DateTime($eventStart);
                $inserted = 0;
                // generate a recurrence group id for this series
                try { $groupId = bin2hex(random_bytes(8)); } catch (Exception $e) { $groupId = uniqid('rg_', true); }
                while ($cur <= $until) {
                    $curEnd = (clone $cur)->add(new DateInterval($durationSpec));
                    // Try insert with group id first
                    $paramsWith = [$cur->format('Y-m-d'), $curEnd->format('Y-m-d'), $input['event_start_time'] ?? null, $input['event_end_time'] ?? null, $input['event_title'], $input['notes'] ?? '', $categoryId, $input['id_users'], $groupId];
                    $ok = false;
                    try {
                        $ok = $stmtWith->execute($paramsWith);
                    } catch (Exception $e) { $ok = false; }
                    if (!$ok) {
                        // Detect whether failure is due to missing column; fall back to no-group insert
                        $err = $stmtWith->errorInfo();
                        $errMsg = is_array($err) ? implode(' | ', $err) : (string)$err;
                        if ($errMsg && (stripos($errMsg, 'recurrence_group_id') !== false || stripos($errMsg, 'unknown column') !== false || stripos($errMsg, 'column') !== false)) {
                            // attempt insert without group column
                            $dbHasGroupColumn = false;
                            $paramsNoGroup = [$cur->format('Y-m-d'), $curEnd->format('Y-m-d'), $input['event_start_time'] ?? null, $input['event_end_time'] ?? null, $input['event_title'], $input['notes'] ?? '', $categoryId, $input['id_users']];
                            try { $ok = $stmtNoGroup->execute($paramsNoGroup); } catch (Exception $e) { $ok = false; }
                        }
                    }
                    if (!$ok) throw new Exception('DB insert failed: ' . json_encode($stmtWith->errorInfo()));
                    $inserted++;
                    $cur->add($interval);
                    if ($inserted > 1000) break;
                }
                if ($useTrans) $conn->commit();
                $resp = ['status'=>'success','created'=>$inserted,'recurrence_group_id'=>$groupId];
                if (!$dbHasGroupColumn) {
                    $resp['warning'] = 'Database missing recurrence_group_id column; events created without series linkage';
                    $resp['sql_suggestion'] = "ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(64) NULL";
                }
                echo json_encode($resp);
            } catch (Exception $e) {
                if ($useTrans && is_object($conn) && method_exists($conn,'rollBack')) { try { $conn->rollBack(); } catch (Exception $ex) { } }
                echo json_encode(['status'=>'error','message'=>'Recurrence creation failed: '.$e->getMessage(),'debug'=>$input]);
            }
        } else {
            // Single insert path: try with group column (null) then fall back
            $ok = false;
            try { $ok = $stmtWith->execute([$eventStart,$eventEnd,$input['event_start_time'] ?? null,$input['event_end_time'] ?? null,$input['event_title'],$input['notes'] ?? '',$categoryId,$input['id_users'],null]); } catch (Exception $e) { $ok = false; }
            if (!$ok) {
                $err = $stmtWith->errorInfo(); $errMsg = is_array($err)?implode(' | ',$err):(string)$err;
                if ($errMsg && (stripos($errMsg,'recurrence_group_id')!==false || stripos($errMsg,'unknown column')!==false || stripos($errMsg,'column')!==false)) {
                    try { $ok = $stmtNoGroup->execute([$eventStart,$eventEnd,$input['event_start_time'] ?? null,$input['event_end_time'] ?? null,$input['event_title'],$input['notes'] ?? '',$categoryId,$input['id_users']]); $dbHasGroupColumn = false; } catch (Exception $e) { $ok = false; }
                }
            }
            if ($ok) {
                $out = ['status'=>'success'];
                if (!$dbHasGroupColumn) { $out['warning'] = 'Database missing recurrence_group_id column; event created without series linkage'; $out['sql_suggestion'] = "ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(64) NULL"; }
                echo json_encode($out);
            } else { $errorInfo = $stmtWith->errorInfo(); echo json_encode(['status'=>'error','message'=>'Database error','debug'=>$errorInfo]); }
        }
        break;

    case 'unlink':
        // Detach a single occurrence from its recurrence group so it's independent
        $eid = isset($input['event_id']) ? intval($input['event_id']) : 0;
        if ($eid <= 0) { echo json_encode(['status'=>'error','message'=>'Missing event_id']); exit; }
        // Set recurrence_group_id to NULL for this occurrence
        $stmt = $conn->prepare("UPDATE events SET recurrence_group_id = NULL WHERE id = ?");
        if ($stmt->execute([$eid])) echo json_encode(['status'=>'success']); else { $err = $stmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
        break;

    case 'read':
        if (empty($input['startDate']) || empty($input['endDate']) || !isset($input['id_users'])) { echo json_encode(['status'=>'error','message'=>'Missing date range or user ID','debug'=>$input]); exit; }
        $startDate = $input['startDate']; $endDate = $input['endDate']; $userId = $input['id_users'];
        $stmt = $conn->prepare("SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON e.category = c.id WHERE e.event_start_date <= ? AND COALESCE(e.event_end_date, e.event_start_date) >= ? AND e.id_users = ?");
        $stmt->execute([$endDate,$startDate,$userId]); $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($events);
        break;

    case 'get_event':
        $eventId = isset($input['event_id']) ? intval($input['event_id']) : 0; if ($eventId<=0) { echo json_encode(['status'=>'error','message'=>'Invalid event_id']); exit; }
        if (isset($input['id_users']) && $input['id_users']) { $stmt = $conn->prepare("SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON e.category = c.id WHERE e.id = ? AND e.id_users = ?"); $stmt->execute([$eventId,$input['id_users']]); }
        else { $stmt = $conn->prepare("SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON e.category = c.id WHERE e.id = ?"); $stmt->execute([$eventId]); }
        $event = $stmt->fetch(PDO::FETCH_ASSOC); if (!$event) { echo json_encode(['status'=>'error','message'=>'Event not found']); exit; }
        // Normalize common datetime fields to short forms
        $event['event_start_date'] = isset($event['event_start_date']) ? substr($event['event_start_date'],0,10) : null;
        $event['event_end_date'] = isset($event['event_end_date']) ? substr($event['event_end_date'],0,10) : $event['event_start_date'];
        $event['event_start_time'] = isset($event['event_start_time']) ? substr($event['event_start_time'],0,8) : null;
        $event['event_end_time'] = isset($event['event_end_time']) ? substr($event['event_end_time'],0,8) : null;
        // Some deployments use alternate column names for the recurrence group.
        // Canonicalize them so the client can always read `recurrence_group_id`.
        $event['recurrence_group_id'] = $event['recurrence_group_id'] ?? ($event['recurrence_group'] ?? ($event['recurrence_groupid'] ?? null));
        // Also surface common recurrence metadata if present
        $event['recurrence'] = $event['recurrence'] ?? ($event['recurrence_rule'] ?? null);
        $event['recurrence_until'] = $event['recurrence_until'] ?? ($event['recurrenceEnd'] ?? null);
        echo json_encode($event);
        break;

    case 'update':
        if (empty($input['event_id']) || empty($input['event_start_date']) || empty($input['event_end_date']) || empty($input['event_title']) || !isset($input['id_users'])) { echo json_encode(['status'=>'error','message'=>'Missing required fields']); exit; }
        $eventEndDate = $input['event_end_date'] ?? $input['event_start_date'];
        $categoryId = null; if (isset($input['category']) && is_numeric($input['category'])) $categoryId = (int)$input['category']; else if (function_exists('getCategoryId')) $categoryId = getCategoryId($input['category'] ?? 'other',$conn); if ($categoryId===null) $categoryId=1;

 // ... inside case 'update', where it checks for update_series ...

if (!empty($input['update_series'])) {
    $gstmt = $conn->prepare("SELECT recurrence_group_id FROM events WHERE id = ? AND id_users = ?");
    $gstmt->execute([$input['event_id'], $input['id_users']]);
    $gro = $gstmt->fetch(PDO::FETCH_ASSOC);

    if (!$gro || empty($gro['recurrence_group_id'])) {
        echo json_encode(['status'=>'error', 'message'=>'Event is not part of a series']);
        exit;
    }

    $groupId = $gro['recurrence_group_id'];

    // Notice: We REMOVED event_start_date and event_end_date from the SET clause
    // This ensures occurrences keep their respective years/months/days.
    $sql = "UPDATE events SET 
            event_start_time = ?, 
            event_end_time = ?, 
            event_title = ?, 
            notes = ?, 
            category = ? 
            WHERE recurrence_group_id = ? AND id_users = ?";
            
    $params = [
        $input['event_start_time'] ?? null,
        $input['event_end_time'] ?? null,
        $input['event_title'],
        $input['notes'] ?? '',
        $categoryId,
        $groupId,
        $input['id_users']
    ];

    $ustmt = $conn->prepare($sql);
    if ($ustmt->execute($params)) {
        echo json_encode(['status'=>'success', 'updated_group_id'=>$groupId]);
    } else {
        echo json_encode(['status'=>'error', 'message'=>'Database update failed']);
    }
    break;
}

        // Default: update single event
        $stmt = $conn->prepare("UPDATE events SET event_start_date = ?, event_end_date = ?, event_start_time = ?, event_end_time = ?, event_title = ?, notes = ?, category = ?, id_users = ? WHERE id = ?");
        if ($stmt->execute([$input['event_start_date'],$input['event_end_date'],$input['event_start_time'] ?? null,$input['event_end_time'] ?? null,$input['event_title'],$input['notes'] ?? '',$categoryId,$input['id_users'],$input['event_id']])) echo json_encode(['status'=>'success']); else { $errorInfo=$stmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'Database error','debug'=>$errorInfo]); }
        break;

    case 'delete':
        if (empty($input['event_id'])) { echo json_encode(['status'=>'error','message'=>'Missing event_id']); exit; }
        // If delete_series flag is present, delete all occurrences in the recurrence group
        if (!empty($input['delete_series'])) {
            // Try to read any known recurrence group column variant
            // Determine existing recurrence group column(s) and use them
            $cols = detectRecurrenceColumns($conn);
            if (empty($cols)) {
                // fall back to using column names that may be in the fetched row
                $cols = getRecurrenceColsFromRow($gro);
            }
            if (empty($cols)) {
                echo json_encode(['status'=>'error','message'=>'Event is not part of a series','suggestion'=>'If your events table lacks a recurrence_group_id column, add it and run Calendar/scripts/backfill_recurrence_groups.php to populate series ids. Example: ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(64) NULL']);
                exit;
            }
            // read the group's id from any existing column
            $selectCols = implode(', ', $cols);
            $gstmt = $conn->prepare("SELECT " . $selectCols . " FROM events WHERE id = ? AND id_users = ?");
            $gstmt->execute([$input['event_id'], $input['id_users']]);
            $gro = $gstmt->fetch(PDO::FETCH_ASSOC);
            $groupId = null;
            if ($gro) {
                foreach ($cols as $c) { if (!empty($gro[$c])) { $groupId = $gro[$c]; break; } }
            }
            if (!$groupId) {
                echo json_encode(['status'=>'error','message'=>'Event is not part of a series','suggestion'=>'If your events table lacks a recurrence_group_id column, add it and run Calendar/scripts/backfill_recurrence_groups.php to populate series ids. Example: ALTER TABLE events ADD COLUMN recurrence_group_id VARCHAR(64) NULL']);
                exit;
            }
            // Build delete SQL using only existing columns
            $whereParts = [];
            $params = [];
            foreach ($cols as $c) { $whereParts[] = "$c = ?"; $params[] = $groupId; }
            $params[] = $input['id_users'];
            $dsql = "DELETE FROM events WHERE (" . implode(' OR ', $whereParts) . ") AND id_users = ?";
            $dstmt = $conn->prepare($dsql);
            if ($dstmt->execute($params)) {
                try {
                    $cols = detectRecurrenceColumns($conn);
                    if (!empty($cols)) {
                        $whereParts = []; $params = [];
                        foreach ($cols as $c) { $whereParts[] = "$c = ?"; $params[] = $groupId; }
                        $params[] = $input['id_users'];
                        $csql = "SELECT COUNT(*) AS c FROM events WHERE (" . implode(' OR ', $whereParts) . ") AND id_users = ?";
                        $cstmt = $conn->prepare($csql);
                        $cstmt->execute($params);
                        $cntRow = $cstmt->fetch(PDO::FETCH_ASSOC);
                        $count = intval($cntRow['c'] ?? 0);
                    } else { $count = null; }
                } catch (Exception $e) { $count = null; }
                echo json_encode(['status'=>'success','deleted_group_id'=>$groupId,'remaining'=>$count]);
            } else { $err = $dstmt->errorInfo(); echo json_encode(['status'=>'error','message'=>'DB error','debug'=>$err]); }
            break;
        }

        $stmt = $conn->prepare("DELETE FROM events WHERE id = ?"); $stmt->execute([$input['event_id']]); echo json_encode(['status'=>'success']);
        break;

    case 'categories':
        $stmt = $conn->prepare("SELECT id, name, color FROM categories ORDER BY name"); $stmt->execute(); $cats = $stmt->fetchAll(PDO::FETCH_ASSOC); echo json_encode($cats);
        break;

    default:
        echo json_encode(['status'=>'error','message'=>'Unknown action']);
}