<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Start session before any output to avoid header issues
session_start();

// Include database and capture returned connection (file returns connection or false)
$dbReturn = include __DIR__ . '/assets/database.php';
$conn = ($dbReturn === false) ? null : $dbReturn;

require_once __DIR__ . '/assets/auth.php';

function sanitize($data) {
    return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
}

// Temporary auth debug logger (dev only). Writes minimal info to assets/auth_debug.log
function write_auth_debug($line) {
  $path = __DIR__ . '/assets/auth_debug.log';
  $ts = date('c');
  @file_put_contents($path, "[{$ts}] {$line}\n", FILE_APPEND | LOCK_EX);
}

$login_error = $register_error = $register_success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // LOGIN
  if (isset($_POST['login_submit'])) {
    // Use a sanitized email (not HTML-escaped) and raw trimmed password for verification
    $email = filter_var(trim($_POST['login_email'] ?? ''), FILTER_SANITIZE_EMAIL);
    $pass = isset($_POST['login_password']) ? trim($_POST['login_password']) : '';
    if ($conn && is_object($conn) && method_exists($conn, 'prepare')) {
      $stmt = $conn->prepare("SELECT * FROM users WHERE email=?");
      $stmt->execute([$email]);
      $user = $stmt->fetch();
      // Log minimal debug info to help diagnose login failures
      try {
          if ($user) {
              $hashLen = isset($user['password']) ? strlen($user['password']) : 0;
              $v = password_verify($pass, $user['password']) ? 'MATCH' : 'NO_MATCH';
              write_auth_debug("login email={$email} user_id={$user['id']} hash_len={$hashLen} verify={$v}");
          } else {
              write_auth_debug("login email={$email} user_not_found");
          }
      } catch (Throwable $t) { write_auth_debug('login exception: ' . $t->getMessage()); }
      if ($user && password_verify($pass, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['email'] = $user['email'];
        header('Location: month.php');
        exit;
      } else {
        $login_error = "Invalid username or password.";
      }
    } else {
      $login_error = "Database unavailable. Please try again later.";
    }
  }
    // REGISTER
  if (isset($_POST['register_submit'])) {
        $first_name = sanitize($_POST['first_name']);
        $last_name = sanitize($_POST['last_name']);
        $email = sanitize($_POST['email']);
        $pass1 = $_POST['pass1'] ?? '';
        $pass2 = $_POST['pass2'] ?? '';
        if (!$first_name || !$last_name || !$email || !$pass1 || !$pass2) {
            $register_error = "All fields are required.";
        } elseif ($pass1 !== $pass2) {
            $register_error = "Passwords do not match.";
        } else {
            $checkStmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
            $checkStmt->execute([$email]);
            $exists = $checkStmt->fetchColumn();
      if ($exists) {
        $register_error = "Email already in use.";
      } else {
        if ($conn && is_object($conn) && method_exists($conn, 'prepare')) {
          $password = password_hash($pass1, PASSWORD_DEFAULT);
          $stmt = $conn->prepare("INSERT INTO users (first_name, last_name, email, password, created_at) VALUES (?, ?, ?, ?, GETDATE())");
          try {
            $stmt->execute([$first_name, $last_name, $email, $password]);
            $register_success = "Registration successful! You can now <a href='index.php'>log in here</a>.";
          } catch (PDOException $e) {
            $register_error = "An error occurred: " . $e->getMessage();
          }
        } else {
          $register_error = "Database unavailable. Please try again later.";
        }
      }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Login/Register</title>
    <link rel="stylesheet" href="index.css" />
  </head>
  <body>
<?php include 'templates/header/header-fragment.php'; ?>
    <div class="container">
      <h2>Login</h2>
      <form method="post" autocomplete="on">
        <input type="email" name="login_email" placeholder="Email" required autocomplete="email" />
        <input type="password" name="login_password" placeholder="Password" required autocomplete="current-password" />
        <button type="submit" name="login_submit">Login</button>
      </form>
      <?php if($login_error) echo "<p style='color:red;'>$login_error</p>"; ?>
      <hr />
      <h2>Register</h2>
      <form method="post" autocomplete="on">
        <input type="text" name="first_name" placeholder="First name" required value="<?php if (isset($_POST['first_name'])) echo $_POST['first_name']; ?>" autocomplete="given-name" />
        <input type="text" name="last_name" placeholder="Last name" required value="<?php if (isset($_POST['last_name'])) echo $_POST['last_name']; ?>" autocomplete="family-name" />
        <input type="email" name="email" placeholder="Email Address" required value="<?php if (isset($_POST['email'])) echo $_POST['email']; ?>" autocomplete="email" />
        <input type="password" name="pass1" placeholder="Password" required autocomplete="new-password" />
        <input type="password" name="pass2" placeholder="Confirm password" required autocomplete="new-password" />
        <button type="submit" name="register_submit">Register</button>
      </form>
      <?php if($register_error) echo "<p style='color:red;'>$register_error</p>"; ?>
      <?php if($register_success) echo "<p style='color:green;'>$register_success</p>"; ?>
    </div>
<?php include 'templates/footer/footer.php'; ?>
<script>
  window.currentUserId = <?php echo json_encode($_SESSION['user_id'] ?? null); ?>;
</script>
  </body>
</html>