(function () {
  'use strict';

  const state = document.getElementById('build-detail-state');
  const page = document.getElementById('build-detail');
  const params = new URLSearchParams(location.search);
  const BUILD_TYPES = {
    freeform: 'Freeform',
    interior: 'Interior',
    renovation: 'Renovation',
    'city-planning': 'City planning',
    sandbox: 'Sandbox'
  };
  const BUDGET_TIERS = { starter: 'Starter', mid: 'Mid', luxury: 'Luxury', unlimited: 'Unlimited' };

  function showError(title, message, retry) {
    BuildsUI.statePanel(state, title, message, retry ? { error: true, retry } : { error: true });
  }

  function renderBuild(build, me) {
    document.title = `${build.title || 'Build details'} — Blueprint Arcade`;
    document.querySelector('meta[name="description"]').setAttribute(
      'content', `View ${build.title || 'this build'} by ${build.display_name || build.owner || 'a community builder'}.`
    );
    page.__baBuild = build;
    page.__baMe = me;
    page.dataset.buildId = String(build.id);

    document.getElementById('detail-title').textContent = build.title || 'Untitled build';
    const owner = document.getElementById('detail-owner');
    owner.textContent = build.display_name || build.owner || 'Community builder';
    owner.href = `/profile.html?username=${encodeURIComponent(build.owner || '')}`;
    const game = document.getElementById('detail-game');
    game.textContent = build.game_name || 'Unknown game';
    game.href = build.game_slug ? `/game.html?slug=${encodeURIComponent(build.game_slug)}` : '/games.html';
    document.getElementById('detail-description').textContent = build.description || 'No description was provided.';

    const meta = document.getElementById('detail-meta');
    meta.replaceChildren(
      BuildsUI.node('span', 'tag', `Build type: ${BUILD_TYPES[build.build_type] || build.build_type || 'Not set'}`),
      BuildsUI.node('span', 'tag', `Budget: ${BUDGET_TIERS[build.budget_tier] || build.budget_tier || 'Not set'}`)
    );
    const tags = document.getElementById('detail-tags');
    tags.replaceChildren();
    (Array.isArray(build.tags) ? build.tags : []).forEach((tag) => {
      const label = BuildsUI.tagName(tag);
      if (label) tags.append(BuildsUI.node('span', 'tag', label));
    });

    const cover = document.getElementById('detail-cover');
    const imageUrls = (Array.isArray(build.image_urls) ? build.image_urls : [])
      .map(BuildsUI.safeImageUrl).filter(Boolean);
    cover.replaceChildren();
    if (imageUrls.length) {
      const image = document.createElement('img');
      image.src = imageUrls[0];
      image.alt = `Build image 1 of ${imageUrls.length}`;
      image.loading = 'eager';
      cover.append(image);
    } else {
      cover.classList.add('is-empty');
      cover.append(BuildsUI.node('span', 'cover-placeholder', 'No photos provided for this build.'));
    }
    state.replaceChildren();
    page.hidden = false;
    window.BASocial?.scan(page);
  }

  async function start() {
    const id = params.get('id');
    if (!id) {
      showError('Build link is incomplete', 'Open a build from the showcase to see its details.');
      return;
    }
    BuildsUI.statePanel(state, 'Loading build details', 'Fetching the build and its photos.');
    let me = null;
    try { me = (await getMe()).user || null; } catch { /* Public details remain available. */ }
    try {
      const result = await api(`/api/builds/${encodeURIComponent(id)}`);
      if (!result.build) throw new Error('The build response was incomplete.');
      renderBuild(result.build, me);
    } catch (error) {
      showError('Build details could not be loaded', BuildsUI.apiMessage(error, 'Check the link or your connection, then try again.'), start);
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
