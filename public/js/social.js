/* Phase 4 build reactions. Kept separate from card rendering so Phase 3 renderCards stays test-compatible. */
(() => {
  'use strict';

  const mounted = new WeakSet();
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };
  const safeImage = (value) => {
    if (value === '/media/builds/construction-site-c40bfeba.png') return value;
    if (window.BAApprovedImages?.isApprovedUrl(value)) return value;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  };
  const loginLink = () => {
    const link = node('a', 'login-hint', 'Log in to like, rate, save, or comment.');
    link.href = '/login.html';
    return link;
  };

  function mountCarousel(card, buildId) {
    const build = card.__baBuild || {};
    const urls = (Array.isArray(build.image_urls) ? build.image_urls : []).map(safeImage).filter(Boolean);
    if (!urls.length) return;
    let cover = card.querySelector('.build-cover');
    if (!cover) {
      cover = node('div', 'build-cover');
      const image = document.createElement('img');
      image.src = urls[0];
      image.alt = `Build image ${1} of ${urls.length}`;
      image.loading = 'lazy';
      cover.append(image);
      card.insertBefore(cover, card.firstChild);
    }
    let image = cover.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      cover.querySelector('.cover-placeholder')?.remove();
      cover.prepend(image);
    }
    image.src = urls[0];
    image.alt = `Build image 1 of ${urls.length}`;
    let illustrationLabel = card.querySelector('.illustration-label');
    if (!illustrationLabel) {
      illustrationLabel = node('p', 'illustration-label', window.BAApprovedImages?.label || '');
      cover.insertAdjacentElement('afterend', illustrationLabel);
    }
    const updateLabel = url => {
      const illustrated = !!window.BAApprovedImages?.isApprovedUrl(url);
      illustrationLabel.hidden = !illustrated;
      if (illustrated) image.alt = `${window.BAApprovedImages.label}: ${build.title || 'demo build'}`;
    };
    updateLabel(urls[0]);
    if (urls.length < 2) return;
    cover.classList.add('build-carousel');
    cover.classList.remove('is-empty');
    const unavailable = node('span', 'carousel-unavailable', 'Image unavailable. Try another image.');
    unavailable.hidden = true;
    cover.append(unavailable);
    image.addEventListener('error', () => { image.hidden = true; unavailable.hidden = false; });
    image.addEventListener('load', () => { image.hidden = false; unavailable.hidden = true; });
    const controls = node('div', 'carousel-controls');
    const previous = node('button', 'btn', 'Previous');
    const next = node('button', 'btn', 'Next');
    const count = node('span', 'carousel-count');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', 'Show previous build image');
    next.setAttribute('aria-label', 'Show next build image');
    let index = 0;
    const update = () => {
      image.hidden = false;
      unavailable.hidden = true;
      image.src = urls[index];
      image.alt = `Build image ${index + 1} of ${urls.length}`;
      updateLabel(urls[index]);
      count.textContent = `${index + 1} / ${urls.length}`;
    };
    previous.addEventListener('click', () => { index = (index - 1 + urls.length) % urls.length; update(); });
    next.addEventListener('click', () => { index = (index + 1) % urls.length; update(); });
    controls.append(previous, count, next);
    cover.append(controls);
    update();
  }

  function mountSocial(card) {
    if (mounted.has(card)) return;
    const buildId = card.dataset.buildId;
    if (!buildId) return;
    mounted.add(card);
    mountCarousel(card, buildId);
    const panel = node('section', 'social-tools');
    panel.setAttribute('aria-label', 'Build community actions');
    const actions = node('div', 'social-actions');
    const like = node('button', 'btn', 'Like');
    const favorite = node('button', 'btn', 'Save');
    like.type = favorite.type = 'button';
    const counts = node('span', 'social-counts', 'Loading community activity…');
    const ratingLabel = node('span', '', 'Rate:');
    const rating = node('div', 'rating-control');
    rating.setAttribute('role', 'group');
    rating.setAttribute('aria-label', 'Rate this build from 1 to 5');
    const stars = [];
    for (let score = 1; score <= 5; score += 1) {
      const button = node('button', '', String(score));
      button.type = 'button';
      button.setAttribute('aria-label', `Rate ${score} out of 5`);
      button.dataset.rating = String(score);
      stars.push(button);
      rating.append(button);
    }
    const commentsToggle = node('button', 'btn', 'Comments');
    commentsToggle.type = 'button';
    const status = node('p', 'social-status');
    status.setAttribute('role', 'status');
    actions.append(like, favorite, ratingLabel, rating, commentsToggle, counts);
    panel.append(actions, status);

    const comments = node('div', 'comment-panel');
    comments.hidden = true;
    const commentsTitle = node('h4', '', 'Conversation');
    const list = node('div', 'comment-list');
    const form = node('form', 'comment-form');
    const textarea = document.createElement('textarea');
    textarea.name = 'body';
    textarea.maxLength = 2000;
    textarea.required = true;
    textarea.placeholder = 'Add a useful note about this build';
    textarea.setAttribute('aria-label', 'Write a comment');
    const send = node('button', 'btn btn-primary', 'Post comment');
    send.type = 'submit';
    form.append(textarea, send);
    comments.append(commentsTitle, list, form);
    panel.append(comments);
    card.append(panel);

    let state = null;
    let writePending = false;
    let commentsLoaded = false;
    const endpoint = `/api/social/builds/${encodeURIComponent(buildId)}`;

    function showStatus(message, error = false) {
      status.textContent = message || '';
      status.classList.toggle('is-error', error);
    }
    function renderState(value) {
      state = value;
      like.textContent = value.liked ? 'Liked' : 'Like';
      favorite.textContent = value.favorited ? 'Saved' : 'Save';
      like.classList.toggle('is-active', Boolean(value.liked));
      favorite.classList.toggle('is-active', Boolean(value.favorited));
      like.setAttribute('aria-pressed', String(Boolean(value.liked)));
      favorite.setAttribute('aria-pressed', String(Boolean(value.favorited)));
      counts.textContent = `${Number(value.like_count) || 0} likes · ${Number(value.avg_rating || 0).toFixed(1)} average · ${Number(value.rating_count) || 0} ratings · ${Number(value.comment_count) || 0} comments`;
      const summary = card.querySelector('.build-stats');
      if (summary) summary.textContent = `Rating ${Number(value.avg_rating || 0).toFixed(1)} · ${Number(value.like_count || 0)} likes`;
      const gameRating = card.querySelector('.build-rating');
      if (gameRating) gameRating.textContent = `${Number(value.avg_rating || 0).toFixed(1)} build rating`;
      stars.forEach((button) => {
        const selected = Number(value.rating) === Number(button.dataset.rating);
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    async function loadState() {
      counts.textContent = 'Loading community activity…';
      try {
        const result = await api(`${endpoint}/state`);
        renderState(result);
        showStatus('');
      } catch (error) {
        counts.textContent = 'Community activity unavailable.';
        showStatus('Could not load reactions. ', true);
        const retry = node('button', 'btn', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', loadState);
        status.append(retry);
      }
    }
    async function write(path, body) {
      if (writePending) return;
      writePending = true;
      const controls = [like, favorite, ...stars, send];
      controls.forEach((control) => { control.disabled = true; });
      showStatus('Saving…');
      try {
        const result = await api(`${endpoint}/${path}`, { method: 'POST', ...(body ? { body } : {}) });
        renderState(result);
        if (path === 'favorite') {
          document.dispatchEvent(new CustomEvent('blueprint:favorite-change', {
            detail: { buildId: String(buildId), favorited: Boolean(result.favorited) }
          }));
        }
        showStatus('Saved.');
        document.dispatchEvent(new CustomEvent('blueprint:social-change', { detail: { buildId, action: path } }));
      } catch (error) {
        if (error.status === 401) {
          showStatus('Please log in to use community actions.', true);
          if (!panel.querySelector('.login-hint')) panel.append(loginLink());
        } else {
          showStatus(error && error.data && error.data.errors ? Object.values(error.data.errors).filter(Boolean).join(' ') : 'Could not save that change. Try again.', true);
        }
      } finally {
        writePending = false;
        controls.forEach((control) => { control.disabled = false; });
      }
    }
    like.addEventListener('click', () => write('like'));
    favorite.addEventListener('click', () => write('favorite'));
    stars.forEach((button) => button.addEventListener('click', () => write('rating', { stars: Number(button.dataset.rating) })));

    function renderComments(items) {
      list.replaceChildren();
      if (!items.length) {
        list.append(node('p', 'login-hint', 'No comments yet. Start the conversation.'));
        return;
      }
      items.forEach((comment) => {
        const item = node('article', 'comment-item');
        const author = node('strong', '', comment.username || 'Community member');
        const body = node('p', '', comment.body || '');
        item.append(author, body);
        list.append(item);
      });
    }
    async function loadComments() {
      commentsToggle.disabled = true;
      commentsToggle.textContent = 'Loading comments…';
      try {
        const result = await api(`${endpoint}/comments`);
        renderComments(Array.isArray(result.comments) ? result.comments : []);
        commentsLoaded = true;
      } catch {
        list.replaceChildren();
        const message = node('p', 'social-status is-error', 'Comments could not be loaded.');
        const retry = node('button', 'btn', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', loadComments);
        list.append(message, retry);
      } finally {
        commentsToggle.disabled = false;
        commentsToggle.textContent = 'Comments';
      }
    }
    commentsToggle.addEventListener('click', async () => {
      comments.hidden = !comments.hidden;
      commentsToggle.setAttribute('aria-expanded', String(!comments.hidden));
      if (!comments.hidden) await loadComments();
      if (!comments.hidden) textarea.focus({ preventScroll: true });
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body || body.length > 2000 || writePending) {
        if (body.length > 2000) showStatus('Comments must be 1–2000 characters.', true);
        return;
      }
      writePending = true;
      const controls = [like, favorite, ...stars, send, textarea];
      controls.forEach(control => { control.disabled = true; });
      try {
        const result = await api(`${endpoint}/comments`, { method: 'POST', body: { body } });
        // Keep the editor node and its draft intact; clear only after an accepted comment.
        textarea.value = '';
        await loadComments();
        if (state) await loadState();
        showStatus('Comment posted.');
      } catch (error) {
        if (error.status === 401) {
          showStatus('Please log in to comment.', true);
          if (!panel.querySelector('.login-hint')) panel.append(loginLink());
        } else {
          showStatus(error && error.data && error.data.errors ? Object.values(error.data.errors).filter(Boolean).join(' ') : 'Comment could not be posted. Your text is still here.', true);
        }
      } finally {
        writePending = false;
        controls.forEach(control => { control.disabled = false; });
      }
    });
    loadState();
  }

  function scan(root = document) {
    if (root.matches && root.matches('[data-build-id]')) mountSocial(root);
    if (root.querySelectorAll) root.querySelectorAll('[data-build-id]').forEach(mountSocial);
  }
  document.addEventListener('DOMContentLoaded', () => {
    scan();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((added) => {
        if (added.nodeType === 1) scan(added);
      })));
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
