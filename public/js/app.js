// Shared shell: sidebar, top bar (Favorites, Dark Mode, Post a Build), toasts.
// NO emojis anywhere in the UI — text and simple shapes only.

document.addEventListener('DOMContentLoaded', async () => {
  // Dark/Light Mode (persisted)
  const saved = localStorage.getItem('ba-theme');
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
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
