<?php
// Simple migration script to create todo_lists and todo_items tables when missing.
// Run from CLI or via the browser (if permitted).
require_once __DIR__ . '/../../Calendar/CRUD.php';
try {
    $conn = get_db_connection();
} catch (Exception $e) {
    echo "DB connect failed: " . $e->getMessage(); exit(1);
}

// helper to run a SQL statement and ignore errors
function run($conn, $sql) {
    try {
        $s = $conn->prepare($sql);
        $s->execute();
        return true;
    } catch (Exception $e) {
        file_put_contents(__DIR__.'/../assets/crud_requests.log', date('c')." migration: " . $e->getMessage() . PHP_EOL, FILE_APPEND | LOCK_EX);
        return false;
    }
}

// Create todo_lists
// SQL Server-friendly: create table only if it doesn't exist
$sql1 = "IF OBJECT_ID('dbo.todo_lists','U') IS NULL\nBEGIN\nCREATE TABLE dbo.todo_lists (\n    id INT IDENTITY(1,1) PRIMARY KEY,\n    user_id INT NOT NULL,\n    title NVARCHAR(255) NULL,\n    list_date DATE NULL,\n    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()\n)\nEND";
run($conn, $sql1);

// Create todo_items
// SQL Server-friendly: create todo_items
$sql2 = "IF OBJECT_ID('dbo.todo_items','U') IS NULL\nBEGIN\nCREATE TABLE dbo.todo_items (\n    id INT IDENTITY(1,1) PRIMARY KEY,\n    list_id INT NULL,\n    user_id INT NOT NULL,\n    title NVARCHAR(1024) NOT NULL,\n    done BIT NOT NULL CONSTRAINT DF_todo_items_done DEFAULT(0),\n    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()\n)\nEND";
run($conn, $sql2);

echo "migration complete\n";
