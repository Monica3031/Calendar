Documentation Coverage
Technology stack: PHP backend with SQL Server/SQLite, vanilla JavaScript frontend, Day.js, PWA support
Architecture patterns: Session-based auth with HMAC-signed persistent cookies, Azure Managed Identity with SQL auth fallback, PDO adapter for SQL Server
Core components: CRUD API endpoint (~1100 lines), calendar views (month/week/day), task management
Database schema: Users, events, todo_lists, todo_items with recurrence support
Security: Password hashing, prepared statements, input sanitization, user-scoped data access
API design: JSON request/response format for all CRUD operations
The documentation serves as a technical reference for understanding the codebase structure, data flow, and implementation patterns used throughout the application.
