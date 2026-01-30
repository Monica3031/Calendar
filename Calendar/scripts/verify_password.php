<?php
// Verify a plaintext password against stored hash. Run in Kudu: php site/wwwroot/Calendar/scripts/verify_password.php 'user@example.com' 'plaintext'
$db = include __DIR__ . '/../assets/database.php';
if (!$db || !is_object($db) || !method_exists($db, 'prepare')) {
    fwrite(STDERR, "Database unavailable or adapter missing\n");
    exit(2);
}
if ($argc < 3) { fwrite(STDERR, "Usage: php verify_password.php email plaintext_password\n"); exit(2); }
$email = $argv[1];
$plaintext = $argv[2];
$stmt = $db->prepare("SELECT * FROM users WHERE email=?");
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user) { echo "User not found\n"; exit(0); }
$hash = $user['password'] ?? null;
echo "Stored hash length: " . ($hash === null ? 'NULL' : strlen($hash)) . "\n";
echo "Stored hash (first 200 chars): " . ($hash === null ? '' : substr($hash,0,200)) . "\n";
$ok = password_verify($plaintext, $hash);
echo "password_verify returned: " . ($ok ? 'TRUE' : 'FALSE') . "\n";
// If password_needs_rehash available, show that too
if (function_exists('password_needs_rehash')) {
    echo "needs_rehash: " . (password_needs_rehash($hash, PASSWORD_DEFAULT) ? 'TRUE' : 'FALSE') . "\n";
}
