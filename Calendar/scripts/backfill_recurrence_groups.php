<?php
// Backfill recurrence_group_id for probable series.
// Heuristic: group events by id_users + event_title, compute day diffs between
// consecutive events, and if a common interval repeats (>=2 occurrences) we
// assign a generated group id to those rows that currently have NULL.

chdir(__DIR__ . '/..');
// Load DB connection using project's adapter
$conn = include __DIR__ . '/../assets/database.php';
if (!$conn) { echo "DB connection failed\n"; exit(1); }

// Fetch events ordered by user, title, date
$stmt = $conn->prepare("SELECT id, id_users, event_start_date, event_title, recurrence_group_id FROM events WHERE event_start_date IS NOT NULL ORDER BY id_users, event_title, event_start_date");
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (!$rows) { echo "No events found or fetch failed.\n"; exit(0); }

$groups = [];
foreach ($rows as $r) {
    $key = ($r['id_users'] ?? '0') . '||' . trim($r['event_title'] ?? '');
    if (!isset($groups[$key])) $groups[$key] = [];
    $groups[$key][] = $r;
}

$assigned = 0; $candidates = 0; $skipped = 0;
foreach ($groups as $key => $items) {
    if (count($items) < 2) { $skipped += count($items); continue; }
    // compute diffs in days between consecutive items
    $diffs = [];
    for ($i=1;$i<count($items);$i++) {
        $d1 = new DateTime(substr($items[$i-1]['event_start_date'],0,10));
        $d2 = new DateTime(substr($items[$i]['event_start_date'],0,10));
        $diff = (int)$d1->diff($d2)->format('%a');
        $diffs[] = $diff;
    }
    if (empty($diffs)) { $skipped += count($items); continue; }
    // find most common diff
    $counts = array_count_values($diffs);
    arsort($counts);
    $mostCommon = (int)array_key_first($counts);
    $occurrences = $counts[$mostCommon] ?? 0;
    // require at least two equal diffs (3 events) or two events with daily/weekly/monthly heuristics
    $allowed = [1,7,28,30,365];
    if ($occurrences >= 2 || (count($items) == 2 && in_array($mostCommon, $allowed))) {
        // candidate series
        $candidates++;
        // assign a group id for events in this bucket that lack one
        $groupId = bin2hex(random_bytes(8));
        $idsToUpdate = [];
        foreach ($items as $it) {
            if (empty($it['recurrence_group_id'])) $idsToUpdate[] = $it['id'];
        }
        if (empty($idsToUpdate)) continue;
        // Update rows
        $placeholders = rtrim(str_repeat('?,', count($idsToUpdate)), ',');
        $sql = "UPDATE events SET recurrence_group_id = ? WHERE id IN ($placeholders)";
        $params = array_merge([$groupId], $idsToUpdate);
        $ust = $conn->prepare($sql);
        $ok = $ust->execute($params);
        if ($ok) {
            $assigned += count($idsToUpdate);
            echo "Assigned group $groupId to " . count($idsToUpdate) . " events for key $key\n";
        } else {
            echo "Failed to assign group for key $key: " . json_encode($ust->errorInfo()) . "\n";
        }
    } else {
        $skipped += count($items);
    }
}

echo "Done. candidates=$candidates assigned=$assigned skipped=$skipped\n";

// Usage: php Calendar/scripts/backfill_recurrence_groups.php
