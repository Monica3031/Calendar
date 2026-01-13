<?php
// Lightweight manifest proxy: serves Calendar/manifest.json if present
header('Content-Type: application/json; charset=utf-8');
$path = __DIR__ . '/manifest.json';
if (file_exists($path)) {
    readfile($path);
    exit(0);
}
http_response_code(404);
echo json_encode(["error" => "manifest not found"]);
exit(1);
