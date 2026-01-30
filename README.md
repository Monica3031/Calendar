# My Calendar App 📅

A comprehensive, modern calendar application built with PHP and vanilla JavaScript. Keep track of your schedule, manage events, and stay organized with this powerful Progressive Web App (PWA) that works seamlessly across all your devices.

## ✨ Features

### 📆 Calendar Views
- **Month View**: Get a bird's-eye view of your entire month with all events displayed
- **Week View**: Focus on your weekly schedule with detailed time slots
- **Day View**: Dive deep into daily planning with hourly breakdowns

### ✅ Task Management
- Create and manage to-do lists
- Quick bullet points for rapid note-taking
- Task completion tracking
- Organized by date for better planning

### 🔄 Event Management
- Create, edit, and delete events with ease
- Recurring events support (daily, weekly, monthly)
- Event categories and color-coding
- Personal event privacy (each user sees only their own events)

### 👤 User Features
- Secure user registration and authentication
- Personal event privacy (user-scoped data access)
- Profile settings management
- Session-based authentication with persistent cookies

### 📱 Progressive Web App (PWA)
- Install on any device (mobile, tablet, desktop)
- Offline capability
- Native app-like experience
- Browser notification support
- Responsive design for all screen sizes

### 🎨 Customization
- Theme modes (dark, light, system)
- Category-based color coding for events
- Customizable event details

## 🛠️ Technology Stack

### Backend
- **PHP**: Server-side logic and API endpoints
- **SQL Server**: Primary database (Azure SQL)
- **Azure Managed Identity**: Secure authentication for Azure services
- **PDO**: Database abstraction layer with SQL Server support

### Frontend
- **Vanilla JavaScript**: No heavy frameworks, pure performance
- **Day.js**: Lightweight date manipulation library
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **Service Workers**: PWA functionality and offline support

### Security
- Password hashing with PHP's `password_hash()`
- Prepared statements to prevent SQL injection
- Input sanitization and validation
- User-scoped data access controls
- HMAC-signed persistent cookies
- Session-based authentication

## 🚀 Getting Started

### Prerequisites
- PHP 7.4 or higher
- SQL Server or Azure SQL Database
- Web server (Apache, Nginx, or PHP built-in server)
- PHP SQL Server drivers (`sqlsrv` extension)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Monica3031/Calendar.git
   cd Calendar/Calendar
   ```

2. **Configure the database**
   - Edit `assets/database.php` with your database credentials
   - Create the required database tables:
     - `users` - User accounts
     - `events` - Calendar events with recurrence support
     - `todo_lists` - Task lists
     - `todo_items` - Individual tasks

3. **Set up Azure Managed Identity** (Optional, for Azure deployments)
   - Configure the User Assigned Managed Identity Client ID in `assets/database.php`
   - Ensure proper permissions are set for Azure SQL access

4. **Configure web server**
   - Point document root to the `Calendar` directory
   - Ensure PHP has write permissions for session storage
   - Enable required PHP extensions: `pdo`, `pdo_sqlsrv`, `sqlsrv`

5. **Access the application**
   ```
   http://localhost/Calendar/index.php
   ```

### Quick Start with PHP Built-in Server

```bash
cd Calendar
php -S localhost:8000
```

Then navigate to `http://localhost:8000/index.php`

## 📖 Usage

1. **Register**: Create a new account on the registration page
2. **Login**: Sign in with your credentials
3. **Add Events**: Click on any date to create a new event
4. **Manage Tasks**: Navigate to the To-Do page to create and manage tasks
5. **Switch Views**: Use the navigation menu to switch between Month, Week, and Day views
6. **Customize**: Visit Settings to personalize your experience

## 🏗️ Architecture

### API Endpoints
The application uses a RESTful API design with JSON request/response format:
- `CRUD.php`: Main API endpoint (~622 lines) handling all CRUD operations
- Event creation, updates, deletion, and retrieval
- Recurrence group management
- User-specific data filtering

### Database Schema
- **users**: User authentication and profile information
- **events**: Calendar events with recurrence support
- **todo_lists**: Task list containers
- **todo_items**: Individual task items

### Authentication Flow
1. Session-based authentication with PHP sessions
2. HMAC-signed persistent cookies for "remember me" functionality
3. Password verification using PHP's `password_verify()`
4. User ID stored in session for request authentication

### PWA Configuration
- `manifest.json`: App metadata and icons
- `sw.js`: Service worker for offline functionality and caching
- Icons: 192x192 and 512x512 PNG icons for various devices

## 🔒 Security Features

- **Input Validation**: All user inputs are sanitized and validated
- **SQL Injection Prevention**: Prepared statements used throughout
- **Password Security**: Bcrypt hashing with `PASSWORD_DEFAULT`
- **Session Security**: Regeneration and timeout handling
- **User Data Isolation**: Events and tasks are scoped to individual users
- **Azure Managed Identity**: Token-based authentication for Azure SQL (no credentials in code)

## 📂 Project Structure

```
Calendar/
├── assets/              # Core utilities and configuration
│   ├── auth.php        # Authentication logic
│   ├── database.php    # Database connection
│   └── db.js           # Client-side database utilities
├── Javascript/         # JavaScript libraries
│   └── vendor/         # Third-party libraries (Day.js)
├── templates/          # Reusable UI components
│   ├── header/         # Header fragments
│   └── footer/         # Footer fragments
├── scripts/            # Utility scripts
├── index.php           # Login/Registration page
├── month.php           # Monthly calendar view
├── week.php            # Weekly calendar view
├── day.php             # Daily calendar view
├── todo.php            # To-do list page
├── settings.php        # User settings
├── CRUD.php            # Main API endpoint
├── add_new_event.php   # Event creation form
├── get_event.php       # Event details retrieval
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
└── *.css / *.js        # View-specific styles and scripts
```

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is available for personal and educational use.

## 👨‍💻 Author

**Monica3031**

## 🙏 Acknowledgments

- Day.js for lightweight date manipulation
- PHP community for excellent documentation
- Azure for cloud hosting capabilities

---

**Note**: This application is designed to work with Azure SQL Database using Managed Identity authentication, with fallback to traditional SQL authentication for local development.
