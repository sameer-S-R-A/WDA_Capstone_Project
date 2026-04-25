from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import pymysql.cursors
import bcrypt
import jwt
import os
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

SECRET_KEY = os.getenv('SECRET_KEY', 'fallback_secret_32chars_changeme!')
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'lms_db'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
}
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_db():
    return pymysql.connect(**DB_CONFIG)


def generate_password(length=10):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id, role, institution_id):
    payload = {
        'user_id': user_id,
        'role': role,
        'institution_id': institution_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])


def send_email(to_email, subject, html_body):
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f'[EMAIL SKIP] SMTP not configured — would have sent to: {to_email}')
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg.attach(MIMEText(html_body, 'html'))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as exc:
        print(f'[EMAIL ERROR] Failed to send to {to_email}: {exc}')
        return False


def credential_email_html(name, role_label, institution_name, email, password):
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#4F46E5;color:#fff;padding:24px;">
      <h1 style="margin:0;font-size:24px;">Welcome to LMS</h1>
    </div>
    <div style="padding:24px;">
      <p>Hello <strong>{name}</strong>,</p>
      <p>Your account has been created as <strong>{role_label}</strong>
         at <strong>{institution_name}</strong>.</p>
      <div style="background:#1e1e2e;color:#cdd6f4;border-radius:8px;
                  padding:20px;font-family:monospace;margin:20px 0;">
        <p style="margin:4px 0;">Email: <span style="color:#89dceb;">{email}</span></p>
        <p style="margin:4px 0;">Password: <span style="color:#a6e3a1;">{password}</span></p>
      </div>
      <div style="background:#FEF3C7;border-left:4px solid #F59E0B;
                  padding:12px 16px;border-radius:4px;">
        <strong>&#9888; Save your password now.</strong> It will never be shown again.
      </div>
    </div>
  </div>
</body>
</html>"""


# ── Auth decorators ───────────────────────────────────────────────────────────

def _extract_user(required_roles=None):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None, jsonify({'error': 'Unauthorized'}), 401
    token = auth_header.split(' ', 1)[1]
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        return None, jsonify({'error': 'Token expired'}), 401
    except Exception:
        return None, jsonify({'error': 'Invalid token'}), 401
    if required_roles and payload.get('role') not in required_roles:
        return None, jsonify({'error': 'Forbidden'}), 403
    return payload, None, None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user, err_resp, code = _extract_user()
        if err_resp:
            return err_resp, code
        request.user = user
        return f(*args, **kwargs)
    return decorated


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user, err_resp, code = _extract_user(required_roles=roles)
            if err_resp:
                return err_resp, code
            request.user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


# ── Public routes ─────────────────────────────────────────────────────────────

@app.route('/api/register-institution', methods=['POST'])
def register_institution():
    data = request.get_json(force=True) or {}
    name = (data.get('name') or '').strip()
    admin_name = (data.get('admin_name') or '').strip()
    email = (data.get('email') or '').strip()

    if not name or not admin_name or not email:
        return jsonify({'error': 'name, admin_name and email are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM institutions LIMIT 1')
            if cur.fetchone():
                return jsonify({'error': 'Institution already registered. Only one institution per deployment.'}), 409

            cur.execute('INSERT INTO institutions (name) VALUES (%s)', (name,))
            institution_id = conn.lastrowid

            password = generate_password()
            hashed = hash_password(password)
            cur.execute(
                'INSERT INTO users (name, email, password, role, institution_id) VALUES (%s,%s,%s,%s,%s)',
                (admin_name, email, hashed, 'batch_manager', institution_id),
            )
            conn.commit()

        html = credential_email_html(admin_name, 'Batch Manager', name, email, password)
        email_sent = send_email(email, 'LMS — Your Batch Manager Credentials', html)

        return jsonify({
            'manager_email': email,
            'manager_password': password,
            'email_sent': email_sent,
            'institution_name': name,
        }), 201
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(force=True) or {}
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT * FROM users WHERE email = %s', (email,))
            user = cur.fetchone()
        if not user or not verify_password(password, user['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = create_token(user['id'], user['role'], user['institution_id'])
        return jsonify({'token': token, 'role': user['role'], 'name': user['name'], 'user_id': user['id']})
    finally:
        conn.close()


# ── Batch Manager: Batches ────────────────────────────────────────────────────

@app.route('/api/batches', methods=['GET'])
@require_role('batch_manager')
def list_batches():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT b.*,
                       COUNT(DISTINCT s.id)          AS subject_count,
                       COUNT(DISTINCT bs.student_id) AS student_count
                FROM batches b
                LEFT JOIN subjects s      ON s.batch_id  = b.id
                LEFT JOIN batch_students bs ON bs.batch_id = b.id
                WHERE b.institution_id = %s
                GROUP BY b.id
                ORDER BY b.created_at DESC
            ''', (request.user['institution_id'],))
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/batches', methods=['POST'])
@require_role('batch_manager')
def create_batch():
    data = request.get_json(force=True) or {}
    name = (data.get('name') or '').strip()
    year = data.get('year')
    description = (data.get('description') or '').strip()

    if not name or not year:
        return jsonify({'error': 'name and year are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO batches (name, year, description, institution_id) VALUES (%s,%s,%s,%s)',
                (name, int(year), description, request.user['institution_id']),
            )
            conn.commit()
            return jsonify({'id': conn.lastrowid, 'name': name}), 201
    finally:
        conn.close()


@app.route('/api/batches/<int:batch_id>', methods=['PUT'])
@require_role('batch_manager')
def update_batch(batch_id):
    data = request.get_json(force=True) or {}
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE batches SET name=%s, year=%s, description=%s WHERE id=%s AND institution_id=%s',
                (data.get('name'), data.get('year'), data.get('description'),
                 batch_id, request.user['institution_id']),
            )
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@app.route('/api/batches/<int:batch_id>', methods=['DELETE'])
@require_role('batch_manager')
def archive_batch(batch_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE batches SET status='archived' WHERE id=%s AND institution_id=%s",
                (batch_id, request.user['institution_id']),
            )
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ── Batch Manager: Subjects ───────────────────────────────────────────────────

@app.route('/api/batches/<int:batch_id>/subjects', methods=['GET'])
@require_role('batch_manager')
def list_batch_subjects(batch_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT s.*, u.name AS teacher_name
                FROM subjects s
                LEFT JOIN users u ON u.id = s.teacher_id
                WHERE s.batch_id = %s
                ORDER BY s.created_at ASC
            ''', (batch_id,))
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/batches/<int:batch_id>/subjects', methods=['POST'])
@require_role('batch_manager')
def add_subject(batch_id):
    data = request.get_json(force=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Subject name is required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('INSERT INTO subjects (name, batch_id) VALUES (%s,%s)', (name, batch_id))
            conn.commit()
            return jsonify({'id': conn.lastrowid, 'name': name}), 201
    finally:
        conn.close()


@app.route('/api/subjects/<int:subject_id>/assign', methods=['PUT'])
@require_role('batch_manager')
def assign_teacher(subject_id):
    data = request.get_json(force=True) or {}
    teacher_id = data.get('teacher_id')
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('UPDATE subjects SET teacher_id=%s WHERE id=%s', (teacher_id, subject_id))
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
@require_role('batch_manager')
def delete_subject(subject_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM subjects WHERE id=%s', (subject_id,))
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ── Batch Manager: Students ───────────────────────────────────────────────────

@app.route('/api/batches/<int:batch_id>/students', methods=['GET'])
@require_role('batch_manager')
def list_batch_students(batch_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT u.id, u.name, u.email, bs.enrolled_at
                FROM users u
                JOIN batch_students bs ON bs.student_id = u.id
                WHERE bs.batch_id = %s
                ORDER BY bs.enrolled_at DESC
            ''', (batch_id,))
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('enrolled_at'), datetime):
                r['enrolled_at'] = r['enrolled_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/batches/<int:batch_id>/students', methods=['POST'])
@require_role('batch_manager')
def add_student(batch_id):
    data = request.get_json(force=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()

    if not name or not email:
        return jsonify({'error': 'name and email are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM users WHERE email=%s', (email,))
            if cur.fetchone():
                return jsonify({'error': 'Email already registered'}), 409

            password = generate_password()
            hashed = hash_password(password)
            cur.execute(
                'INSERT INTO users (name, email, password, role, institution_id) VALUES (%s,%s,%s,%s,%s)',
                (name, email, hashed, 'student', request.user['institution_id']),
            )
            student_id = conn.lastrowid
            cur.execute('INSERT INTO batch_students (batch_id, student_id) VALUES (%s,%s)', (batch_id, student_id))

            cur.execute('SELECT name FROM institutions WHERE id=%s', (request.user['institution_id'],))
            inst = cur.fetchone()
            conn.commit()

        inst_name = inst['name'] if inst else 'LMS'
        html = credential_email_html(name, 'Student', inst_name, email, password)
        send_email(email, 'LMS — Your Student Credentials', html)
        return jsonify({'email': email, 'password': password}), 201
    finally:
        conn.close()


@app.route('/api/batches/<int:batch_id>/students/<int:student_id>', methods=['DELETE'])
@require_role('batch_manager')
def remove_student(batch_id, student_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM batch_students WHERE batch_id=%s AND student_id=%s',
                (batch_id, student_id),
            )
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ── Batch Manager: Teachers ───────────────────────────────────────────────────

@app.route('/api/teachers', methods=['GET'])
@require_role('batch_manager')
def list_teachers():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, created_at FROM users WHERE role='teacher' AND institution_id=%s ORDER BY created_at DESC",
                (request.user['institution_id'],),
            )
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/teachers', methods=['POST'])
@require_role('batch_manager')
def add_teacher():
    data = request.get_json(force=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()

    if not name or not email:
        return jsonify({'error': 'name and email are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM users WHERE email=%s', (email,))
            if cur.fetchone():
                return jsonify({'error': 'Email already registered'}), 409

            password = generate_password()
            hashed = hash_password(password)
            cur.execute(
                'INSERT INTO users (name, email, password, role, institution_id) VALUES (%s,%s,%s,%s,%s)',
                (name, email, hashed, 'teacher', request.user['institution_id']),
            )
            cur.execute('SELECT name FROM institutions WHERE id=%s', (request.user['institution_id'],))
            inst = cur.fetchone()
            conn.commit()

        inst_name = inst['name'] if inst else 'LMS'
        html = credential_email_html(name, 'Teacher', inst_name, email, password)
        send_email(email, 'LMS — Your Teacher Credentials', html)
        return jsonify({'email': email, 'password': password}), 201
    finally:
        conn.close()


# ── Teacher: Subjects ─────────────────────────────────────────────────────────

@app.route('/api/teacher/subjects', methods=['GET'])
@require_role('teacher')
def teacher_subjects():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT s.id, s.name, b.name AS batch_name,
                       COUNT(DISTINCT CASE WHEN c.type='note'  THEN c.id END) AS notes_count,
                       COUNT(DISTINCT CASE WHEN c.type='video' THEN c.id END) AS videos_count,
                       COUNT(DISTINCT CASE WHEN d.status='pending' THEN d.id END) AS pending_doubts
                FROM subjects s
                JOIN batches b ON b.id = s.batch_id
                LEFT JOIN content c ON c.subject_id = s.id
                LEFT JOIN doubts d  ON d.subject_id = s.id
                WHERE s.teacher_id = %s
                GROUP BY s.id, s.name, b.name
                ORDER BY b.name, s.name
            ''', (request.user['user_id'],))
            return jsonify(cur.fetchall())
    finally:
        conn.close()


# ── Student: Subjects ─────────────────────────────────────────────────────────

@app.route('/api/student/subjects', methods=['GET'])
@require_role('student')
def student_subjects():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT s.id, s.name, b.name AS batch_name, u.name AS teacher_name
                FROM subjects s
                JOIN batches b        ON b.id  = s.batch_id
                JOIN batch_students bs ON bs.batch_id  = b.id
                LEFT JOIN users u     ON u.id  = s.teacher_id
                WHERE bs.student_id = %s AND b.status = 'active'
                ORDER BY b.name, s.name
            ''', (request.user['user_id'],))
            return jsonify(cur.fetchall())
    finally:
        conn.close()


# ── Shared: Content ───────────────────────────────────────────────────────────

@app.route('/api/content', methods=['GET'])
@require_auth
def list_content():
    subject_id = request.args.get('subject_id')
    content_type = request.args.get('type')

    if not subject_id:
        return jsonify({'error': 'subject_id is required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            sql = '''SELECT c.*, u.name AS teacher_name
                     FROM content c
                     JOIN users u ON u.id = c.teacher_id
                     WHERE c.subject_id = %s'''
            params = [subject_id]
            if content_type:
                sql += ' AND c.type = %s'
                params.append(content_type)
            sql += ' ORDER BY c.created_at DESC'
            cur.execute(sql, params)
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/content', methods=['POST'])
@require_role('teacher')
def add_content():
    data = request.get_json(force=True) or {}
    subject_id = data.get('subject_id')
    title = (data.get('title') or '').strip()
    content_type = data.get('type')
    url = (data.get('url') or '').strip()

    if not all([subject_id, title, content_type, url]):
        return jsonify({'error': 'subject_id, title, type and url are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO content (subject_id, teacher_id, title, type, url) VALUES (%s,%s,%s,%s,%s)',
                (subject_id, request.user['user_id'], title, content_type, url),
            )
            conn.commit()
            return jsonify({'id': conn.lastrowid}), 201
    finally:
        conn.close()


@app.route('/api/content/<int:content_id>', methods=['DELETE'])
@require_role('teacher')
def delete_content(content_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM content WHERE id=%s AND teacher_id=%s',
                (content_id, request.user['user_id']),
            )
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ── Shared: Doubts ────────────────────────────────────────────────────────────

@app.route('/api/doubts', methods=['GET'])
@require_auth
def list_doubts():
    subject_id = request.args.get('subject_id')
    status = request.args.get('status')
    role = request.user['role']
    user_id = request.user['user_id']

    if not subject_id:
        return jsonify({'error': 'subject_id is required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            sql = '''SELECT d.*, u.name AS student_name
                     FROM doubts d
                     JOIN users u ON u.id = d.student_id
                     WHERE d.subject_id = %s'''
            params = [subject_id]
            if role == 'student':
                sql += ' AND d.student_id = %s'
                params.append(user_id)
            if status:
                sql += ' AND d.status = %s'
                params.append(status)
            sql += ' ORDER BY d.created_at DESC'
            cur.execute(sql, params)
            rows = cur.fetchall()
        for r in rows:
            for field in ('created_at', 'replied_at'):
                if isinstance(r.get(field), datetime):
                    r[field] = r[field].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


@app.route('/api/doubts', methods=['POST'])
@require_role('student')
def raise_doubt():
    data = request.get_json(force=True) or {}
    subject_id = data.get('subject_id')
    text = (data.get('text') or '').strip()

    if not subject_id or not text:
        return jsonify({'error': 'subject_id and text are required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO doubts (subject_id, student_id, text) VALUES (%s,%s,%s)',
                (subject_id, request.user['user_id'], text),
            )
            conn.commit()
            return jsonify({'id': conn.lastrowid}), 201
    finally:
        conn.close()


@app.route('/api/doubts/<int:doubt_id>/reply', methods=['PUT'])
@require_role('teacher')
def reply_doubt(doubt_id):
    data = request.get_json(force=True) or {}
    reply = (data.get('reply') or '').strip()

    if not reply:
        return jsonify({'error': 'reply is required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO doubt_replies (doubt_id, teacher_id, reply_text, is_followup) VALUES (%s,%s,%s,0)',
                (doubt_id, request.user['user_id'], reply),
            )
            cur.execute(
                "UPDATE doubts SET status='resolved', replied_at=NOW() WHERE id=%s",
                (doubt_id,),
            )
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@app.route('/api/doubts/<int:doubt_id>/followup', methods=['POST'])
@require_role('teacher')
def followup_doubt(doubt_id):
    data = request.get_json(force=True) or {}
    note = (data.get('note') or '').strip()

    if not note:
        return jsonify({'error': 'note is required'}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO doubt_replies (doubt_id, teacher_id, reply_text, is_followup) VALUES (%s,%s,%s,1)',
                (doubt_id, request.user['user_id'], note),
            )
            cur.execute("UPDATE doubts SET status='pending' WHERE id=%s", (doubt_id,))
            conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@app.route('/api/doubts/<int:doubt_id>/replies', methods=['GET'])
@require_auth
def doubt_replies(doubt_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT dr.*, u.name AS teacher_name
                FROM doubt_replies dr
                JOIN users u ON u.id = dr.teacher_id
                WHERE dr.doubt_id = %s
                ORDER BY dr.created_at ASC
            ''', (doubt_id,))
            rows = cur.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
        return jsonify(rows)
    finally:
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
