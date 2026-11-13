(function () {
  'use strict';

  const state = document.getElementById('settings-state');
  const content = document.getElementById('settings-content');
  const form = document.getElementById('delete-account-form');
  const password = document.getElementById('delete-account-password');
  const confirmation = document.getElementById('delete-account-confirmation');
  const error = document.getElementById('delete-account-error');
  const submit = document.getElementById('delete-account-submit');

  function showLogin() {
    state.replaceChildren();
    const panel = BuildsUI.node('div', 'build-state-panel');
    panel.append(BuildsUI.node('h2', '', 'Log in to open Settings'));
    panel.append(BuildsUI.node('p', '', 'Your account settings are private.'));
    const link = BuildsUI.node('a', 'btn btn-primary', 'Log in');
    link.href = '/login.html';
    panel.append(link);
    state.append(panel);
  }

  async function start() {
    try {
      const result = await getMe();
      if (!result.user) return showLogin();
      document.getElementById('settings-account').textContent = `Signed in as ${result.user.username}`;
      document.getElementById('settings-username').value = result.user.username;
      state.replaceChildren();
      content.hidden = false;
    } catch {
      BuildsUI.statePanel(state, 'Settings could not be loaded', 'Check your connection and try again.', {
        error: true,
        retry: start,
      });
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    error.textContent = '';
    if (confirmation.value !== 'DELETE') {
      error.textContent = 'Type DELETE exactly to continue.';
      error.hidden = false;
      confirmation.focus();
      return;
    }
    if (!password.value) {
      error.textContent = 'Enter your current password to continue.';
      error.hidden = false;
      password.focus();
      return;
    }
    if (!window.confirm('Permanently delete your account, builds, related activity, sessions, and uploaded images? This cannot be undone.')) return;

    submit.disabled = true;
    try {
      await api('/api/auth/me', {
        method: 'DELETE',
        body: { password: password.value, confirmation: confirmation.value },
      });
      content.hidden = true;
      BuildsUI.statePanel(state, 'Account deleted', 'Your account and personal data have been deleted. You are signed out.');
    } catch (requestError) {
      error.textContent = BuildsUI.apiMessage(requestError, 'Account deletion failed. Your account was not deleted.');
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('DOMContentLoaded', start);
})();
