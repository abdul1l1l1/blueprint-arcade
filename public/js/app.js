// Shared shell: sidebar, top bar (Favorites, Dark Mode, Post a Build), toasts.
// NO emojis anywhere in the UI — text and simple shapes only.

document.addEventListener('DOMContentLoaded', async () => {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.querySelector('a[href="/about.html"]')) {
    const about = document.createElement('a');
    about.href = '/about.html';
    about.textContent = 'About';
    sidebar.append(about);
  }
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
    const notificationLink = document.createElement('a');
    notificationLink.className = 'btn notification-link';
    notificationLink.href = '/notifications.html';
    notificationLink.setAttribute('aria-label', 'Notifications');
    notificationLink.title = 'Notifications';
    const icon = document.createElement('span');
    icon.className = 'notification-bell-icon';
    icon.setAttribute('aria-hidden', 'true');
    const badge = document.createElement('span');
    badge.className = 'notification-count';
    badge.hidden = true;
    notificationLink.append(icon, badge);
    const setUnreadCount = (value) => {
      const count = Number(value) || 0;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
      notificationLink.setAttribute('aria-label', count
        ? `Notifications, ${count} unread` : 'Notifications');
    };
    let notificationListOpened = location.pathname === '/notifications.html';
    document.addEventListener('blueprint:notifications-read', () => {
      notificationListOpened = true;
      setUnreadCount(0);
    });
    auth.append(notificationLink);
    try {
      const result = await api('/api/notifications/unread-count');
      setUnreadCount(notificationListOpened ? 0 : result.unread_count);
    } catch {
      setUnreadCount(0);
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

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  el.style.cssText = 'position:fixed;bottom:82px;right:20px;padding:10px 16px;border-radius:8px;z-index:99;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
