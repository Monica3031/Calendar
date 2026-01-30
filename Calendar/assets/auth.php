<?php
/**
 * AUTH.PHP - Core Authentication Logic
 * 1. ob_start() prevents "Headers already sent" errors by buffering output.
 * 2. Health check block satisfies Azure's monitoring probes.
 */
ob_start();

// Detect Azure Health Check probe to avoid 302 Redirect failures
$is_azure_health_check = (isset($_SERVER['HTTP_USER_AGENT']) && strpos($_SERVER['HTTP_USER_AGENT'], 'HealthCheck') !== false);

// Start session if none exists
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Configurable persistent login cookie settings
if (!defined('USER_LOGIN_COOKIE_DAYS')) define('USER_LOGIN_COOKIE_DAYS', 30);
if (!defined('AUTH_COOKIE_SECRET'))     define('AUTH_COOKIE_SECRET', 'please_change_this_to_a_random_secret');

$user_is_authenticated = !empty($_SESSION['user_id']);

// Session rehydration from cookie
if (!$user_is_authenticated && !empty($_COOKIE['user_login'])) {
    $parts = explode(':', $_COOKIE['user_login'], 2);
    if (count($parts) === 2) {
        $expected = hash_hmac('sha256', $parts[0], AUTH_COOKIE_SECRET);
        if (hash_equals($expected, $parts[1])) {
            $_SESSION['user_id'] = is_numeric($parts[0]) ? intval($parts[0]) : $parts[0];
            $user_is_authenticated = true;
        } else {
            setcookie('user_login', '', time() - 3600, '/');
        }
    }
}

// Set persistent cookie if authenticated and headers are clear
if ($user_is_authenticated && !headers_sent()) {
    $sig = hash_hmac('sha256', (string)$_SESSION['user_id'], AUTH_COOKIE_SECRET);
    setcookie('user_login', $_SESSION['user_id'] . ':' . $sig, [
        'expires'  => time() + (USER_LOGIN_COOKIE_DAYS * 86400),
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => isset($_SERVER['HTTPS']) // Only send over HTTPS if available
    ]);
}

$user = $_SESSION['user'] ?? null;

function is_logged_in() {
    return !empty($_SESSION['user_id']);
}

function current_user_id() {
    if (!empty($_SESSION['user_id'])) {
        return $_SESSION['user_id'];
    }
    if (!empty($_SESSION['user']['id'])) {
        return $_SESSION['user']['id'];
    }
    return null;
}

/**
 * Enhanced require_login
 * Allows Azure Health Check to pass without being redirected to index.php
 */
function require_login() {
    global $is_azure_health_check;
    
    if ($is_azure_health_check) {
        return; // Exit function silently so Azure sees a 200 OK
    }

    if (!is_logged_in()) {
        header('Location: ../index.php');
        exit;
    }
}
