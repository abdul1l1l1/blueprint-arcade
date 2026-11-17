(function () {
  'use strict';

  const form = document.getElementById('post-form');
  const title = document.getElementById('form-title');
  const state = document.getElementById('form-state');
  const errorBox = document.getElementById('post-error');
  const status = document.getElementById('form-status');
  const gameSelect = document.getElementById('game-select');
  const tagPicker = document.getElementById('tag-picker');
  const submitButton = document.getElementById('submit-build');
  const params = new URLSearchParams(location.search);
  const editId = params.get('id');
  const isEdit = Boolean(editId);
  let me = null;
  let games = [];
  let tagCache = new Map();
  let setupComplete = false;
  let loadingTags = false;
  let tagRequestId = 0;
  let tagLoadError = '';
  let requestPending = false;
  let uploading = false;
  const uploads = BAPostUploads({
    form,
    onBusy(busy) {
      uploading = busy;
      setFormDisabled(busy);
    },
    onError(message) { BuildsUI.setError(errorBox, message); },
  });

  function addSignInLink(message) {
    state.replaceChildren();
    const panel = BuildsUI.node('div', 'build-state-panel is-error');
    panel.append(BuildsUI.node('h2', '', 'Sign in to post a build'), BuildsUI.node('p', '', message));
    const link = BuildsUI.node('a', 'btn btn-primary', 'Log in');
    link.href = '/login.html';
    panel.append(link);
    state.append(panel);
  }

  function showSetupError(message, retry) {
    BuildsUI.statePanel(state, 'The form is not ready yet', message, { error: true, retry });
  }

  function normalizedTags(data) {
    const list = Array.isArray(data.tags) ? data.tags.map(BuildsUI.tagName).filter(Boolean) : [];
    return [...new Set(list)];
  }

  async function getTagsForGame(game) {
    if (!game || !game.slug) return [];
    if (tagCache.has(game.slug)) return tagCache.get(game.slug);
    const result = await api(`/api/games/${encodeURIComponent(game.slug)}`);
    const tags = normalizedTags(result);
    tagCache.set(game.slug, tags);
    return tags;
  }

  function gameById(id) {
    return games.find((game) => String(game.id) === String(id));
  }

  function selectedTagValues() {
    return [...tagPicker.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  }

  async function renderTagPicker(game, selected = []) {
    const requestId = ++tagRequestId;
    loadingTags = true;
    tagLoadError = '';
    submitButton.disabled = true;
    tagPicker.replaceChildren(BuildsUI.node('span', 'field-hint', game ? 'Loading game tags…' : 'Choose a game to see its available tags.'));
    if (!game) {
      loadingTags = false;
      refreshSubmitState();
      return;
    }
    try {
      const tags = await getTagsForGame(game);
      if (requestId !== tagRequestId) return;
      tagPicker.replaceChildren();
      if (!tags.length) {
        tagPicker.append(BuildsUI.node('span', 'field-hint', 'No style tags are listed for this game.'));
      }
      tags.forEach((tag) => {
        const label = BuildsUI.node('label', 'tag-option');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'tags';
        checkbox.value = tag;
        checkbox.checked = selected.includes(tag);
        checkbox.addEventListener('change', clearMessages);
        label.append(checkbox, document.createTextNode(tag));
        tagPicker.append(label);
      });
      loadingTags = false;
      refreshSubmitState();
    } catch (error) {
      if (requestId !== tagRequestId) return;
      loadingTags = false;
      tagLoadError = BuildsUI.apiMessage(error, 'Could not load style tags for this game.');
      tagPicker.replaceChildren(BuildsUI.node('span', 'error', tagLoadError));
      const retry = BuildsUI.node('button', 'btn', 'Retry loading tags');
      retry.type = 'button';
      retry.addEventListener('click', () => renderTagPicker(game, selected));
      tagPicker.append(retry);
      refreshSubmitState();
    }
  }

  function refreshSubmitState() {
    submitButton.disabled = !setupComplete || loadingTags || Boolean(tagLoadError) || requestPending || uploading || !me;
  }

  function setFormDisabled(disabled) {
    [...form.elements].forEach((control) => {
      if (control !== submitButton) control.disabled = disabled;
    });
    refreshSubmitState();
    uploads.refresh(disabled || !setupComplete || !me);
  }

  function clearMessages() {
    BuildsUI.setError(errorBox, '');
    status.textContent = '';
    form.querySelectorAll('.field-error').forEach((message) => message.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
  }

  function setFieldError(name, message) {
    const input = form.elements.namedItem(name);
    if (input && typeof input.setAttribute === 'function') input.setAttribute('aria-invalid', 'true');
    const item = BuildsUI.node('p', 'error field-error', message);
    if (input && input.parentElement) input.parentElement.append(item);
  }

  function validateImages(raw) {
    const urls = raw.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    for (const value of urls) {
      if (!BuildsUI.safeImageUrl(value)) return null;
    }
    return urls;
  }

  function buildPayload() {
    const imageUrls = validateImages(form.elements.image_urls.value);
    if (!form.elements.title.value.trim()) return { error: 'Add a title before posting.', field: 'title' };
    if (!gameSelect.value) return { error: 'Choose a game for this build.', field: 'game_id' };
    if (imageUrls === null) return { error: 'Use full HTTP(S) image URLs without credentials, or a completed upload path.', field: 'image_urls' };
    if (uploads.hasPending()) return { error: 'Upload your selected files first, or clear the file selection to post without them.', field: 'image_files' };
    const tags = [...new Set(selectedTagValues())];
    return {
      payload: {
        title: form.elements.title.value.trim(),
        game_id: Number(gameSelect.value),
        description: form.elements.description.value.trim(),
        image_urls: imageUrls,
        budget_tier: form.elements.budget_tier.value,
        build_type: form.elements.build_type.value,
        tags,
        is_pinned: form.elements.is_pinned.checked
      }
    };
  }

  function fillForm(build) {
    form.elements.title.value = build.title || '';
    gameSelect.value = String(build.game_id || '');
    form.elements.description.value = build.description || '';
    form.elements.image_urls.value = Array.isArray(build.image_urls) ? build.image_urls.join('\n') : '';
    uploads.render();
    form.elements.budget_tier.value = build.budget_tier || 'starter';
    form.elements.build_type.value = build.build_type || 'freeform';
    form.elements.is_pinned.checked = Boolean(build.is_pinned);
    return renderTagPicker(gameById(build.game_id), Array.isArray(build.tags) ? build.tags.map(BuildsUI.tagName).filter(Boolean) : []);
  }

  async function initialize() {
    setupComplete = false;
    setFormDisabled(true);
    BuildsUI.statePanel(state, 'Preparing the build form', 'Loading your account, game list, and available tags.');
    try {
      const meResult = await getMe();
      me = meResult.user || null;
      if (!me) {
        addSignInLink('Log in before sharing a build. You can still browse the showcase while signed out.');
        setFormDisabled(true);
        return;
      }
      const gameResult = await api('/api/games');
      games = Array.isArray(gameResult.games) ? gameResult.games : [];
      if (!games.length) throw new Error('No games are available yet. Reload after the game list is ready.');
      gameSelect.replaceChildren();
      const prompt = document.createElement('option');
      prompt.value = '';
      prompt.textContent = 'Choose a game';
      gameSelect.append(prompt);
      games.forEach((game) => {
        const option = document.createElement('option');
        option.value = String(game.id);
        option.textContent = game.name || game.slug || 'Unnamed game';
        gameSelect.append(option);
      });
      if (isEdit) {
        const result = await api(`/api/builds/${encodeURIComponent(editId)}`);
        const build = result.build;
        if (!build || String(build.owner_id) !== String(me.id)) {
          showSetupError('This build cannot be edited from your account. The form has not been populated.', () => initialize());
          return;
        }
        title.textContent = 'Edit your build';
        document.title = 'Edit a Build — Blueprint Arcade';
        await fillForm(build);
      } else {
        const defaultGame = params.get('game');
        if (defaultGame && games.some((game) => game.slug === defaultGame)) {
          const game = games.find((item) => item.slug === defaultGame);
          gameSelect.value = String(game.id);
          await renderTagPicker(game);
        }
      }
      setupComplete = true;
      state.replaceChildren();
      setFormDisabled(false);
      refreshSubmitState();
    } catch (error) {
      setupComplete = false;
      showSetupError(BuildsUI.apiMessage(error, error.message || 'Could not load the form. Check your connection and retry.'), () => initialize());
      setFormDisabled(true);
    }
  }

  gameSelect.addEventListener('change', () => {
    clearMessages();
    const game = gameById(gameSelect.value);
    renderTagPicker(game, []);
  });
  form.addEventListener('input', clearMessages);
  form.addEventListener('change', clearMessages);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();
    if (!setupComplete || loadingTags || tagLoadError || requestPending || uploading || !me) return;
    const result = buildPayload();
    if (result.error) {
      BuildsUI.setError(errorBox, result.error);
      if (result.field) setFieldError(result.field, result.error);
      return;
    }
    requestPending = true;
    setFormDisabled(true);
    submitButton.textContent = isEdit ? 'Saving…' : 'Posting…';
    status.textContent = 'Saving your build…';
    try {
      const response = isEdit
        ? await api(`/api/builds/${encodeURIComponent(editId)}`, { method: 'PUT', body: result.payload })
        : await api('/api/builds', { method: 'POST', body: result.payload });
      const saved = response.build;
      status.textContent = 'Saved. Opening your profile…';
      const username = me.username;
      const destination = `/profile.html?username=${encodeURIComponent(username)}&saved=${encodeURIComponent(saved.id)}`;
      location.assign(destination);
    } catch (error) {
      BuildsUI.setError(errorBox, BuildsUI.apiMessage(error, isEdit ? 'Could not save the changes. Your entries are still here; review the message and try again.' : 'Could not post this build. Your entries are still here; review the message and try again.'));
      if (error && error.data && error.data.errors) {
        Object.entries(error.data.errors).forEach(([field, message]) => setFieldError(field, String(message)));
      }
      status.textContent = '';
    } finally {
      requestPending = false;
      submitButton.textContent = isEdit ? 'Save changes' : 'Post build';
      setFormDisabled(false);
      refreshSubmitState();
    }
  });

  document.addEventListener('DOMContentLoaded', initialize);
})();
