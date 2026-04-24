requireRole('batch_manager');
setNavbarUser();
highlightActiveNav();

const batchId = getParam('id');
if (!batchId) { showToast('No batch specified', 'error'); }

document.getElementById('logout-btn').addEventListener('click', logout);
initTabs('tabs-bar');

// ── Load batch info ─────────────────────────────────────────────────────────
async function loadBatchInfo() {
    try {
        const batches = await apiFetch('/batches');
        const batch = batches.find(b => String(b.id) === String(batchId));
        if (batch) {
            document.getElementById('batch-title').textContent = batch.name;
            document.getElementById('navbar-batch-name').textContent = batch.name;
            document.getElementById('batch-subtitle').textContent =
                `${batch.year} · ${batch.status}`;
        }
    } catch (_) {}
}

// ── Subjects ────────────────────────────────────────────────────────────────
async function loadSubjects() {
    try {
        const subjects = await apiFetch(`/batches/${batchId}/subjects`);
        renderSubjects(subjects);
    } catch (err) {
        showToast('Failed to load subjects: ' + err.message, 'error');
    }
}

function renderSubjects(subjects) {
    const tbody = document.getElementById('subjects-tbody');
    if (!subjects.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="table-empty">No subjects yet.</td></tr>';
        return;
    }
    tbody.innerHTML = subjects.map(s => `
        <tr>
            <td><strong>${escHtml(s.name)}</strong></td>
            <td>${s.teacher_name ? escHtml(s.teacher_name) : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
            <td>
                <button class="btn btn-secondary btn-sm" data-assign-subject="${s.id}">Assign Teacher</button>
                <button class="btn btn-danger btn-sm" data-delete-subject="${s.id}">Delete</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-assign-subject]').forEach(btn => {
        btn.addEventListener('click', () => openAssignModal(Number(btn.dataset.assignSubject)));
    });
    tbody.querySelectorAll('[data-delete-subject]').forEach(btn => {
        btn.addEventListener('click', () => deleteSubject(Number(btn.dataset.deleteSubject)));
    });
}

document.getElementById('add-subject-btn').addEventListener('click', async () => {
    const input = document.getElementById('subject-name-input');
    const name = input.value.trim();
    if (!name) { showToast('Subject name is required', 'error'); return; }

    try {
        await apiFetch(`/batches/${batchId}/subjects`, 'POST', { name });
        input.value = '';
        showToast('Subject added!', 'success');
        loadSubjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function deleteSubject(id) {
    if (!confirm('Delete this subject? All content and doubts will be lost.')) return;
    try {
        await apiFetch(`/subjects/${id}`, 'DELETE');
        showToast('Subject deleted', 'success');
        loadSubjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Assign teacher modal ────────────────────────────────────────────────────
let assigningSubjectId = null;

document.getElementById('close-assign-modal').addEventListener('click',  () => closeModal('assign-teacher-modal'));
document.getElementById('cancel-assign').addEventListener('click',       () => closeModal('assign-teacher-modal'));
initModalBackdropClose('assign-teacher-modal');

async function openAssignModal(subjectId) {
    assigningSubjectId = subjectId;
    const select = document.getElementById('teacher-select');
    select.innerHTML = '<option value="">Loading…</option>';
    openModal('assign-teacher-modal');

    try {
        const teachers = await apiFetch('/teachers');
        select.innerHTML = '<option value="">— choose a teacher —</option>' +
            teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    } catch (err) {
        showToast('Could not load teachers', 'error');
        closeModal('assign-teacher-modal');
    }
}

document.getElementById('confirm-assign').addEventListener('click', async () => {
    const teacherId = document.getElementById('teacher-select').value;
    if (!teacherId) { showToast('Please select a teacher', 'error'); return; }

    try {
        await apiFetch(`/subjects/${assigningSubjectId}/assign`, 'PUT', { teacher_id: parseInt(teacherId) });
        closeModal('assign-teacher-modal');
        showToast('Teacher assigned!', 'success');
        loadSubjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ── Students ────────────────────────────────────────────────────────────────
async function loadStudents() {
    try {
        const students = await apiFetch(`/batches/${batchId}/students`);
        renderStudents(students);
    } catch (err) {
        showToast('Failed to load students: ' + err.message, 'error');
    }
}

function renderStudents(students) {
    const tbody = document.getElementById('students-tbody');
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No students enrolled yet.</td></tr>';
        return;
    }
    tbody.innerHTML = students.map(s => `
        <tr>
            <td><strong>${escHtml(s.name)}</strong></td>
            <td>${escHtml(s.email)}</td>
            <td>${formatDate(s.enrolled_at)}</td>
            <td>
                <button class="btn btn-danger btn-sm" data-remove-student="${s.id}">Remove</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-remove-student]').forEach(btn => {
        btn.addEventListener('click', () => removeStudent(Number(btn.dataset.removeStudent)));
    });
}

document.getElementById('add-student-btn').addEventListener('click', async () => {
    const nameEl  = document.getElementById('student-name-input');
    const emailEl = document.getElementById('student-email-input');
    const name  = nameEl.value.trim();
    const email = emailEl.value.trim();

    if (!name)  { showToast('Student name is required', 'error'); return; }
    if (!email) { showToast('Student email is required', 'error'); return; }

    try {
        const cred = await apiFetch(`/batches/${batchId}/students`, 'POST', { name, email });
        nameEl.value  = '';
        emailEl.value = '';
        showStudentCredentials(cred.email, cred.password);
        loadStudents();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function removeStudent(studentId) {
    if (!confirm('Remove this student from the batch?')) return;
    try {
        await apiFetch(`/batches/${batchId}/students/${studentId}`, 'DELETE');
        showToast('Student removed', 'success');
        loadStudents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Student credentials modal ───────────────────────────────────────────────
document.getElementById('close-student-cred').addEventListener('click', () => closeModal('student-cred-modal'));
document.getElementById('ok-student-cred').addEventListener('click',    () => closeModal('student-cred-modal'));
initModalBackdropClose('student-cred-modal');

function showStudentCredentials(email, password) {
    document.getElementById('cred-email').textContent    = email;
    document.getElementById('cred-password').textContent = password;
    openModal('student-cred-modal');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────────
loadBatchInfo();
loadSubjects();
loadStudents();
