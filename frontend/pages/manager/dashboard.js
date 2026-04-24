requireRole('batch_manager');
setNavbarUser();
highlightActiveNav();

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('new-batch-btn').addEventListener('click', () => openModal('new-batch-modal'));
document.getElementById('close-new-batch').addEventListener('click', () => closeModal('new-batch-modal'));
document.getElementById('cancel-new-batch').addEventListener('click', () => closeModal('new-batch-modal'));
initModalBackdropClose('new-batch-modal');

async function loadDashboard() {
    try {
        const [batches, teachers] = await Promise.all([
            apiFetch('/batches'),
            apiFetch('/teachers'),
        ]);

        document.getElementById('stat-batches').textContent  = batches.length;
        document.getElementById('stat-active').textContent   = batches.filter(b => b.status === 'active').length;
        document.getElementById('stat-teachers').textContent = teachers.length;

        renderBatches(batches.slice(0, 8));
    } catch (err) {
        showToast('Failed to load dashboard: ' + err.message, 'error');
    }
}

function renderBatches(batches) {
    const tbody = document.getElementById('batches-tbody');
    if (!batches.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No batches yet. Create your first batch!</td></tr>';
        return;
    }
    tbody.innerHTML = batches.map(b => `
        <tr>
            <td><strong>${escHtml(b.name)}</strong></td>
            <td>${b.year}</td>
            <td>${b.subject_count}</td>
            <td>${b.student_count}</td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
            <td><a href="manage-batch.html?id=${b.id}" class="btn btn-primary btn-sm">Manage</a></td>
        </tr>
    `).join('');
}

const newBatchForm = document.getElementById('new-batch-form');
newBatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(newBatchForm);

    const name = document.getElementById('batch-name').value.trim();
    const year = document.getElementById('batch-year').value.trim();
    const description = document.getElementById('batch-desc').value.trim();

    if (!name) return setFieldError('batch-name-error', 'Batch name is required');
    if (!year) return setFieldError('batch-year-error', 'Year is required');

    const btn = newBatchForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
        await apiFetch('/batches', 'POST', { name, year: parseInt(year), description });
        closeModal('new-batch-modal');
        newBatchForm.reset();
        showToast('Batch created!', 'success');
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Batch';
    }
});

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

loadDashboard();
