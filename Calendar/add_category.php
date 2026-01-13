<?php
header('Content-Type: application/json');

// Ensure we get the DB connection returned by database.php
$conn = require_once __DIR__ . '/assets/database.php';
if (!$conn) {
    echo json_encode(['status' => 'error', 'message' => 'Database connection unavailable']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['status' => 'error', 'message' => 'No input']);
    exit;
}

$name = isset($input['name']) ? trim($input['name']) : '';
$color = isset($input['color']) ? trim($input['color']) : '';

if ($name === '') {
    echo json_encode(['status' => 'error', 'message' => 'Name is required']);
    exit;
}

    try {
        // Use OUTPUT INSERTED.id to get inserted id atomically (works for SQL Server)
        $stmt = $conn->prepare("INSERT INTO categories (name, color) OUTPUT INSERTED.id AS id VALUES (?, ?)");
        if ($stmt->execute([$name, $color])) {
            $id = null;
            try {
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $id = $row ? ($row['id'] ?? null) : null;
            } catch (Throwable $t) {
                error_log('Warning: fetch after INSERT failed in add_category.php: ' . $t->getMessage());
            }
            if (!$id) {
                try { $id = $conn->lastInsertId(); } catch (Exception $e) { $id = null; }
            }
            echo json_encode(['status' => 'success', 'id' => $id, 'name' => $name, 'color' => $color]);
        } else {
            $err = $stmt->errorInfo();
            echo json_encode(['status' => 'error', 'message' => $err[2] ?? 'DB error']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
