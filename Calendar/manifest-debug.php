<?php
// Simple debug helper to diagnose why the web manifest isn't detected by browsers.
header('Content-Type: application/json');
// compute same $base used in header-fragment.php
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
if ($base === '/' || $base === '.') $base = '';
$href = $base . '/manifest.json';
$fsPath = __DIR__ . '/manifest.json';
$exists = file_exists($fsPath);
$manifest = null;
if ($exists) {
    $manifest = @file_get_contents($fsPath);
    // try to json-decode it for readability
    $decoded = @json_decode($manifest, true);
} else {
    $decoded = null;
}

echo json_encode([
    'requested_url' => ($_SERVER['REQUEST_URI'] ?? null),
    'script_name' => $_SERVER['SCRIPT_NAME'] ?? null,
    'base' => $base,
    'manifest_href' => $href,
    'manifest_fs_path' => $fsPath,
    'manifest_exists' => $exists,
    'manifest_valid_json' => is_array($decoded) || is_object($decoded),
    'manifest_parsed' => $decoded ?: null,
    'raw_manifest' => $exists ? $manifest : null,
]);

// End of file
