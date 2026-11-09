// Public Phase 2 game directory and game detail renderer.
(() => {
  const byId = (id) => document.getElementById(id);

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function formattedCount(value, singular, plural = `${singular}s`) {
    const count = Number(value) || 0;
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function ratingText(value) {
    const rating = Number(value);
    return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'No ratings';
  }

  function showState(target, heading, message, options = {}) {
    target.replaceChildren();
    const panel = node('div', `state-panel${options.error ? ' is-error' : ''}`);
    if (heading) panel.append(node('h2', '', heading));
    if (message) panel.append(node('p', '', message));
    if (options.action) panel.append(options.action);
    target.append(panel);
  }

  function makeRetryButton(label, callback) {
    const button = node('button', 'btn', label);
    button.type = 'button';
    button.addEventListener('click', callback);
    return button;
  }

  function renderLoading(target, count = 4) {
    target.replaceChildren();
    const grid = node('div', 'skeleton-grid');
    for (let index = 0; index < count; index += 1) grid.append(node('div', 'skeleton-card'));
    target.append(grid);
  }

  function createGameCard(game) {
    const link = node('a', 'game-card card');
    const slug = typeof game.slug === 'string' ? game.slug : '';
    link.href = `/game.html?slug=${encodeURIComponent(slug)}`;
    const top = node('div', 'game-card-top');
    const mark = node('div', 'game-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.append(node('span'), node('span'), node('span'));
    const kind = node('span', 'game-kind', game.is_sandbox ? 'Sandbox' : 'Non-sandbox');
    top.append(mark, kind);

    const title = node('h3', '', game.name || 'Untitled game');
    const description = node('p', 'game-card-description', game.description || 'No description available.');
    const stats = node('div', 'game-card-stats');
    const builds = node('span', '', formattedCount(game.build_count, 'build'));
    const rating = node('span');
    rating.append(node('strong', '', ratingText(game.avg_rating)), document.createTextNode(' build rating'));
    stats.append(builds, rating);
    link.append(top, title, description, stats);
    link.setAttribute('aria-label', `${game.name || 'Game'} details`);
    return link;
  }

  function readDirectoryControls() {
    const params = new URLSearchParams(window.location.search);
    const requestedSort = params.get('sort');
    const sort = ['name', 'builds', 'rating', 'newest'].includes(requestedSort) ? requestedSort : 'name';
    const requestedSandbox = params.get('sandbox');
    const sandbox = requestedSandbox === 'true' || requestedSandbox === 'false' ? requestedSandbox : '';
    const q = (params.get('q') || '').slice(0, 120);
    byId('game-query').value = q;
    byId('sandbox-filter').value = sandbox;
    byId('game-sort').value = sort;
    return { q, sandbox, sort };
  }

  function setupDirectory() {
    const form = byId('game-filters');
    if (!form) return;
    const results = byId('games');
    const state = byId('games-state');
    const count = byId('games-count');
    let requestSequence = 0;

    async function loadGames(updateUrl = false) {
      const sequence = ++requestSequence;
      const controls = {
        q: byId('game-query').value.trim().slice(0, 120),
        sandbox: byId('sandbox-filter').value,
        sort: byId('game-sort').value,
      };
      if (updateUrl) {
        const params = new URLSearchParams();
        if (controls.q) params.set('q', controls.q);
        if (controls.sandbox) params.set('sandbox', controls.sandbox);
        if (controls.sort !== 'name') params.set('sort', controls.sort);
        const query = params.toString();
        history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      }

      byId('game-query').value = controls.q;
      count.textContent = '';
      results.replaceChildren();
      renderLoading(state, 4);
      state.prepend(node('p', 'section-count', 'Loading games…'));

      const params = new URLSearchParams({ sort: controls.sort });
      if (controls.q) params.set('q', controls.q);
      if (controls.sandbox) params.set('sandbox', controls.sandbox);

      try {
        const response = await api(`/api/games?${params.toString()}`);
        if (sequence !== requestSequence) return;
        state.replaceChildren();
        if (!Array.isArray(response.games)) throw new Error('Invalid directory response');
        const games = response.games;
        count.textContent = formattedCount(games.length, 'game');
        if (!games.length) {
          showState(state, 'No games found', 'Try another name or adjust the sandbox filter.');
          return;
        }
        const fragment = document.createDocumentFragment();
        games.forEach((game) => fragment.append(createGameCard(game)));
        results.append(fragment);
      } catch (error) {
        if (sequence !== requestSequence) return;
        count.textContent = '';
        results.replaceChildren();
        const message = error.status === 404
          ? 'The game directory is not available right now.'
          : 'We could not load the game directory. Check your connection and try again.';
        showState(state, 'Games could not be loaded', message, {
          error: true,
          action: makeRetryButton('Retry', () => loadGames(false)),
        });
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadGames(true);
    });
    byId('sandbox-filter').addEventListener('change', () => loadGames(true));
    byId('game-sort').addEventListener('change', () => loadGames(true));
    readDirectoryControls();
    loadGames(false);
  }

  function addBuildTags(container, tags) {
    const list = Array.isArray(tags) ? tags : [];
    list.forEach((tag) => container.append(node('span', 'tag', tag)));
  }

  function createBuildCard(build) {
    const card = node('article', 'build-card card');
    card.dataset.buildId = String(build.id);
    card.__baBuild = build;
    const header = node('div', 'build-card-header');
    const identity = node('div');
    identity.append(node('h3', '', build.title || 'Untitled build'));
    const credit = build.display_name || build.owner || 'Community builder';
    identity.append(node('p', 'build-credit', `Built by ${credit}`));

    const rating = node('div', 'build-rating', `${ratingText(build.avg_rating)} build rating`);
    header.append(identity, rating);
    card.append(header);
    if (build.description) card.append(node('p', 'build-description', build.description));

    const details = node('div', 'build-details');
    if (build.budget_tier) details.append(node('span', 'build-detail-label', `Budget: ${build.budget_tier}`));
    if (build.build_type) details.append(node('span', 'build-detail-label', build.build_type));
    if (details.childNodes.length) card.append(details);

    const tags = node('div', 'build-tags');
    addBuildTags(tags, build.tags);
    if (tags.childNodes.length) card.append(tags);
    return card;
  }

  function setupDetail() {
    const detail = byId('game-detail');
    if (!detail) return;
    const state = byId('game-state');
    const slug = new URLSearchParams(window.location.search).get('slug');

    if (!slug || !slug.trim()) {
      showState(state, 'Choose a game to explore', 'This page needs a valid game address. Browse the directory to pick a game.', {
        error: true,
        action: makeRetryButton('Browse games', () => window.location.assign('/games.html')),
      });
      return;
    }

    async function loadGame() {
      state.replaceChildren();
      const loading = node('div', 'state-panel');
      loading.setAttribute('role', 'status');
      loading.textContent = 'Loading game details…';
      state.append(loading);
      try {
        const response = await api(`/api/games/${encodeURIComponent(slug)}`);
        const game = response.game;
        if (!game || typeof game !== 'object' || !Array.isArray(response.tags) || !Array.isArray(response.builds)) {
          throw new Error('Invalid game response');
        }
        renderGame(game, response.tags, response.builds);
        state.replaceChildren();
      } catch (error) {
        const missing = error.status === 404 || error.status === 400;
        showState(
          state,
          missing ? 'Game not found' : 'Game details could not be loaded',
          missing
            ? 'That game address does not match a game in the directory.'
            : 'We could not load this game. Check your connection and try again.',
          {
            error: true,
            action: missing
              ? makeRetryButton('Browse games', () => window.location.assign('/games.html'))
              : makeRetryButton('Retry', loadGame),
          },
        );
      }
    }

    function renderGame(game, gameTags, builds) {
      document.title = `${game.name || 'Game'} — Blueprint Arcade`;
      byId('game-name').textContent = game.name || 'Untitled game';
      byId('game-kicker').textContent = game.is_sandbox ? 'Sandbox / Game profile' : 'Game profile';
      byId('game-meta').textContent = game.release_year
        ? `${game.genre || 'Building game'} · Released ${game.release_year}`
        : (game.genre || 'Building game');
      byId('game-description').textContent = game.description || 'No description available.';
      byId('game-rating').textContent = ratingText(game.avg_rating);
      byId('game-build-count').textContent = formattedCount(game.build_count, 'credited build');

      const vocabulary = byId('game-tags');
      vocabulary.replaceChildren();
      if (gameTags.length) {
        gameTags.forEach((tag) => vocabulary.append(node('span', 'tag', tag)));
      } else {
        vocabulary.append(node('span', 'section-count', 'No style vocabulary has been added yet.'));
      }

      const buildsContainer = byId('game-builds');
      const buildsState = byId('game-builds-state');
      buildsContainer.replaceChildren();
      buildsState.replaceChildren();
      byId('detail-build-count').textContent = formattedCount(builds.length, 'build');
      if (!builds.length) {
        showState(buildsState, 'No credited builds yet', 'When builders share work for this game, it will appear here.');
      } else {
        const fragment = document.createDocumentFragment();
        builds.forEach((build) => fragment.append(createBuildCard(build)));
        buildsContainer.append(fragment);
      }
      detail.hidden = false;
    }

    loadGame();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupDirectory();
    setupDetail();
  });
})();
