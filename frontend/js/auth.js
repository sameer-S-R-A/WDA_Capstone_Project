document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) { redirectByRole(); return; }

    // ── Tab switching ───────────────────────────────────────────────────────
    const authTabs   = document.querySelectorAll('.auth-tab');
    const authPanels = document.querySelectorAll('.auth-panel');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            authPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab)?.classList.add('active');
        });
    });

    // ── Login ───────────────────────────────────────────────────────────────
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(loginForm);

        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email)    return setError('login-email-error',    'Email is required');
        if (!password) return setError('login-password-error', 'Password is required');

        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Signing in…';

        try {
            const data = await apiFetch('/login', 'POST', { email, password });
            saveSession(data);
            redirectByRole();
        } catch (err) {
            setError('login-password-error', err.message || 'Invalid credentials');
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // ── Register Institution ────────────────────────────────────────────────
    const registerForm = document.getElementById('register-form');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(registerForm);

        const institution_name = document.getElementById('reg-institution').value.trim();
        const admin_name       = document.getElementById('reg-admin-name').value.trim();
        const email            = document.getElementById('reg-email').value.trim();

        if (!institution_name) return setError('reg-institution-error', 'Institution name is required');
        if (!admin_name)       return setError('reg-admin-name-error',  'Your name is required');
        if (!email)            return setError('reg-email-error',       'Email is required');

        const btn = registerForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Registering…';

        try {
            const data = await apiFetch('/register-institution', 'POST', {
                name: institution_name, admin_name, email,
            });
            showRegisterSuccess(data, institution_name);
        } catch (err) {
            setError('reg-email-error', err.message || 'Registration failed');
            btn.disabled = false;
            btn.textContent = 'Register';
        }
    });

    // ── Go to sign-in after register ────────────────────────────────────────
    document.getElementById('go-to-login').addEventListener('click', () => {
        document.querySelector('.auth-tab[data-tab="login-panel"]').click();
        document.getElementById('register-success').classList.add('d-none');
        registerForm.classList.remove('d-none');
        registerForm.reset();
    });
});

function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function clearErrors(form) {
    form.querySelectorAll('.form-error').forEach(el => {
        el.classList.remove('visible');
        el.textContent = '';
    });
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
}

function showRegisterSuccess(data, institutionName) {
    document.getElementById('register-form').classList.add('d-none');

    document.getElementById('success-inst-name').textContent = institutionName;
    document.getElementById('success-email').textContent     = data.manager_email;
    document.getElementById('success-password').textContent  = data.manager_password;

    const notice = document.getElementById('email-sent-notice');
    if (data.email_sent) notice.classList.remove('d-none');

    document.getElementById('register-success').classList.remove('d-none');
}
