// Shared shell: sidebar, top bar (Favorites, Dark Mode, Post a Build), toasts.
// NO emojis anywhere in the UI — text and simple shapes only.

document.addEventListener('DOMContentLoaded', async () => {
  // Dark/Light Mode (persisted)
  const saved = localStorage.getItem('ba-theme');
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const auth = document.createElement('div');
  auth.className = 'auth-actions';
  topbar.append(auth);
  try {
    const { user } = await getMe();
    if (!user) {
      const login = document.createElement('a');
      login.className = 'btn';
      login.href = '/login.html';
      login.textContent = 'Log in';
      const register = document.createElement('a');
      register.className = 'btn';
      register.href = '/register.html';
      register.textContent = 'Register';
      auth.append(login, register);
      return;
    }
    const name = document.createElement('span');
    name.textContent = user.displayName || user.username;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Logout';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await logout();
        location.assign('/login.html');
      } catch {
        toast('Logout failed. Please try again.');
        button.disabled = false;
      }
    });
    auth.append(name, button);
  } catch {
    const message = document.createElement('span');
    message.textContent = 'Account unavailable. Please reload to retry.';
    message.setAttribute('role', 'status');
    auth.append(message);
  }
});

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = 'dark';
  localStorage.setItem('ba-theme', dark ? 'light' : 'dark');
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#12233B;color:#fff;padding:10px 16px;border-radius:8px;z-index:99;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
