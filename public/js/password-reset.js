document.addEventListener('DOMContentLoaded', () => {
  const requestForm = document.getElementById('forgot-password-form');
  const resetForm = document.getElementById('reset-password-form');

  if (requestForm) {
    const status = document.getElementById('forgot-password-status');
    const button = requestForm.querySelector('button[type="submit"]');
    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!requestForm.reportValidity()) return;
      status.textContent = '';
      button.disabled = true;
      try {
        const result = await api('/api/auth/password-reset/request', {
          method: 'POST',
          body: { email: new FormData(requestForm).get('email') },
        });
        status.textContent = result.message;
      } catch {
        status.textContent = 'Could not process that request. Please try again.';
      } finally {
        button.disabled = false;
      }
    });
  }

  if (resetForm) {
    const status = document.getElementById('reset-password-status');
    const password = document.getElementById('new-password');
    const confirmation = document.getElementById('confirm-password');
    const button = resetForm.querySelector('button[type="submit"]');
    const token = new URLSearchParams(location.search).get('token') || '';
    const clearMismatch = () => confirmation.setCustomValidity('');
    confirmation.addEventListener('input', clearMismatch);
    password.addEventListener('input', clearMismatch);
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearMismatch();
      if (password.value !== confirmation.value) {
        confirmation.setCustomValidity('Passwords must match.');
        confirmation.reportValidity();
        return;
      }
      if (!resetForm.reportValidity()) return;
      if (!token) {
        status.textContent = 'This reset link is invalid or expired.';
        return;
      }
      status.textContent = '';
      button.disabled = true;
      let completed = false;
      try {
        const result = await api('/api/auth/password-reset/complete', {
          method: 'POST',
          body: { token, password: password.value },
        });
        completed = true;
        status.className = 'reset-success';
        status.textContent = result.message;
        password.disabled = true;
        confirmation.disabled = true;
        button.textContent = 'Password updated';
      } catch (error) {
        const errors = error.data?.errors || {};
        status.textContent = errors.password || errors.token || 'Could not update the password. Request a new reset link.';
        if (errors.password) password.focus();
      } finally {
        if (!completed) button.disabled = false;
      }
    });
  }
});
