const notificationMessages = {
  like: 'liked your build',
  rating: 'rated your build',
  comment: 'commented on your build',
  repost: 'reposted your build',
};

document.addEventListener('DOMContentLoaded', async () => {
  const state = document.getElementById('notifications-state');
  const list = document.getElementById('notifications-list');
  if (!state || !list) return;
  try {
    const result = await api('/api/notifications/open', { method: 'POST' });
    document.dispatchEvent(new CustomEvent('blueprint:notifications-read'));
    list.replaceChildren();
    if (!result.notifications.length) {
      state.textContent = 'You are all caught up.';
      list.hidden = true;
      return;
    }
    result.notifications.forEach((notification) => {
      const link = document.createElement('a');
      link.className = `card notification-item${notification.readAt ? '' : ' notification-unread'}`;
      link.href = `/build.html?id=${encodeURIComponent(notification.buildId)}`;
      const message = document.createElement('p');
      message.textContent = `${notification.actor} ${notificationMessages[notification.eventType] || 'interacted with'}: ${notification.buildTitle}`;
      const time = document.createElement('time');
      time.dateTime = notification.createdAt;
      const date = new Date(notification.createdAt);
      time.textContent = Number.isNaN(date.valueOf()) ? '' : date.toLocaleString();
      link.append(message, time);
      list.append(link);
    });
    list.hidden = false;
    state.textContent = `${result.notifications.length} notification${result.notifications.length === 1 ? '' : 's'}.`;
  } catch (error) {
    list.hidden = true;
    state.textContent = error.status === 401
      ? 'Log in to view your notifications.'
      : 'Notifications could not be loaded. Please try again.';
    if (error.status === 401) {
      const login = document.createElement('a');
      login.className = 'btn notification-error';
      login.href = '/login.html';
      login.textContent = 'Log in';
      state.after(login);
    }
  }
});
