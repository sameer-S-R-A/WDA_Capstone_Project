# LMS — Learning Management System

A full-stack LMS (Web Development Capstone Project) with three roles: **Batch Manager**, **Teacher**, and **Student**.

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+)  |
| Backend  | Python 3 · Flask                        |
| Database | MySQL · PyMySQL                         |
| Auth     | JWT (PyJWT) · bcrypt                    |
| Email    | Python smtplib (built-in)               |

---

## Setup

### 1. MySQL — create the database

```bash
mysql -u root -p < backend/schema.sql
```

### 2. Backend — install dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure .env

Edit `backend/.env` with your MySQL credentials and (optionally) SMTP details:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lms_db

SECRET_KEY=change_this_to_a_long_random_string

# Leave blank to skip email (app will not crash)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your_app_password
```

> For Gmail, use an **App Password** (not your account password). Enable 2FA first, then generate one at myaccount.google.com → Security → App passwords.

### 4. Start the backend

```bash
cd backend
python app.py
```

Flask runs on **http://localhost:5000**.

### 5. Serve the frontend

Serve the `frontend/` directory with any static server:

```bash
cd frontend
python -m http.server 8080
```

Open **http://localhost:8080** in your browser.

> Do **not** open HTML files directly with `file://` — fetch requests require a server for CORS to work correctly.

---

## First-time Setup

1. Open `http://localhost:8080`
2. Click **Register Institution**
3. Fill in institution name, your name, and email
4. Your Batch Manager credentials are shown on screen — **save the password now**
5. Sign in with those credentials

---

## Roles and Features

### Batch Manager
- Create and archive batches
- Add subjects to batches and assign teachers
- Enroll students (auto-generates credentials, sends email)
- Add teachers (auto-generates credentials, sends email)

### Teacher
- View assigned subjects with pending doubt counts
- Upload notes and videos (as URLs/links)
- Reply to student doubts — marks as resolved
- Add follow-up notes — re-opens doubt to pending

### Student
- View enrolled subjects across all active batches
- Access notes and videos (opens in new tab)
- Raise doubts with free-text
- View full reply thread (teacher replies in green, follow-up notes in blue)

---

## Project Structure

```
lms/
├── backend/
│   ├── app.py            Flask app — all API routes
│   ├── schema.sql        MySQL table definitions
│   ├── requirements.txt
│   └── .env              DB + SMTP config
└── frontend/
    ├── index.html        Login + Institution Register
    ├── css/
    │   ├── global.css    Design system — all shared components
    │   └── auth.css      Login page styles
    ├── js/
    │   ├── utils.js      apiFetch, auth helpers, toast, modal, tabs
    │   └── auth.js       Login + register logic
    └── pages/
        ├── manager/      dashboard, batches, manage-batch, teachers
        ├── teacher/      dashboard, subject
        └── student/      dashboard, subject
```

---

## API Summary

All endpoints prefixed with `/api`.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/register-institution` | Public | One-time institution setup |
| POST | `/login` | Public | Returns JWT token |
| GET/POST | `/batches` | Manager | List / create batches |
| DELETE | `/batches/:id` | Manager | Archive batch |
| GET/POST | `/batches/:id/subjects` | Manager | List / add subjects |
| PUT | `/subjects/:id/assign` | Manager | Assign teacher |
| DELETE | `/subjects/:id` | Manager | Delete subject |
| GET/POST | `/batches/:id/students` | Manager | List / enroll students |
| DELETE | `/batches/:id/students/:sid` | Manager | Remove student |
| GET/POST | `/teachers` | Manager | List / add teachers |
| GET | `/teacher/subjects` | Teacher | My subjects with stats |
| GET | `/student/subjects` | Student | My enrolled subjects |
| GET/POST | `/content` | Teacher/Student | List / add content |
| DELETE | `/content/:id` | Teacher | Delete content |
| GET/POST | `/doubts` | Teacher/Student | List / raise doubts |
| PUT | `/doubts/:id/reply` | Teacher | Reply — resolves doubt |
| POST | `/doubts/:id/followup` | Teacher | Follow-up — re-opens |
| GET | `/doubts/:id/replies` | Teacher/Student | Full reply thread |
