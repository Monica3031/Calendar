# Calendar Application - Code Description

## Overview

This is a full-featured web-based calendar application that allows users to manage events, tasks, and schedules. The application is built with PHP on the backend and vanilla JavaScript on the frontend, providing a Progressive Web App (PWA) experience.

## Technology Stack

### Backend
- **PHP**: Server-side logic, authentication, and database operations
- **SQL Server**: Primary database (Azure SQL Database with Managed Identity authentication)
- **SQLite**: Optional fallback for local development
- **PDO/SQL Server Driver**: Database abstraction layer

### Frontend
- **Vanilla JavaScript**: Client-side interactivity
- **Day.js**: Date manipulation library
- **CSS3**: Styling with support for dark mode
- **HTML5**: Semantic markup

### Features
- Progressive Web App (PWA) support with service worker
- Responsive design for mobile and desktop
- Dark mode support
- Offline capabilities

## Application Architecture

### Authentication System
Located in `assets/auth.php`:
- Session-based authentication with persistent login cookies
- Signed cookies using HMAC for security
- 30-day default cookie lifetime
- Support for session restoration from cookies
- Helper functions: `is_logged_in()`, `current_user_id()`, `require_login()`

### Database Connection
Located in `assets/database.php`:
- **Primary**: Azure SQL Server with Managed Identity (token-based authentication)
- **Fallback 1**: SQL authentication (username/password via environment variables)
- **Fallback 2**: SQLite for local development (when `TODO_USE_SQLITE=1`)
- PDO-compatible adapter wrapper for SQL Server connections
- Automatic retry logic with exponential backoff
- Detailed diagnostics logging to `assets/db_diagnostics.log`

### Main Application Pages

#### 1. **index.php** - Login/Registration Page
- Entry point for unauthenticated users
- Dual-purpose form (login and registration)
- Password hashing with `password_hash()`
- Email validation and duplicate checking
- Redirects to `month.php` after successful login

#### 2. **month.php** - Monthly Calendar View
- Grid-based calendar display (7x6 grid for weeks)
- Month/year navigation controls
- Displays events for the selected month
- Uses Day.js for date calculations and ISO week support
- Interactive day cells that load events

#### 3. **week.php** - Weekly Calendar View
- Horizontal weekly schedule view
- Shows 7 days with hourly time slots
- Horizontal scrolling for mobile devices
- Time-based event positioning
- Navigation between weeks

#### 4. **day.php** - Single Day View
- Detailed view of events for a specific day
- Date picker for navigation
- Event list with full details
- Inline event creation and editing
- Modal form for event details

#### 5. **todo.php** - Task Management
- Quick bullet list for simple tasks
- Date-based task organization
- Task completion tracking
- Reuses day.php layout for consistency
- Stores tasks in `todo_lists` and `todo_items` tables

#### 6. **settings.php** - User Settings
- User preferences management
- Account settings
- Application configuration

## Core Components

### CRUD Operations (CRUD.php)
The central API endpoint for all database operations. **Large file (~1100 lines)** handling:

**Supported Actions:**
- `create`: Create new events
- `read`: Fetch events for a date range or specific user
- `update`: Modify existing events
- `delete`: Remove events
- `search`: Full-text search across events
- `create_todo_list`: Create task lists
- `get_todo_lists`: Retrieve tasks
- `update_todo_item`: Modify task status
- `delete_todo_item`: Remove tasks

**Features:**
- Session-aware (uses `$_SESSION['user_id']` as default)
- JSON input/output
- Comprehensive logging to `assets/crud_requests.log`
- Recurrence group detection and handling
- Error handling with detailed error messages

### JavaScript Modules

#### calendar.js
- Search functionality for events
- Fetches events matching search query
- Displays results in dropdown
- Opens event details on result click

#### month.js
- Renders monthly calendar grid
- Handles month/year navigation
- Calculates day positions (padding for starting day)
- Event loading and display
- Click handlers for day cells

#### week.js (~1050 lines)
- Complex weekly schedule rendering
- Time slot calculations (typically 24-hour grid)
- Event positioning based on start/end times
- Drag-and-drop event rescheduling (likely)
- Responsive horizontal layout

#### day.js
- Single day event list rendering
- Event modal management
- Date picker integration
- CRUD operations via modal forms
- Event editing and deletion

#### todo.js
- Task list rendering
- Quick add functionality
- Task completion toggle
- Date-based task filtering
- List management

### Styling

#### CSS Files Structure
- **calendar.css** (282 lines): Core calendar grid styles
- **month.css** (196 lines): Monthly view specific styles
- **week.css** (192 lines): Weekly view layout
- **day.css** (312 lines): Daily view and event modal styles
- **todo.css** (391 lines): Task list styling
- **index.css** (125 lines): Login/registration forms
- **style.css**: Global styles (empty/deprecated?)

**Common Features:**
- CSS custom properties for theming
- Dark mode support via `.dark-mode` class
- Responsive breakpoints for mobile/tablet/desktop
- Flexbox/Grid layouts
- Transition animations

### Templates

#### templates/header/header-fragment.php
- Navigation menu
- Search bar
- User menu/logout
- Dark mode toggle (likely)
- Mobile hamburger menu (likely)

#### templates/footer/footer.php
- Footer content
- Common scripts
- Analytics (possibly)

#### templates/images/
- Application icons and images

## Database Schema

### Tables

#### users
- `id`: Primary key
- `first_name`: User's first name
- `last_name`: User's last name
- `email`: Unique email address (used for login)
- `password`: Hashed password
- `created_at`: Account creation timestamp

#### events
- `id`: Event ID
- `id_users`: Foreign key to users table
- `event_title`: Event name
- `event_description`: Detailed description
- `event_start_date`: Start date
- `event_end_date`: End date (optional)
- `event_start_time`: Start time (optional)
- `event_end_time`: End time (optional)
- `event_location`: Location text
- `event_category`: Category/type
- `event_color`: Display color
- `recurrence_*`: Recurrence pattern fields (multiple column name variations)
- `created_at`: Creation timestamp
- `updated_at`: Last modification timestamp

#### todo_lists
- `id`: List ID
- `user_id`: Foreign key to users
- `title`: List title
- `list_date`: Date associated with list
- `created_at`: Creation timestamp
- `updated_at`: Modification timestamp

#### todo_items
- `id`: Item ID
- `list_id`: Foreign key to todo_lists
- `user_id`: Foreign key to users
- `title`: Task description
- `done`: Completion status (0/1)
- `created_at`: Creation timestamp

### Recurrence System
The code includes sophisticated handling for recurring events with multiple possible column names:
- `recurrence_group_id`
- `recurrence_group`
- `recurrence_groupid`

Detection is automatic via `detectRecurrenceColumns()` function in CRUD.php.

## Security Features

### Authentication
- Password hashing using `PASSWORD_DEFAULT` (bcrypt)
- Session-based authentication
- Signed persistent login cookies (HMAC-SHA256)
- Cookie security flags: `httponly`, `samesite=Lax`
- Session hijacking prevention

### Input Sanitization
- `sanitize()` function: `htmlspecialchars()` with ENT_QUOTES
- Prepared statements for all database queries (SQL injection prevention)
- JSON input validation

### Authorization
- User-scoped data access (all queries filter by `id_users`)
- Session validation on protected pages
- Authentication required for all pages except index.php

## Progressive Web App (PWA)

### manifest.json
- App name: "My Calendar App"
- Standalone display mode
- Custom icons (192x192, 512x512)
- Theme color: #2196f3
- Background color: #ffffff

### Service Worker (sw.js)
- Offline support
- Asset caching
- Background sync (likely)

## API Design

### Request Format
All API requests to CRUD.php use JSON:
```json
{
  "action": "read",
  "id_users": 123,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

### Response Format
```json
{
  "status": "success",
  "data": [...],
  "message": "Optional message"
}
```

Or on error:
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Helper Files

### assets/helpers.php
- Utility functions (if exists)
- Common operations

### scripts/init_todos.php
- Database initialization script
- Creates todo tables

### scripts/backfill_recurrence_groups.php
- Data migration script
- Updates recurrence group data

### debug_crud_path.php
- Debugging utility for CRUD endpoint resolution

## Configuration

### Environment Variables
- `IDENTITY_ENDPOINT`: Azure Managed Identity endpoint
- `IDENTITY_HEADER`: Azure Managed Identity header
- `DB_USER`: SQL authentication username (fallback)
- `DB_PASS`: SQL authentication password (fallback)
- `TODO_USE_SQLITE`: Enable SQLite fallback (set to "1")

### Constants
- `USER_LOGIN_COOKIE_DAYS`: Cookie lifetime (default: 30)
- `AUTH_COOKIE_SECRET`: HMAC signing secret (should be changed in production)

## Code Organization Patterns

### PHP Files Structure
1. Session/auth initialization
2. Database connection
3. Server-side logic (form processing, data fetching)
4. HTML output
5. JavaScript initialization (window.currentUserId, etc.)

### JavaScript Files Structure
1. DOM element selection
2. Event listener registration
3. API fetch functions
4. UI update functions
5. Helper utilities

### Naming Conventions
- PHP: snake_case for functions and variables
- JavaScript: camelCase for functions and variables
- CSS: kebab-case for classes
- Database: snake_case for tables and columns

## Error Handling

### Server-Side
- PHP error reporting enabled (display_errors, E_ALL)
- Try-catch blocks for database operations
- Detailed error logging to log files
- User-friendly error messages in JSON responses

### Client-Side
- Console logging for debugging
- Try-catch blocks for JSON parsing
- Error display in UI (likely via message containers)
- Graceful degradation when features unavailable

## Performance Considerations

- **Connection Pooling**: Reuses database connections
- **Lazy Loading**: Events loaded on-demand for date ranges
- **Caching**: Service worker caches static assets
- **Prepared Statements**: Improves query performance
- **Minimal Dependencies**: Uses lightweight libraries (Day.js)

## Development vs Production

### Development Mode
- Detailed error messages displayed
- SQLite fallback available
- Comprehensive logging enabled
- Debug endpoints available

### Production Mode
- Azure SQL with Managed Identity
- Error details hidden from users
- HTTPS-only cookies (when enabled)
- Diagnostic logging to files

## Browser Compatibility

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Fetch API
- Local Storage
- Service Workers (for PWA features)

## Mobile Support

- Responsive design with viewport meta tags
- Touch-friendly interface
- Date pickers optimized for mobile
- Horizontal scrolling on week view
- Standalone app mode (PWA)

## Future Enhancement Opportunities

Based on the code structure, potential areas for enhancement:
- Event sharing between users
- Calendar export (iCal format)
- Email notifications
- Recurring event UI improvements
- Task priorities and categories
- Attachment support
- Calendar import
- Multi-language support (i18n)

## File Size Summary

Key files by size (lines of code):
- CRUD.php: ~1100 lines (main API)
- week.js: ~1050 lines (complex scheduling)
- todo.css: 391 lines
- day.css: 312 lines
- calendar.css: 282 lines
- database.php: ~250 lines
- month.css: 196 lines

Total codebase: Estimated 5,000-7,000 lines across PHP, JavaScript, and CSS.

## Summary

This is a well-structured, feature-rich calendar application with:
- Clean separation of concerns
- Secure authentication and authorization
- Flexible database connectivity
- Progressive Web App capabilities
- Comprehensive event management
- Task/todo functionality
- Multiple view modes (month, week, day)
- Search functionality
- Responsive design with dark mode

The codebase follows PHP and JavaScript best practices, uses prepared statements for security, and provides a smooth user experience with offline support and mobile optimization.
