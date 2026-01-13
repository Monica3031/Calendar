<?php

// 1. Configuration 
$server = 'moniakserver.database.windows.net'; 
$database = 'moniaktest'; 
$clientId = '6739285b-cb3f-47da-b46a-b4c110bb6aa4'; // Your User Assigned Managed Identity Client ID

// Get token from MSI endpoint

// Simple file-based diagnostics helper (safe: does NOT write tokens)
function write_db_diag($line) {
    $path = __DIR__ . '/db_diagnostics.log';
    $ts = date('c');
    file_put_contents($path, "[{$ts}] {$line}\n", FILE_APPEND | LOCK_EX);
}

// Acquire access token. Strategy:
// 1) If App Service sets IDENTITY_ENDPOINT/IDENTITY_HEADER use that
// 2) Else try the IMDS endpoint (169.254.169.254) with short timeouts
// 3) If both fail, emit diagnostics and stop

$accessToken = null;
$identityEndpoint = getenv('IDENTITY_ENDPOINT');
$identityHeader = getenv('IDENTITY_HEADER');
if ($identityEndpoint && $identityHeader) {
    // App Service / Azure Functions managed identity flow
    $tokenUrl = $identityEndpoint . "?resource=https://database.windows.net/&api-version=2019-08-01";
    try {
        $opts = [
            'http' => [
                'method' => 'GET',
                'header' => "X-IDENTITY-HEADER: $identityHeader",
                'timeout' => 5
            ]
        ];
        $context = stream_context_create($opts);
        $resp = @file_get_contents($tokenUrl, false, $context);
        if ($resp !== false) {
            $arr = json_decode($resp, true);
            $accessToken = $arr['access_token'] ?? null;
        } else {
            write_db_diag('App Service identity endpoint request failed for ' . $tokenUrl);
        }
    } catch (Exception $e) {
        write_db_diag('App Service identity request exception: ' . $e->getMessage());
    }
} else {
    // Try IMDS (VM / some environments). Use short timeouts to avoid long hangs.
    $imdsUrl = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://database.windows.net/";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $imdsUrl);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array("Metadata: true"));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    // Fail fast if host unreachable
    curl_setopt($ch, CURLOPT_FAILONERROR, true);
    $response = @curl_exec($ch);
    if ($response === false) {
        $err = curl_error($ch);
        write_db_diag('IMDS request failed: ' . $err);
    } else {
        $arr = json_decode($response, true);
        $accessToken = $arr['access_token'] ?? null;
    }
    curl_close($ch);
}

if (!$accessToken) {
    write_db_diag('No access token acquired from MSI endpoints; will attempt SQL auth fallback if configured.');
    // Do not die here. Continue to attempt token-based connect (will fail) and then fall back to SQL auth below.
}

// Connect using token
// Helper: attempt sqlsrv_connect with retries
function try_sqlsrv_connect_with_retries($server, $options, $attempts = 3) {
    for ($i = 0; $i < $attempts; $i++) {
        $conn = @sqlsrv_connect($server, $options);
        if ($conn) {
            return $conn;
        }
        $errs = sqlsrv_errors();
        write_db_diag("sqlsrv_connect attempt " . ($i+1) . " failed: " . json_encode($errs));
        // exponential backoff (200ms, 600ms, 1800ms)
        usleep(200000 * pow(3, $i));
    }
    return false;
}

// Thin adapter to present a PDO-like prepare()/execute()/fetch()/fetchAll() API
class SqlSrvPdoAdapter {
    private $conn;
    public function __construct($conn) { $this->conn = $conn; }
    public function prepare($sql) {
        return new class($this->conn, $sql) {
            private $conn; private $sql; private $stmt;
            public function __construct($conn, $sql) { $this->conn = $conn; $this->sql = $sql; }
            public function execute($params = []) {
                $this->stmt = sqlsrv_query($this->conn, $this->sql, $params);
                return $this->stmt !== false;
            }
            public function fetch($mode = null) {
                if (!$this->stmt) return false;
                return sqlsrv_fetch_array($this->stmt, SQLSRV_FETCH_ASSOC);
            }
            public function fetchAll($mode = null) {
                if (!$this->stmt) return [];
                $rows = [];
                while ($r = sqlsrv_fetch_array($this->stmt, SQLSRV_FETCH_ASSOC)) { $rows[] = $r; }
                return $rows;
            }
            public function fetchColumn($col = 0) {
                $r = $this->fetch();
                if ($r === false) return false;
                $vals = array_values($r);
                return $vals[$col] ?? null;
            }
            public function errorInfo() {
                $errs = sqlsrv_errors();
                return [null, $errs[0]['SQLSTATE'] ?? null, $errs[0]['message'] ?? json_encode($errs)];
            }
        };
    }
}

// First try: token-based connection (preferred)
$connectionOptions = array(
    "Database" => $database,
    // Use the acquired access token
    "AccessToken" => $accessToken
);

write_db_diag('Attempting token-based sqlsrv_connect (preferred path)');
$conn = try_sqlsrv_connect_with_retries($server, $connectionOptions, 3);
if ($conn) {
    write_db_diag('sqlsrv_connect succeeded (token path)');
    // NOTE: sqlsrv_connect returns a resource/connection; some code expects PDO.
    // Expose a token alias to avoid undefined variable warnings elsewhere.
    $token = $accessToken;
    // Wrap resource in PDO-like adapter so application code using ->prepare() works
    if (is_resource($conn) || (function_exists('get_resource_type') && get_resource_type($conn) === 'SQL Server Connection')) {
        return new SqlSrvPdoAdapter($conn);
    }
    return $conn;
}

// If token path failed, optionally fall back to SQL authentication if env vars are provided
$dbUser = getenv('DB_USER');
$dbPass = getenv('DB_PASS');
if ($dbUser && $dbPass) {
    write_db_diag('Token path failed; attempting fallback to SQL auth with DB_USER from environment');
    $sqlAuthOptions = array(
        "Database" => $database,
        "UID" => $dbUser,
        "PWD" => $dbPass,
    );
    $conn = try_sqlsrv_connect_with_retries($server, $sqlAuthOptions, 3);
    if ($conn) {
        write_db_diag('sqlsrv_connect succeeded (SQL auth fallback)');
        // Also try to return a PDO instance since the application code uses PDO methods.
        try {
            $dsn = "sqlsrv:Server={$server};Database={$database}";
            $pdo = new PDO($dsn, $dbUser, $dbPass);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            write_db_diag('PDO created successfully for SQL auth fallback');
            return $pdo;
        } catch (Exception $e) {
            write_db_diag('PDO creation for SQL auth fallback failed: ' . $e->getMessage());
            // Fall back to returning a PDO-like adapter wrapping the sqlsrv resource
            if (is_resource($conn) || (function_exists('get_resource_type') && get_resource_type($conn) === 'SQL Server Connection')) {
                return new SqlSrvPdoAdapter($conn);
            }
            return $conn;
        }
    } else {
        $errs = sqlsrv_errors();
        write_db_diag('sqlsrv_connect SQL-auth fallback failed: ' . json_encode($errs));
    }
} else {
    write_db_diag('No DB_USER/DB_PASS env vars present; skipping SQL auth fallback');
}

// All attempts failed
write_db_diag('All sqlsrv_connect attempts failed. See earlier lines for error arrays.');
// If we have a sqlsrv resource but PDO isn't available for the caller, provide a thin adapter
if (isset($conn) && $conn !== false && get_resource_type($conn) === 'SQL Server Connection') {
    write_db_diag('sqlsrv resource present; returning sqlsrv->PDO adapter');

    class SqlSrvPdoAdapter {
        private $conn;
        public function __construct($conn) { $this->conn = $conn; }
        public function prepare($sql) {
            return new class($this->conn, $sql) {
                private $conn; private $sql; private $stmt;
                public function __construct($conn, $sql) { $this->conn = $conn; $this->sql = $sql; }
                public function execute($params = []) {
                    $this->stmt = sqlsrv_query($this->conn, $this->sql, $params);
                    return $this->stmt !== false;
                }
                public function fetch($mode = null) {
                    if (!$this->stmt) return false;
                    return sqlsrv_fetch_array($this->stmt, SQLSRV_FETCH_ASSOC);
                }
                public function fetchAll($mode = null) {
                    if (!$this->stmt) return [];
                    $rows = [];
                    while ($r = sqlsrv_fetch_array($this->stmt, SQLSRV_FETCH_ASSOC)) { $rows[] = $r; }
                    return $rows;
                }
                public function errorInfo() {
                    $errs = sqlsrv_errors();
                    return [null, $errs[0]['SQLSTATE'] ?? null, $errs[0]['message'] ?? json_encode($errs)];
                }
            };
        }
    }

    return new SqlSrvPdoAdapter($conn);
}

// Local development fallback: if TODO_USE_SQLITE is set, create/open a local SQLite DB
// and return a PDO connection. This is opt-in so production deployments aren't affected.
// NOTE: previously an early return here made the fallback unreachable; ensure we honour TODO_USE_SQLITE
if (getenv('TODO_USE_SQLITE') === '1') {
    try {
        $sqlitePath = __DIR__ . '/dev_todos.sqlite';
        write_db_diag('Attempting SQLite fallback at ' . $sqlitePath);
        $pdo = new PDO('sqlite:' . $sqlitePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        // Create todo tables if missing (safe no-op if present)
        $pdo->exec("CREATE TABLE IF NOT EXISTS todo_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            list_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT NULL
        );");
        $pdo->exec("CREATE TABLE IF NOT EXISTS todo_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            list_id INTEGER,
            user_id INTEGER,
            title TEXT,
            done INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );");
        write_db_diag('SQLite fallback ready');
        return $pdo;
    } catch (Exception $e) {
        write_db_diag('SQLite fallback failed: ' . $e->getMessage());
    }
}
