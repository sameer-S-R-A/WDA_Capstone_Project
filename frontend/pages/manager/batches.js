requireRole('batch_manager');
setNavbarUser();
highlightActiveNav();

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('create-batch-btn').addEventListener('click', () => openModal('create-batch-modal'));
document.getElementById('close-create-batch').addEventListener('click', () => closeModal('create-batch-modal'));
document.getElementById('cancel-create-batch').addEventListener('click', () => closeModal('create-batch-modal'));
initModalBackdropClose('create-batch-modal');

async function loadBatches() {
    try {
        const batches = await apiFetch('/batches');
        renderBatches(batches);
    } catch (err) {
        showToast('Failed to load batches: ' + err.message, 'error');
    }
}

function renderBatches(batches) {
    const tbody = document.getElementById('batches-tbody');
    if (!batches.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No batches yet.</td></tr>';
        return;
    }
    tbody.innerHTML = batches.map(b => `
        <tr>
            <td><strong>${escHtml(b.name)}</strong></td>
            <td>${b.year}</td>
            <td><span class="batch-description">${escHtml(b.description || '—')}</span></td>
            <td>${b.subject_count}</td>
            <td>${b.student_count}</td>
            <td><span class="badge badge-${b.status}">${b.status}</span></td>
            <td>
                <a href="manage-batch.html?id=${b.id}" class="btn btn-primary btn-sm">Manage</a>
                ${b.status === 'active'
                    ? `<button class="btn btn-danger btn-sm" data-archive="${b.id}">Archive</button>`
                    : ''}
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-archive]').forEach(btn => {
        btn.addEventListener('click', () => archiveBatch(Number(btn.dataset.archive)));
    });
}

async function archiveBatch(id) {
    if (!confirm('Archive this batch? Students will lose access.')) return;
    try {
        await apiFetch(`/batches/${id}`, 'DELETE');
        showToast('Batch archived', 'success');
        loadBatches();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

const createForm = document.getElementById('create-batch-form');
createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(createForm);

    const name = document.getElementById('cb-name').value.trim();
    const year = document.getElementById('cb-year').value.trim();
    const description = document.getElementById('cb-desc').value.trim();

    if (!name) return setFieldError('cb-name-error', 'Batch name is required');
    if (!year) return setFieldError('cb-year-error', 'Year is required');

    const btn = createForm.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
        await apiFetch('/batches', 'POST', { name, year: parseInt(year), description });
        closeModal('create-batch-modal');
        createForm.reset();
        showToast('Batch created!', 'success');
        loadBatches();
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

loadBatches();
