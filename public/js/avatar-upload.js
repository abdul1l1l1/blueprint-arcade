(function () {
  'use strict';
  const form = document.getElementById('avatar-upload-form');
  if (!form) return;
  const fileInput = document.getElementById('avatar-file');
  const consent = document.getElementById('avatar-consent');
  const submit = document.getElementById('avatar-upload-submit');
  const status = document.getElementById('avatar-upload-status');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) {
      status.textContent = 'Choose an image first.';
      return;
    }
    if (!BAUploads.types.includes(file.type) || file.size < 1 || file.size > BAUploads.maxBytes) {
      status.textContent = 'Choose a JPEG, PNG or WebP image no larger than 8 MB.';
      return;
    }
    if (!consent.checked) {
      status.textContent = 'Confirm that you have permission to share this image publicly.';
      return;
    }

    submit.disabled = true;
    status.textContent = 'Preparing upload…';
    try {
      const request = await api('/api/uploads/request-url', {
        method: 'POST',
        body: { size: file.size, contentType: file.type, publicConsent: true },
      });
      status.textContent = 'Uploading image…';
      const response = await fetch(request.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
        credentials: 'omit',
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error('Storage did not accept the image. Check your connection and retry.');
      status.textContent = 'Checking image…';
      const completed = await api(`/api/uploads/${encodeURIComponent(request.id)}/complete`, {
        method: 'POST',
        body: {},
      });
      const saved = await api('/api/profile/avatar', {
        method: 'POST',
        body: { imageUrl: completed.imageUrl },
      });
      const avatar = document.getElementById('profile-avatar');
      avatar.replaceChildren();
      const image = document.createElement('img');
      image.src = saved.avatar_url;
      image.alt = '';
      avatar.append(image);
      fileInput.value = '';
      status.textContent = 'Avatar updated.';
      document.dispatchEvent(new CustomEvent('blueprint:avatar-updated', { detail: saved }));
    } catch (error) {
      status.textContent = BuildsUI.apiMessage(error, error.message || 'Avatar could not be uploaded. Try again.');
    } finally {
      submit.disabled = false;
    }
  });
})();
