/* Direct-to-storage uploads. No file bytes pass through the upload API. */
function BAPostUploads(options) {
  'use strict';
  const { form, onBusy, onError } = options;
  const filesInput = form.elements.image_files;
  const consent = form.elements.image_consent;
  const button = document.getElementById('upload-images');
  const clearButton = document.getElementById('clear-image-files');
  const status = document.getElementById('upload-status');
  const previews = document.getElementById('upload-previews');
  const urls = form.elements.image_urls;
  let pending = [];
  let busy = false;
  let disabled = true;
  function refresh(value = disabled) {
    disabled = value;
    button.disabled = disabled || busy || !pending.length || !consent.checked;
  }
  function render() {
    previews.replaceChildren();
    for (const path of urls.value.split(/\r?\n/).map(value => value.trim()).filter(value => BAUploads.uploadId(value))) {
      const item = document.createElement('div');
      const image = document.createElement('img');
      image.src = path;
      image.alt = 'Uploaded build screenshot preview';
      image.width = 160;
      image.height = 100;
      image.style.objectFit = 'contain';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn';
      remove.textContent = 'Remove image';
      remove.disabled = disabled || busy;
      remove.addEventListener('click', () => {
        urls.value = urls.value.split(/\r?\n/).filter(value => value.trim() !== path).join('\n');
        urls.dispatchEvent(new Event('input', { bubbles: true }));
      });
      item.append(image, remove);
      previews.append(item);
    }
  }
  filesInput.addEventListener('change', () => {
    pending = Array.from(filesInput.files).map(file => ({ file }));
    status.textContent = pending.length ? `${pending.length} image(s) selected. Confirm permission, then upload.` : '';
    refresh();
  });
  consent.addEventListener('change', () => refresh());
  clearButton.addEventListener('click', () => {
    filesInput.value = '';
    pending = [];
    status.textContent = 'File selection cleared. Uploaded images and other entries are unchanged.';
    refresh();
  });
  urls.addEventListener('input', render);
  button.addEventListener('click', async () => {
    if (busy || disabled || !pending.length || !consent.checked) return;
    const invalid = pending.find(({ file }) => !BAUploads.types.includes(file.type) || file.size < 1 || file.size > BAUploads.maxBytes);
    if (invalid) {
      onError(`${invalid.file.name}: choose a JPEG, PNG or WebP image no larger than 8 MB. Your entries have not changed.`);
      return;
    }
    busy = true;
    onError('');
    onBusy(true);
    render();
    const failed = [];
    let completed = 0;
    let lastError = '';
    for (const item of pending) {
      try {
        status.textContent = `Uploading ${completed + failed.length + 1} of ${pending.length}: ${item.file.name}…`;
        if (!item.id) {
          const result = await api('/api/uploads/request-url', {
            method: 'POST',
            body: { size: item.file.size, contentType: item.file.type, publicConsent: consent.checked },
          });
          // File bytes go directly to the short-lived signed storage URL.
          const response = await fetch(result.uploadURL, {
            method: 'PUT', headers: { 'Content-Type': item.file.type },
            body: item.file, credentials: 'omit', signal: AbortSignal.timeout(120000),
          });
          if (!response.ok) throw new Error('Storage did not accept the file. Check your connection and retry.');
          item.id = result.id;
        }
        status.textContent = `Checking ${item.file.name}…`;
        const result = await api(`/api/uploads/${encodeURIComponent(item.id)}/complete`, { method: 'POST', body: {} });
        if (!BAUploads.uploadId(result.imageUrl)) throw new Error('The upload did not return a valid image path.');
        const existing = urls.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (!existing.includes(result.imageUrl)) urls.value = [...existing, result.imageUrl].join('\n');
        completed++;
      } catch (error) {
        if (error.status === 400 || error.status === 410 || error.status === 404) delete item.id;
        failed.push(item);
        lastError = BuildsUI.apiMessage(error, error.message || 'Upload failed.');
      }
    }
    pending = failed;
    if (!pending.length) filesInput.value = '';
    busy = false;
    onBusy(false);
    refresh();
    render();
    status.textContent = failed.length
      ? `${completed} uploaded; ${failed.length} not uploaded. Retry failed images or choose new files. Your entries and successful images are still here.`
      : `${completed} image(s) ready. The first Image URLs line is the cover. Save the build to publish.`;
    if (failed.length) onError(lastError);
  });
  return { refresh(value) { refresh(value); render(); }, render, hasPending: () => pending.length > 0 };
}
