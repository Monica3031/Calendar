<?php
// Start session if none exists to avoid "session already active" notices
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Configurable persistent login cookie lifetime (days)
if (!defined('USER_LOGIN_COOKIE_DAYS')) {
    define('USER_LOGIN_COOKIE_DAYS', 30); // default to 30 days
}

// Secret used to sign persistent login cookie. In production set this to a secure random value
if (!defined('AUTH_COOKIE_SECRET')) {
    define('AUTH_COOKIE_SECRET', 'please_change_this_to_a_random_secret');
}

// Ensure this variable is always defined
$user_is_authenticated = !empty($_SESSION['user_id']);

// If session is not set but persistent cookie exists, try to rehydrate session
if (empty($_SESSION['user_id']) && !empty($_COOKIE['user_login'])) {
    $val = $_COOKIE['user_login'];
    $parts = explode(':', $val, 2);
    if (count($parts) === 2) {
        $uid = $parts[0];
        $sig = $parts[1];
        $expected = hash_hmac('sha256', $uid, AUTH_COOKIE_SECRET);
        if (hash_equals($expected, $sig)) {
            // restore minimal session state
            $_SESSION['user_id'] = is_numeric($uid) ? intval($uid) : $uid;
            // note: don't populate $_SESSION['user'] here unless you load from DB
            $user_is_authenticated = true;
        } else {
            // invalid signature: remove cookie
            setcookie('user_login', '', time() - 3600, '/');
        }
    }
}

// If authenticated, set a long-lived cookie — only if headers still can be sent
if ($user_is_authenticated) {
    $cookie_name  = 'user_login';
    // Use a signed value: userId:signature so we can restore session on subsequent requests
    $uid = $_SESSION['user_id'];
    $sig = hash_hmac('sha256', (string)$uid, AUTH_COOKIE_SECRET);
    $cookie_value = $uid . ':' . $sig;
    // persistent cookie duration (in seconds)
    $duration     = time() + (USER_LOGIN_COOKIE_DAYS * 24 * 60 * 60);

    if (!headers_sent()) {
        setcookie($cookie_name, $cookie_value, [
            'expires'  => $duration,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            // 'secure' => true, // enable when serving over HTTPS
        ]);
    } else {
        error_log('auth.php: headers already sent — skipping setcookie');
    }
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

function require_login() {
    if (!is_logged_in()) {
        header('Location: ../index.php');
        exit;
    }
}
