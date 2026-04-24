requireRole('teacher');
setNavbarUser();
highlightActiveNav();

document.getElementById('logout-btn').addEventListener('click', logout);

async function loadSubjects() {
    const grid = document.getElementById('subjects-grid');
    try {
        const subjects = await apiFetch('/teacher/subjects');
        if (!subjects.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3>No subjects assigned yet</h3>
                    <p>Ask your Batch Manager to assign subjects to you.</p>
                </div>`;
            return;
        }
        grid.innerHTML = subjects.map(s => `
            <a href="subject.html?id=${s.id}" class="subject-card">
                <div class="subject-card-name">${escHtml(s.name)}</div>
                <div class="subject-card-meta">${escHtml(s.batch_name)}</div>
                <div class="subject-card-stats">
                    <span>📄 ${s.notes_count} notes</span>
                    <span>🎬 ${s.videos_count} videos</span>
                </div>
                <div class="subject-card-footer">
                    <span>Doubts</span>
                    ${s.pending_doubts > 0
                        ? `<span class="pending-count">${s.pending_doubts} pending</span>`
                        : `<span style="color:var(--success)">All resolved</span>`}
                </div>
            </a>
        `).join('');
    } catch (err) {
        showToast('Failed to load subjects: ' + err.message, 'error');
        grid.innerHTML = '<p class="table-empty">Could not load subjects.</p>';
    }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

loadSubjects();
