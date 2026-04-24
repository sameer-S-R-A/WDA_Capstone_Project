const API_BASE = 'http://localhost:5000/api';

async function apiFetch(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body !== null) config.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Invalid server response');
    }

    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
}

function saveSession(data) {
    localStorage.setItem('lms_token',   data.token);
    localStorage.setItem('lms_role',    data.role);
    localStorage.setItem('lms_name',    data.name);
    localStorage.setItem('lms_user_id', String(data.user_id));
}

function getToken()   { return localStorage.getItem('lms_token'); }
function getRole()    { return localStorage.getItem('lms_role'); }
function getUserName(){ return localStorage.getItem('lms_name'); }
function getUserId()  { return localStorage.getItem('lms_user_id'); }

function logout() {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_role');
    localStorage.removeItem('lms_name');
    localStorage.removeItem('lms_user_id');
    window.location.href = '/index.html';
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

function requireRole(role) {
    if (!getToken() || getRole() !== role) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

function redirectByRole() {
    const role = getRole();
    const routes = {
        batch_manager: '/pages/manager/dashboard.html',
        teacher:       '/pages/teacher/dashboard.html',
        student:       '/pages/student/dashboard.html',
    };
    if (routes[role]) window.location.href = routes[role];
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastContainer = null;

function showToast(message, type = 'info') {
    if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'toast-container';
        document.body.appendChild(_toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    _toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function initModalBackdropClose(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs(tabBarId) {
    const tabBar = document.getElementById(tabBarId);
    if (!tabBar) return;
    const tabs = tabBar.querySelectorAll('[data-tab]');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            document.getElementById(targetId)?.classList.add('active');
        });
    });

    if (tabs.length > 0) tabs[0].click();
}

// ── Nav helpers ───────────────────────────────────────────────────────────────
function highlightActiveNav() {
    const currentFile = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-link').forEach(link => {
        const linkFile = (link.getAttribute('href') || '').split('/').pop();
        if (linkFile && linkFile === currentFile) link.classList.add('active');
    });
}

function setNavbarUser() {
    const el = document.getElementById('navbar-user');
    if (el) el.textContent = getUserName() || '';
}

// ── Date formatter ─────────────────────────────────────────────────────────────
function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── URL param helper ───────────────────────────────────────────────────────────
function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}
