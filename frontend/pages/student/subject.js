requireRole('student');
setNavbarUser();
highlightActiveNav();

const subjectId = getParam('id');
if (!subjectId) { showToast('No subject specified', 'error'); }

document.getElementById('logout-btn').addEventListener('click', logout);
initTabs('subject-tabs');

// ── Load subject info ───────────────────────────────────────────────────────
async function loadSubjectInfo() {
    try {
        const subjects = await apiFetch('/student/subjects');
        const s = subjects.find(x => String(x.id) === String(subjectId));
        if (s) {
            document.getElementById('subject-name').textContent      = s.name;
            document.getElementById('page-subject-name').textContent = s.name;
            document.getElementById('page-batch-name').textContent   =
                s.batch_name + (s.teacher_name ? ' · ' + s.teacher_name : '');
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

// ── Videos ──────────────────────────────────────────────────────────────────
async function loadVideos() {
    try {
        const items = await apiFetch(`/content?subject_id=${subjectId}&type=video`);
        renderContent('videos-list', items, 'video');
    } catch (err) {
        showToast('Failed to load videos: ' + err.message, 'error');
    }
}

function renderContent(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!items.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${type === 'note' ? '📄' : '🎬'}</div>
                <h3>No ${type}s uploaded yet</h3>
                <p>Your teacher hasn't added any ${type}s for this subject yet.</p>
            </div>`;
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
                   class="btn btn-primary btn-sm">${type === 'note' ? 'View / Download' : 'Watch'}</a>
            </div>
        </div>
    `).join('');
}

// ── Doubts ──────────────────────────────────────────────────────────────────
document.getElementById('submit-doubt-btn').addEventListener('click', async () => {
    const text = document.getElementById('doubt-text').value.trim();
    if (!text) { showToast('Please describe your doubt', 'error'); return; }

    const btn = document.getElementById('submit-doubt-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
        await apiFetch('/doubts', 'POST', { subject_id: parseInt(subjectId), text });
        document.getElementById('doubt-text').value = '';
        showToast('Doubt submitted!', 'success');
        loadDoubts();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Doubt';
    }
});

async function loadDoubts() {
    try {
        const doubts = await apiFetch(`/doubts?subject_id=${subjectId}`);
        renderDoubts(doubts);
    } catch (err) {
        showToast('Failed to load doubts: ' + err.message, 'error');
    }
}

async function renderDoubts(doubts) {
    const container = document.getElementById('doubts-list');
    if (!doubts.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <h3>No doubts yet</h3>
                <p>Use the form above to raise your first doubt.</p>
            </div>`;
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
                    <span>${formatDate(d.created_at)}</span>
                </div>
                <span class="badge badge-${d.status}">${d.status}</span>
            </div>
            <div class="doubt-text">${escHtml(d.text)}</div>
            ${replies.length ? `
                <div class="doubt-replies">
                    ${replies.map(r => `
                        <div class="reply-item ${r.is_followup ? 'followup-type' : 'reply-type'}">
                            <div class="reply-label">${r.is_followup ? 'Follow-up Note' : 'Teacher Reply'}</div>
                            <div>${escHtml(r.reply_text)}</div>
                            <div class="reply-meta">${escHtml(r.teacher_name)} · ${formatDate(r.created_at)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : `<p style="font-size:0.8125rem;color:var(--text-muted);margin-top:8px;">Awaiting teacher reply…</p>`}
        </div>
    `).join('');
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
loadSubjectInfo();
loadNotes();
loadVideos();
loadDoubts();
