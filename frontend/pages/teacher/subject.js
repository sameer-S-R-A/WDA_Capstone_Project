requireRole('teacher');
setNavbarUser();
highlightActiveNav();

const subjectId = getParam('id');
if (!subjectId) { showToast('No subject specified', 'error'); }

document.getElementById('logout-btn').addEventListener('click', logout);
initTabs('subject-tabs');

// ── Load subject info ───────────────────────────────────────────────────────
async function loadSubjectInfo() {
    try {
        const subjects = await apiFetch('/teacher/subjects');
        const s = subjects.find(x => String(x.id) === String(subjectId));
        if (s) {
            document.getElementById('subject-name').textContent      = s.name;
            document.getElementById('page-subject-name').textContent = s.name;
            document.getElementById('page-batch-name').textContent   = s.batch_name;
        }
    } catch (_) {}
}

// ── Notes ───────────────────────────────────────────────────────────────────
async function loadNotes() {
    try {
        const items = await apiFetch(`/content?subject_id=${subjectId}&type=note`);
        renderContent('notes-list', items, 'note');
    } catch (err) {
        showToast('Failed to load notes: ' + err.message, 'error');
    }
}

document.getElementById('add-note-btn').addEventListener('click', async () => {
    const title = document.getElementById('note-title').value.trim();
    const url   = document.getElementById('note-url').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    if (!url)   { showToast('URL is required', 'error');   return; }

    try {
        await apiFetch('/content', 'POST', { subject_id: parseInt(subjectId), title, type: 'note', url });
        document.getElementById('note-title').value = '';
        document.getElementById('note-url').value   = '';
        showToast('Note added!', 'success');
        loadNotes();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ── Videos ──────────────────────────────────────────────────────────────────
async function loadVideos() {
    try {
        const items = await apiFetch(`/content?subject_id=${subjectId}&type=video`);
        renderContent('videos-list', items, 'video');
    } catch (err) {
        showToast('Failed to load videos: ' + err.message, 'error');
    }
}

document.getElementById('add-video-btn').addEventListener('click', async () => {
    const title = document.getElementById('video-title').value.trim();
    const url   = document.getElementById('video-url').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    if (!url)   { showToast('URL is required', 'error');   return; }

    try {
        await apiFetch('/content', 'POST', { subject_id: parseInt(subjectId), title, type: 'video', url });
        document.getElementById('video-title').value = '';
        document.getElementById('video-url').value   = '';
        showToast('Video added!', 'success');
        loadVideos();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

function renderContent(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!items.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${type === 'note' ? '📄' : '🎬'}</div><h3>No ${type}s yet</h3></div>`;
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="content-item">
            <div class="content-item-left">
                <div class="content-icon content-icon-${type}">${type === 'note' ? '📄' : '🎬'}</div>
                <div>
                    <div class="content-item-title">${escHtml(item.title)}</div>
                    <div class="content-item-date">${formatDate(item.created_at)}</div>
                </div>
            </div>
            <div class="content-item-actions">
                <a href="${escHtml(item.url)}" target="_blank" rel="noopener"
                   class="btn btn-secondary btn-sm">${type === 'note' ? 'View' : 'Watch'}</a>
                <button class="btn btn-danger btn-sm" data-delete-content="${item.id}">Delete</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-delete-content]').forEach(btn => {
        btn.addEventListener('click', () => deleteContent(Number(btn.dataset.deleteContent), type));
    });
}

async function deleteContent(id, type) {
    if (!confirm(`Delete this ${type}?`)) return;
    try {
        await apiFetch(`/content/${id}`, 'DELETE');
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`, 'success');
        type === 'note' ? loadNotes() : loadVideos();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Doubts ──────────────────────────────────────────────────────────────────
let currentFilter = 'all';

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        loadDoubts();
    });
});

async function loadDoubts() {
    try {
        let endpoint = `/doubts?subject_id=${subjectId}`;
        if (currentFilter !== 'all') endpoint += `&status=${currentFilter}`;
        const doubts = await apiFetch(endpoint);
        renderDoubts(doubts);
    } catch (err) {
        showToast('Failed to load doubts: ' + err.message, 'error');
    }
}

async function renderDoubts(doubts) {
    const container = document.getElementById('doubts-list');
    if (!doubts.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><h3>No doubts ${currentFilter !== 'all' ? `(${currentFilter})` : ''}</h3></div>`;
        return;
    }

    const cards = await Promise.all(doubts.map(async (d) => {
        let replies = [];
        try { replies = await apiFetch(`/doubts/${d.id}/replies`); } catch (_) {}
        return { doubt: d, replies };
    }));

    container.innerHTML = cards.map(({ doubt: d, replies }) => `
        <div class="doubt-card">
            <div class="doubt-card-header">
                <div class="doubt-meta">
                    <strong>${escHtml(d.student_name)}</strong>
                    <span>·</span>
                    <span>${formatDate(d.created_at)}</span>
                </div>
                <span class="badge badge-${d.status}">${d.status}</span>
            </div>
            <div class="doubt-text">${escHtml(d.text)}</div>
            ${replies.length ? `
                <div class="doubt-replies">
                    ${replies.map(r => `
                        <div class="reply-item ${r.is_followup ? 'followup-type' : 'reply-type'}">
                            <div class="reply-label">${r.is_followup ? 'Follow-up Note' : 'Reply'}</div>
                            <div>${escHtml(r.reply_text)}</div>
                            <div class="reply-meta">${escHtml(r.teacher_name)} · ${formatDate(r.created_at)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="doubt-actions">
                ${d.status === 'pending'
                    ? `<button class="btn btn-primary btn-sm" data-reply="${d.id}">Reply</button>`
                    : `<button class="btn btn-secondary btn-sm" data-followup="${d.id}">+ Add Follow-up Note</button>`}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-reply]').forEach(btn => {
        btn.addEventListener('click', () => openReplyModal(Number(btn.dataset.reply), false));
    });
    container.querySelectorAll('[data-followup]').forEach(btn => {
        btn.addEventListener('click', () => openReplyModal(Number(btn.dataset.followup), true));
    });
}

// ── Reply modal ──────────────────────────────────────────────────────────────
let replyingDoubtId  = null;
let replyIsFollowup  = false;

document.getElementById('close-reply-modal').addEventListener('click', () => closeModal('reply-modal'));
document.getElementById('cancel-reply').addEventListener('click',       () => closeModal('reply-modal'));
initModalBackdropClose('reply-modal');

function openReplyModal(doubtId, isFollowup) {
    replyingDoubtId = doubtId;
    replyIsFollowup = isFollowup;
    document.getElementById('reply-modal-title').textContent   = isFollowup ? 'Add Follow-up Note' : 'Reply to Doubt';
    document.getElementById('reply-textarea-label').textContent = isFollowup ? 'Follow-up Note' : 'Your Reply';
    document.getElementById('reply-text').value = '';
    document.getElementById('submit-reply').textContent = isFollowup ? 'Add Follow-up' : 'Submit Reply';
    openModal('reply-modal');
}

document.getElementById('submit-reply').addEventListener('click', async () => {
    const text = document.getElementById('reply-text').value.trim();
    if (!text) { showToast('Please enter your reply', 'error'); return; }

    const btn = document.getElementById('submit-reply');
    btn.disabled = true;

    try {
        if (replyIsFollowup) {
            await apiFetch(`/doubts/${replyingDoubtId}/followup`, 'POST', { note: text });
            showToast('Follow-up note added', 'success');
        } else {
            await apiFetch(`/doubts/${replyingDoubtId}/reply`, 'PUT', { reply: text });
            showToast('Reply sent!', 'success');
        }
        closeModal('reply-modal');
        loadDoubts();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────────
loadSubjectInfo();
loadNotes();
loadVideos();
loadDoubts();
