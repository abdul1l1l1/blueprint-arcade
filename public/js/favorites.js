(() => {
  'use strict';
  const state = document.getElementById('favorites-state');
  const grid = document.getElementById('favorites-grid');
  let me = null;

  function panel(title, message, options = {}) {
    state.replaceChildren();
    const box = BuildsUI.node('div', `state-panel${options.error ? ' is-error' : ''}`);
    box.append(BuildsUI.node('h2', '', title), BuildsUI.node('p', '', message));
    if (options.login) {
      const link = BuildsUI.node('a', 'btn btn-primary', 'Log in');
      link.href = `/login.html?next=${encodeURIComponent('/favorites.html')}`;
      box.append(link);
    }
    if (options.retry) {
      const button = BuildsUI.node('button', 'btn', 'Retry');
      button.type = 'button';
      button.addEventListener('click', options.retry);
      box.append(button);
    }
    state.append(box);
  }
  async function load() {
    state.replaceChildren();
    grid.replaceChildren();
    for (let index = 0; index < 3; index += 1) grid.append(BuildsUI.node('div', 'build-skeleton'));
    try {
      const response = await api('/api/social/favorites');
      if (!Array.isArray(response.favorites)) throw new Error('Invalid favorites response');
      const builds = response.favorites;
      grid.replaceChildren();
      if (!builds.length) {
        panel('Your shelf is empty', 'Save a build from the showcase or a game page and it will be waiting here.');
        return;
      }
      state.replaceChildren();
      BuildsUI.renderCards(grid, builds, { me, onRefresh: load });
    } catch (error) {
      grid.replaceChildren();
      if (error.status === 401) panel('Favorites are personal', 'Log in to see and manage the builds you have saved.', { login: true });
      else panel('Favorites could not be loaded', BuildsUI.apiMessage(error, 'Check your connection and try again.'), { error: true, retry: load });
    }
  }
  document.addEventListener('DOMContentLoaded', async () => {
    try { const result = await getMe(); me = result.user || null; } catch { me = null; }
    await load();
  });
  document.addEventListener('blueprint:favorite-change', (event) => {
    if (event.detail && !event.detail.favorited) {
      const card = [...grid.querySelectorAll('[data-build-id]')].find((item) => item.dataset.buildId === event.detail.buildId);
      if (card) card.remove();
      if (!grid.querySelector('[data-build-id]')) panel('Your shelf is empty', 'Save a build from the showcase or a game page and it will be waiting here.');
    }
  });
})();
