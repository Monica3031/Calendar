<?php
header('Content-Type: application/json');

$conn = require_once __DIR__ . '/assets/database.php';
if (!$conn) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database connection unavailable']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$name = isset($input['name']) ? trim($input['name']) : '';
$color = isset($input['color']) ? trim($input['color']) : null;
if ($name === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Name required']);
    exit;
}

try {
    // Use OUTPUT INSERTED.id so the adapter returns the new id directly
    $stmt = $conn->prepare('INSERT INTO categories (name, color) OUTPUT INSERTED.id AS id VALUES (?, ?)');
    if (!$stmt->execute([$name, $color])) {
        $err = $stmt->errorInfo();
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $err[2] ?? 'Insert failed']);
        exit;
    }
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $id = $row ? ($row['id'] ?? null) : null;
    if (!$id) { try { $id = $conn->lastInsertId(); } catch (Exception $e) { $id = null; } }

    echo json_encode(['status' => 'success', 'id' => $id, 'name' => $name, 'color' => $color]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

?>
