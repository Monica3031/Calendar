<?php
// Dump a user's DB row for debugging. Run in Kudu: php site/wwwroot/Calendar/scripts/dump_user.php 'user@example.com'
$db = include __DIR__ . '/../assets/database.php';
if (!$db || !is_object($db) || !method_exists($db, 'prepare')) {
    fwrite(STDERR, "Database unavailable or adapter missing\n");
    exit(2);
}
$email = $argv[1] ?? null;
if (!$email) { fwrite(STDERR, "Usage: php dump_user.php email\n"); exit(2); }
$stmt = $db->prepare("SELECT * FROM users WHERE email=?");
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user) { echo "User not found\n"; exit(0); }
// Print key fields useful for debugging
echo "id: " . ($user['id'] ?? '') . "\n";
echo "email: " . ($user['email'] ?? '') . "\n";
$pw = $user['password'] ?? null;
echo "password_len: " . ($pw === null ? 'NULL' : strlen($pw)) . "\n";
echo "password_hash: " . ($pw ?? '') . "\n";
// Also print the raw row as JSON
echo json_encode($user, JSON_PRETTY_PRINT) . "\n";
