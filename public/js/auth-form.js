// Shared login/register handling; no credentials are stored in the browser.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-auth]');
  if (!form) return;
  const errorBox = form.querySelector('[role="alert"]');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    errorBox.textContent = '';
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    button.disabled = true;
    try {
      await api('/api/auth/' + form.dataset.auth, {
        method: 'POST', body: Object.fromEntries(new FormData(form)),
      });
      location.assign('/');
    } catch (err) {
      const errors = err.data?.errors || { _general: 'Connection failed. Please try again.' };
      for (const [field, message] of Object.entries(errors)) {
        const input = form.elements.namedItem(field);
        if (!input) {
          errorBox.textContent = message;
          continue;
        }
        const text = document.createElement('p');
        text.className = 'error field-error';
        text.id = field + '-error';
        text.textContent = message;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', text.id);
        input.after(text);
      }
      form.querySelector('[aria-invalid]')?.focus();
      button.disabled = false;
    }
  });
});
