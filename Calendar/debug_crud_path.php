<?php
// Debug helper: report candidate CRUD.php locations and filesystem existence
header('Content-Type: application/json');
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($base === '/' || $base === '.') $base = '';
$candidates = [
    $base . '/CRUD.php',
    $base . '/Calendar/CRUD.php',
    '/Calendar/CRUD.php',
    '/CRUD.php',
];
$results = [];
foreach ($candidates as $p) {
    $file = $_SERVER['DOCUMENT_ROOT'] . $p;
    $exists = @file_exists($file);
    $results[] = ['candidate' => $p, 'filesystem_path' => $file, 'exists' => $exists];
}
$chosen = null;
foreach ($results as $r) {
    if ($r['exists']) { $chosen = $r['candidate']; break; }
}
if ($chosen === null) $chosen = '/Calendar/CRUD.php';
echo json_encode(['base' => $base, 'chosen' => $chosen, 'results' => $results]);
exit;
