requireRole('batch_manager');
setNavbarUser();
highlightActiveNav();

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('add-teacher-btn').addEventListener('click', () => openModal('add-teacher-modal'));
document.getElementById('close-add-teacher').addEventListener('click', () => closeModal('add-teacher-modal'));
document.getElementById('cancel-add-teacher').addEventListener('click', () => closeModal('add-teacher-modal'));
document.getElementById('close-teacher-cred').addEventListener('click', () => closeModal('teacher-cred-modal'));
document.getElementById('ok-teacher-cred').addEventListener('click', () => closeModal('teacher-cred-modal'));
initModalBackdropClose('add-teacher-modal');
initModalBackdropClose('teacher-cred-modal');

async function loadTeachers() {
    try {
        const teachers = await apiFetch('/teachers');
        renderTeachers(teachers);
    } catch (err) {
        showToast('Failed to load teachers: ' + err.message, 'error');
    }
}

function renderTeachers(teachers) {
    const tbody = document.getElementById('teachers-tbody');
    if (!teachers.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="table-empty">No teachers yet. Add your first teacher!</td></tr>';
        return;
    }
    tbody.innerHTML = teachers.map(t => `
        <tr>
            <td>
                <div class="teacher-cell">
                    <span class="teacher-initial">${escHtml(t.name.charAt(0).toUpperCase())}</span>
                    <strong>${escHtml(t.name)}</strong>
                </div>
            </td>
            <td>${escHtml(t.email)}</td>
            <td>${formatDate(t.created_at)}</td>
        </tr>
    `).join('');
}

const addTeacherForm = document.getElementById('add-teacher-form');
addTeacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(addTeacherForm);

    const name  = document.getElementById('teacher-name').value.trim();
    const email = document.getElementById('teacher-email').value.trim();

    if (!name)  return setFieldError('teacher-name-error',  'Name is required');
    if (!email) return setFieldError('teacher-email-error', 'Email is required');

    const btn = addTeacherForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Adding…';

    try {
        const cred = await apiFetch('/teachers', 'POST', { name, email });
        closeModal('add-teacher-modal');
        addTeacherForm.reset();
        showTeacherCredentials(cred.email, cred.password);
        loadTeachers();
    } catch (err) {
        setFieldError('teacher-email-error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Teacher';
    }
});

function showTeacherCredentials(email, password) {
    document.getElementById('t-cred-email').textContent    = email;
    document.getElementById('t-cred-password').textContent = password;
    openModal('teacher-cred-modal');
}

function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function clearFormErrors(form) {
    form.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

loadTeachers();
