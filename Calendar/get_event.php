<?php
// Lightweight, read-only endpoint to fetch a single event in a normalized JSON shape
// This avoids depending on the full CRUD API for the edit form and is safer for deployments
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/assets/auth.php';
$conn = null;
try { $conn = require_once __DIR__ . '/assets/database.php'; } catch (Throwable $t) { $conn = null; }
if (!$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database unavailable']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_GET;
$eventId = isset($input['event_id']) ? intval($input['event_id']) : 0;
if ($eventId <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid event_id']);
    exit;
}

try {
    if (isset($input['id_users']) && $input['id_users']) {
        $stmt = $conn->prepare("SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON e.category = c.id WHERE e.id = ? AND e.id_users = ?");
        $stmt->execute([$eventId, $input['id_users']]);
    } else {
        $stmt = $conn->prepare("SELECT e.*, c.name AS category_name, c.color AS category_color FROM events e LEFT JOIN categories c ON e.category = c.id WHERE e.id = ?");
        $stmt->execute([$eventId]);
    }
    $event = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$event) {
        echo json_encode(['status' => 'error', 'message' => 'Event not found']);
        exit;
    }

    // Normalize fields for the frontend
    if (empty($event['event_date'])) $event['event_date'] = $event['event_start_date'] ?? null;
    $event['category_id'] = isset($event['category']) ? (int)$event['category'] : null;
    $event['category_name'] = $event['category_name'] ?? null;
    $event['category_color'] = $event['category_color'] ?? null;
    $event['category'] = $event['category_id'];

    $event['event_start_date'] = isset($event['event_start_date']) && $event['event_start_date'] !== '' ? substr($event['event_start_date'], 0, 10) : null;
    $event['event_end_date'] = isset($event['event_end_date']) && $event['event_end_date'] !== '' ? substr($event['event_end_date'], 0, 10) : $event['event_start_date'];

    $event['event_start_time'] = isset($event['event_start_time']) && $event['event_start_time'] !== '' ? substr($event['event_start_time'], 0, 8) : null;
    $event['event_end_time'] = isset($event['event_end_time']) && $event['event_end_time'] !== '' ? substr($event['event_end_time'], 0, 8) : null;

    $event['start'] = $event['event_start_date'];
    $event['end'] = !empty($event['event_end_date']) ? $event['event_end_date'] : $event['event_start_date'];
    $event['start_time'] = $event['event_start_time'];
    $event['end_time'] = $event['event_end_time'];

    $hasStart = !empty($event['event_start_time']);
    $hasEnd = !empty($event['event_end_time']);
    $event['all_day'] = ($hasStart || $hasEnd) ? 0 : 1;
    $event['allDay'] = $event['all_day'];

    echo json_encode($event);
} catch (Throwable $t) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Server error']);
}

