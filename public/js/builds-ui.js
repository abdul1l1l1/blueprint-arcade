/* Shared safe rendering and build controls for Phase 3 pages. */
(function () {
  'use strict';

  const TYPE_LABELS = {
    freeform: 'Freeform',
    interior: 'Interior',
    renovation: 'Renovation',
    'city-planning': 'City planning',
    sandbox: 'Sandbox'
  };
  const BUDGET_LABELS = { starter: 'Starter', mid: 'Mid', luxury: 'Luxury', unlimited: 'Unlimited' };

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function statePanel(container, title, message, options = {}) {
    container.replaceChildren();
    const panel = node('div', `build-state-panel${options.error ? ' is-error' : ''}`);
    panel.append(node('h2', '', title), node('p', '', message));
    if (options.retry) {
      const retry = node('button', 'btn', options.retryLabel || 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', options.retry);
      panel.append(retry);
    }
    container.append(panel);
  }

  function setError(element, message) {
    element.textContent = message || '';
    element.hidden = !message;
  }

  function apiMessage(error, fallback) {
    const payload = error && error.data;
    if (payload && payload.errors) {
      const entries = Object.values(payload.errors).filter(Boolean);
      if (entries.length) return entries.map(String).join(' ');
    }
    if (error && error.status === 401) return 'Please log in to continue.';
    if (error && error.status === 403) return 'Only the build’s owner can make this change.';
    if (error && error.status === 404) return 'This build or profile is no longer available.';
    if (error && error.status === 409) return 'The profile has reached its limit of three pinned builds. Unpin another build and try again.';
    return fallback || 'Something went wrong. Please try again.';
  }

  function safeImageUrl(value) {
    if (value === '/media/builds/construction-site-c40bfeba.png') return value;
    if (window.BAApprovedImages?.isApprovedUrl(value)) return value;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }

  function tagName(tag) {
    if (typeof tag === 'string') return tag;
    if (tag && typeof tag.name === 'string') return tag.name;
    if (tag && typeof tag.tag === 'string') return tag.tag;
    if (tag && typeof tag.label === 'string') return tag.label;
    return '';
  }

  function buildCard(build, options = {}) {
    const article = node('article', 'card build-tile');
    article.dataset.buildId = String(build.id);
    article.__baBuild = build;
    const cover = node('div', 'build-cover');
    const imageUrl = Array.isArray(build.image_urls) ? safeImageUrl(build.image_urls[0]) : '';
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = window.BAApprovedImages?.isApprovedUrl(imageUrl)
        ? `${window.BAApprovedImages.label}: ${build.title || 'demo build'}`
        : `Cover image for ${build.title || 'community build'}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        if (cover.classList.contains?.('build-carousel')) return;
        image.replaceWith(node('span', 'cover-placeholder', 'Cover image unavailable'));
        cover.classList.add('is-empty');
      }, { once: true });
      cover.append(image);
    } else {
      cover.classList.add('is-empty');
      cover.append(node('span', 'cover-placeholder', 'No cover image provided'));
    }
    if (build.is_pinned) cover.append(node('span', 'build-pinned', 'Pinned'));
    article.append(cover);

    const body = node('div', 'build-tile-body');
    if (window.BAApprovedImages?.isApprovedUrl(imageUrl)) {
      body.append(node('p', 'illustration-label', window.BAApprovedImages.label));
    }
    const titleRow = node('div', 'build-title-row');
    titleRow.append(node('h3', '', build.title || 'Untitled build'));
    const stats = node('span', 'build-stats', `Rating ${Number(build.avg_rating || 0).toFixed(1)} · ${Number(build.like_count || 0)} likes`);
    titleRow.append(stats);
    body.append(titleRow);

    const credit = node('p', 'build-credit');
    const username = typeof build.owner === 'string' ? build.owner : build.owner?.username;
    const ownerLink = node('a', '', build.display_name || username || 'Community builder');
    ownerLink.href = `/profile.html?username=${encodeURIComponent(username || '')}`;
    credit.append(document.createTextNode('by '), ownerLink, document.createTextNode(' · '));
    const gameLink = node('a', 'game-link', build.game_name || 'Unknown game');
    gameLink.href = build.game_slug ? `/game.html?slug=${encodeURIComponent(build.game_slug)}` : '/games.html';
    credit.append(gameLink);
    body.append(credit);

    if (build.description) {
      const details = node('details', 'build-description');
      const summary = node('summary', '', 'Read description');
      details.append(summary, node('p', 'build-description-copy', build.description));
      body.append(details);
    }

    const metadata = node('div', 'build-meta');
    metadata.append(node('span', 'tag', TYPE_LABELS[build.build_type] || build.build_type || 'Build'));
    metadata.append(node('span', 'tag', BUDGET_LABELS[build.budget_tier] || build.budget_tier || 'Budget not set'));
    body.append(metadata);

    if (Array.isArray(build.tags) && build.tags.length) {
      const tagList = node('div', 'build-tags');
      build.tags.forEach((tag) => {
        const label = tagName(tag);
        if (label) tagList.append(node('span', 'tag', label));
      });
      body.append(tagList);
    }

    if (options.me && String(options.me.id) === String(build.owner_id)) {
      const actions = node('div', 'build-tile-actions');
      const edit = node('a', 'btn', 'Edit');
      edit.href = `/post.html?id=${encodeURIComponent(build.id)}`;
      actions.append(edit);
      const pin = node('button', 'btn', build.is_pinned ? 'Unpin' : 'Pin');
      pin.type = 'button';
      pin.setAttribute('aria-label', `${build.is_pinned ? 'Unpin' : 'Pin'} ${build.title}`);
      pin.addEventListener('click', async () => {
        pin.disabled = true;
        try {
          await api(`/api/builds/${encodeURIComponent(build.id)}/pin`, {
            method: 'POST',
            body: { is_pinned: !build.is_pinned }
          });
          if (options.onRefresh) await options.onRefresh();
        } catch (error) {
          if (typeof toast === 'function') toast(apiMessage(error, 'Pin update failed. Please try again.'));
          pin.disabled = false;
        }
      });
      const remove = node('button', 'btn btn-danger', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete “${build.title || 'this build'}”? This cannot be undone.`)) return;
        remove.disabled = true;
        try {
          await api(`/api/builds/${encodeURIComponent(build.id)}`, { method: 'DELETE' });
          if (options.onRefresh) await options.onRefresh();
        } catch (error) {
          if (typeof toast === 'function') toast(apiMessage(error, 'Delete failed. Please try again.'));
          remove.disabled = false;
        }
      });
      actions.append(pin, remove);
      body.append(actions);
    }
    article.append(body);
    return article;
  }

  function renderCards(container, builds, options = {}) {
    const cards = (builds || []).map((build) => buildCard(build, options));
    container.replaceChildren(...cards);
  }

  window.BuildsUI = {
    apiMessage,
    buildCard,
    node,
    renderCards,
    safeImageUrl,
    setError,
    statePanel,
    tagName
  };
})();
