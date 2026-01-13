<?php
// Lightweight DB connectivity checker for this project.
// Usage: access this file from the web app or run with PHP built-in server for quick local tests.
header('Content-Type: application/json');

$out = [
    'success' => false,
    'connection' => null,
    'message' => null,
    'rows' => null,
];

// Include database.php which returns a connection object/resource or false
$dbReturn = include __DIR__ . '/database.php';
if ($dbReturn === false) {
    $out['message'] = 'assets/database.php returned false (no connection). Check assets/db_diagnostics.log for details.';
    echo json_encode($out);
    exit;
}

$conn = $dbReturn;

// Detect PDO
if ($conn instanceof PDO) {
    $out['connection'] = 'pdo';
    try {
        $stmt = $conn->query('SELECT 1 AS ok');
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $out['success'] = true;
        $out['rows'] = $row;
        $out['message'] = 'PDO query succeeded';
    } catch (Exception $e) {
        $out['message'] = 'PDO query failed: ' . $e->getMessage();
    }
    echo json_encode($out);
    exit;
}

// PDO-like adapter or object with prepare()
if (is_object($conn) && method_exists($conn, 'prepare')) {
    $out['connection'] = 'pdo-like-adapter';
    try {
        $stmt = $conn->prepare('SELECT 1 AS ok');
        $ok = $stmt->execute();
        $row = $stmt->fetch();
        $out['success'] = $ok ? true : false;
        $out['rows'] = $row;
        $out['message'] = 'PDO-like prepare/execute completed';
    } catch (Exception $e) {
        $out['message'] = 'Adapter query failed: ' . $e->getMessage();
    }
    echo json_encode($out);
    exit;
}

// sqlsrv resource
if (is_resource($conn) || (function_exists('get_resource_type') && get_resource_type($conn) === 'SQL Server Connection')) {
    $out['connection'] = 'sqlsrv_resource';
    $q = @sqlsrv_query($conn, 'SELECT 1 AS ok');
    if ($q === false) {
        $errs = sqlsrv_errors();
        $out['message'] = 'sqlsrv_query failed';
        $out['rows'] = $errs;
    } else {
        $row = sqlsrv_fetch_array($q, SQLSRV_FETCH_ASSOC);
        $out['success'] = true;
        $out['rows'] = $row;
        $out['message'] = 'sqlsrv_query succeeded';
    }
    echo json_encode($out);
    exit;
}

$out['connection'] = gettype($conn);
$out['message'] = 'Unknown connection type; cannot run test';
echo json_encode($out);

?>