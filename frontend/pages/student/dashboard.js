requireRole('student');
setNavbarUser();
highlightActiveNav();

document.getElementById('logout-btn').addEventListener('click', logout);

const firstName = (getUserName() || 'Student').split(' ')[0];
document.getElementById('welcome-name').textContent = firstName;

async function loadSubjects() {
    const grid = document.getElementById('subjects-grid');
    try {
        const subjects = await apiFetch('/student/subjects');
        if (!subjects.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3>No subjects yet</h3>
                    <p>You have not been enrolled in any active batch.</p>
                </div>`;
            return;
        }
        grid.innerHTML = subjects.map(s => `
            <a href="subject.html?id=${s.id}" class="subject-card">
                <div class="subject-card-name">${escHtml(s.name)}</div>
                <div class="subject-card-meta">
                    ${escHtml(s.batch_name)}<br>
                    ${s.teacher_name ? 'Teacher: ' + escHtml(s.teacher_name) : 'No teacher assigned'}
                </div>
                <div class="subject-open-badge">Open Subject →</div>
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
