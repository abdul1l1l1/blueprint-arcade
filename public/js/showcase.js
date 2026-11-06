(function () {
  'use strict';

  const form = document.getElementById('build-filters');
  const gameSelect = document.getElementById('filter-game');
  const tagSelect = document.getElementById('filter-tag');
  const sortSelect = document.getElementById('filter-sort');
  const state = document.getElementById('showcase-state');
  const grid = document.getElementById('showcase');
  const count = document.getElementById('results-count');
  let me = null;
  let meLoaded = false;
  let games = [];
  let allTags = [];
  let requestNumber = 0;
  let gamesWarning = '';

  function currentFilters() {
    return {
      q: form.elements.q.value.trim(),
      game: gameSelect.value,
      build_type: form.elements.build_type.value,
      budget_tier: form.elements.budget_tier.value,
      tag: tagSelect.value,
      sort: sortSelect.value || 'newest'
    };
  }

  function updateUrl(filters) {
    const url = new URL(location.href);
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !(key === 'sort' && value === 'newest')) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function updateTagOptions(selected) {
    const previous = selected === undefined ? tagSelect.value : selected;
    tagSelect.replaceChildren(BuildsUI.node('option', '', 'All tags'));
    tagSelect.options[0].value = '';
    allTags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagSelect.append(option);
    });
    tagSelect.value = allTags.includes(previous) ? previous : '';
  }

  async function loadGames() {
    const result = await api('/api/games');
    games = Array.isArray(result.games) ? result.games : [];
    games.forEach((game) => {
      const option = document.createElement('option');
      option.value = game.slug || '';
      option.textContent = game.name || game.slug || 'Unnamed game';
      if (option.value) gameSelect.append(option);
    });
    const tagSets = await Promise.all(games.filter((game) => game.slug).map(async (game) => {
      const data = await api(`/api/games/${encodeURIComponent(game.slug)}`);
      if (!Array.isArray(data.tags)) throw new Error('Vocabulary unavailable.');
      return data.tags.map(BuildsUI.tagName).filter(Boolean);
    }));
    allTags = [...new Set(tagSets.flat())].sort((a, b) => a.localeCompare(b));
    updateTagOptions();
    if (!allTags.length) gamesWarning = 'Game tags could not be loaded. You can still browse and filter by the other fields.';
  }

  function restoreFilters() {
    const params = new URLSearchParams(location.search);
    form.elements.q.value = params.get('q') || '';
    gameSelect.value = params.get('game') || '';
    form.elements.build_type.value = params.get('build_type') || '';
    form.elements.budget_tier.value = params.get('budget_tier') || '';
    sortSelect.value = ['newest', 'rating', 'likes'].includes(params.get('sort')) ? params.get('sort') : 'newest';
    updateTagOptions(params.get('tag') || '');
  }

  function showSkeletons() {
    state.replaceChildren();
    grid.replaceChildren();
    count.textContent = 'Loading builds…';
    for (let i = 0; i < 6; i += 1) grid.append(BuildsUI.node('div', 'build-skeleton'));
  }

  async function loadBuilds(filters = currentFilters()) {
    const requestId = ++requestNumber;
    updateUrl(filters);
    showSkeletons();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    try {
      const result = await api(`/api/builds?${params.toString()}`);
      if (requestId !== requestNumber) return;
      if (!Array.isArray(result.builds)) throw new Error('Incomplete build response.');
      const builds = result.builds;
      grid.replaceChildren();
      if (!builds.length) {
        count.textContent = '0 builds';
        BuildsUI.statePanel(state, 'No builds match those filters', 'Try a different search or clear one of the selected filters.');
      } else {
        state.replaceChildren();
        count.textContent = `${builds.length} ${builds.length === 1 ? 'build' : 'builds'}`;
        BuildsUI.renderCards(grid, builds, { me, onRefresh: () => loadBuilds(currentFilters()) });
      }
      if (gamesWarning) {
        const notice = BuildsUI.node('p', 'field-hint', gamesWarning);
        notice.setAttribute('role', 'status');
        state.prepend(notice);
      }
      if (meLoaded && !me) {
        const notice = BuildsUI.node('p', 'field-hint', 'You are browsing as a visitor. Log in to manage your own builds.');
        notice.setAttribute('role', 'status');
        state.prepend(notice);
      }
      if (!meLoaded) {
        const notice = BuildsUI.node('p', 'error', 'Account status could not be checked. Build owner controls are hidden until you reload.');
        notice.setAttribute('role', 'status');
        state.prepend(notice);
      }
    } catch (error) {
      if (requestId !== requestNumber) return;
      grid.replaceChildren();
      count.textContent = '';
      BuildsUI.statePanel(state, 'Builds could not be loaded', BuildsUI.apiMessage(error, 'Check your connection and try again.'), {
        error: true,
        retry: () => loadBuilds(currentFilters())
      });
    }
  }

  async function start() {
    showSkeletons();
    try {
      const meResult = await getMe();
      me = meResult.user || null;
      meLoaded = true;
    } catch {
      meLoaded = false;
    }
    try {
      await loadGames();
      restoreFilters();
    } catch {
      gamesWarning = 'Game filters could not be loaded. Refresh to retry; builds remain available below.';
      const params = new URLSearchParams(location.search);
      // Keep requested filters even if metadata failed; never broaden a query silently.
      for (const [select, key] of [[gameSelect, 'game'], [tagSelect, 'tag']]) {
        const value = params.get(key) || '';
        if (value && ![...select.options].some(option => option.value === value)) {
          const option = BuildsUI.node('option', '', value);
          option.value = value;
          select.append(option);
        }
        select.value = value;
      }
      form.elements.q.value = params.get('q') || '';
      form.elements.build_type.value = params.get('build_type') || '';
      form.elements.budget_tier.value = params.get('budget_tier') || '';
      sortSelect.value = ['newest', 'rating', 'likes'].includes(params.get('sort')) ? params.get('sort') : 'newest';
    }
    await loadBuilds(currentFilters());
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadBuilds(currentFilters());
  });
  form.addEventListener('reset', (event) => {
    event.preventDefault();
    form.elements.q.value = '';
    gameSelect.value = '';
    form.elements.build_type.value = '';
    form.elements.budget_tier.value = '';
    sortSelect.value = 'newest';
    tagSelect.value = '';
    loadBuilds(currentFilters());
  });
  document.addEventListener('DOMContentLoaded', start);
})();
