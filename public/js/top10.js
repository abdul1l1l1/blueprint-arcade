(() => {
  'use strict';
  const root = document.getElementById('top10');
  const state = document.getElementById('top10-state');
  let me = null;
  let requestNumber = 0;

  function show(title, message, retry) {
    state.replaceChildren();
    const panel = BuildsUI.node('div', `state-panel${retry ? ' is-error' : ''}`);
    panel.append(BuildsUI.node('h2', '', title), BuildsUI.node('p', '', message));
    if (retry) {
      const button = BuildsUI.node('button', 'btn', 'Retry');
      button.type = 'button';
      button.addEventListener('click', retry);
      panel.append(button);
    }
    state.append(panel);
  }
  async function load() {
    const requestId = ++requestNumber;
    const drafts = new Map([...root.querySelectorAll('[data-build-id]')].map(card => [card.dataset.buildId, card.querySelector('textarea')?.value || '']));
    root.replaceChildren();
    state.replaceChildren();
    for (let i = 0; i < 4; i += 1) root.append(BuildsUI.node('div', 'card compare-loading'));
    try {
      const response = await api('/api/stats/top10');
      if (requestId !== requestNumber) return;
      if (!Array.isArray(response.top)) throw new Error('Invalid leaderboard response');
      root.replaceChildren();
      if (!response.top.length) {
        show('No ranked builds yet', 'Once the community has rated and liked builds, the leaderboard will appear here.');
        return;
      }
      state.replaceChildren();
      response.top.slice(0, 10).forEach((build, index) => {
        const card = BuildsUI.buildCard(build, { me, onRefresh: load });
        card.classList.add('rank-card');
        const rank = BuildsUI.node('p', 'rank-number', String(index + 1).padStart(2, '0'));
        rank.setAttribute('aria-label', `Rank ${index + 1}`);
        card.insertBefore(rank, card.firstChild);
        card.append(BuildsUI.node('p', 'rank-score', `Score `));
        const scoreLine = card.lastElementChild;
        scoreLine.replaceChildren(document.createTextNode('Score '), BuildsUI.node('strong', '', Number(build.score || 0).toFixed(2)));
        root.append(card);
        // Social controls mount asynchronously after insertion.
        const draft = drafts.get(String(build.id));
        if (draft) setTimeout(() => {
          const editor = card.querySelector('textarea');
          if (editor) editor.value = draft;
        }, 0);
      });
    } catch (error) {
      root.replaceChildren();
      show('Leaderboard could not be loaded', BuildsUI.apiMessage(error, 'Check your connection and try again.'), load);
    }
  }
  document.addEventListener('blueprint:social-change', event => {
    if (['like', 'rating'].includes(event.detail?.action)) load();
  });
  document.addEventListener('DOMContentLoaded', async () => {
    try { const result = await getMe(); me = result.user || null; } catch { me = null; }
    await load();
  });
})();
