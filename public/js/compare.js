(() => {
  'use strict';
  const form = document.getElementById('compare-form');
  const select = document.getElementById('compare-games');
  const state = document.getElementById('compare-state');
  const results = document.getElementById('compare-results');
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };
  let games = [];
  let requestNumber = 0;

  function show(title, message, error = false, retry = null) {
    state.replaceChildren();
    const panel = node('div', `state-panel${error ? ' is-error' : ''}`);
    panel.append(node('h2', '', title), node('p', '', message));
    if (retry) {
      const button = node('button', 'btn', 'Retry');
      button.type = 'button';
      button.addEventListener('click', retry);
      panel.append(button);
    }
    state.append(panel);
  }
  function label(value, fallback = 'Not listed') {
    return value === null || value === undefined || value === '' ? fallback : String(value);
  }
  function renderTags(tags) {
    return Array.isArray(tags) && tags.length ? tags.join(', ') : 'No style tags listed';
  }
  function verdictFor(items) {
    const buildMax = Math.max(...items.map((game) => Number(game.build_count) || 0));
    const ratingMax = Math.max(...items.map((game) => Number(game.avg_rating) || 0));
    const buildLeaders = items.filter((game) => (Number(game.build_count) || 0) === buildMax).map((game) => game.name);
    const ratingLeaders = items.filter((game) => (Number(game.avg_rating) || 0) === ratingMax).map((game) => game.name);
    const buildLine = buildLeaders.length === items.length
      ? `All selected games have ${buildMax} community builds.`
      : `${buildLeaders.join(', ')} ${buildLeaders.length === 1 ? 'has' : 'have'} the most listed builds (${buildMax}).`;
    const ratingLine = ratingMax > 0
      ? (ratingLeaders.length === items.length
        ? `All selected games share the highest build rating (${ratingMax.toFixed(1)}).`
        : `${ratingLeaders.join(', ')} ${ratingLeaders.length === 1 ? 'has' : 'have'} the highest build rating (${ratingMax.toFixed(1)}).`)
      : 'No selected game has a rated build yet.';
    return `${buildLine} ${ratingLine} These are separate measures; no overall winner is calculated.`;
  }
  function renderComparison(items) {
    results.replaceChildren();
    const tableWrap = node('div', 'compare-table-wrap');
    const table = node('table', 'compare-table');
    const caption = node('caption', '', 'Selected game facts and community activity');
    caption.className = 'visually-hidden';
    table.append(caption);
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.append(node('th', '', 'Measure'));
    items.forEach((game) => headRow.append(node('th', '', game.name || 'Unnamed game')));
    head.append(headRow);
    table.append(head);
    const body = document.createElement('tbody');
    const rows = [
      { key: 'genre', label: 'Genre', value: (game) => label(game.genre) },
      { key: 'release_year', label: 'Release year', value: (game) => label(game.release_year) },
      { key: 'is_sandbox', label: 'World format', value: (game) => game.is_sandbox ? 'Sandbox' : 'Non-sandbox' },
      { key: 'build_count', label: 'Community builds', numeric: true, value: (game) => Number(game.build_count) || 0 },
      { key: 'avg_rating', label: 'Build rating', numeric: true, value: (game) => Number(game.avg_rating) || 0, display: (game) => Number(game.avg_rating) > 0 ? Number(game.avg_rating).toFixed(1) : 'No ratings' },
      { key: 'tags', label: 'Style vocabulary', value: (game) => renderTags(game.tags) },
    ];
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.append(node('th', '', row.label));
      const values = items.map(row.value);
      const max = row.numeric ? Math.max(...values.map(Number)) : null;
      items.forEach((game, index) => {
        const td = document.createElement('td');
        td.textContent = row.display ? row.display(game) : String(values[index]);
        if (row.numeric && Number(values[index]) === max && (row.key !== 'avg_rating' || Number(values[index]) > 0)) {
          td.classList.add('is-winner');
          td.setAttribute('aria-label', `${row.label}: ${td.textContent}; tied or leading`);
        }
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(body);
    tableWrap.append(table);
    const verdict = node('section', 'card verdict');
    verdict.append(node('h2', '', 'What the current numbers say'), node('p', '', verdictFor(items)));
    results.append(tableWrap, verdict);
    results.hidden = false;
  }
  async function loadDirectory() {
    show('Loading game directory', 'Fetching available games.');
    select.disabled = true;
    try {
      const response = await api('/api/games');
      if (!Array.isArray(response.games)) throw new Error('Invalid games response');
      games = response.games;
      select.replaceChildren();
      games.forEach((game) => {
        const option = document.createElement('option');
        option.value = String(game.id);
        option.textContent = game.name || game.slug || `Game ${game.id}`;
        select.append(option);
      });
      select.disabled = false;
      state.replaceChildren();
    } catch {
      select.disabled = false;
      show('Game directory unavailable', 'Could not load games for comparison.', true, loadDirectory);
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestId = ++requestNumber;
    const ids = [...select.selectedOptions].map((option) => option.value);
    if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length) {
      results.hidden = true;
      show('Choose 2 or 3 different games', 'Select at least two games and no more than three.', true);
      return;
    }
    results.hidden = true;
    show('Building comparison', 'Loading matching game details.');
    try {
      const response = await api(`/api/games/compare/ids?${new URLSearchParams({ ids: ids.join(',') }).toString()}`);
      if (requestId !== requestNumber) return;
      if (!Array.isArray(response.games) || response.games.length !== ids.length) throw new Error('Incomplete comparison response');
      const returnedIds = response.games.map((game) => String(game.id));
      if (returnedIds.some((id, index) => id !== ids[index])) throw new Error('Comparison order did not match selection');
      state.replaceChildren();
      renderComparison(response.games);
    } catch (error) {
      if (requestId !== requestNumber) return;
      show('Comparison could not be loaded', error.status === 400
        ? 'The selected games could not be compared. Check the selection and try again.'
        : 'Game details could not be compared. Your selection is still here; please retry.', true);
      const button = node('button', 'btn', 'Retry comparison');
      button.type = 'button';
      button.addEventListener('click', () => form.requestSubmit());
      state.lastElementChild.append(button);
    }
  });
  document.addEventListener('DOMContentLoaded', loadDirectory);
})();
