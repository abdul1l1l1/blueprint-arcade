// Tiny fetch helpers used by every page (quiz-quest pattern)

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('API error'), { status: res.status, data });
  return data;
}

const getMe = () => api('/api/auth/me');
const logout = () => api('/api/auth/logout', { method: 'POST' });
