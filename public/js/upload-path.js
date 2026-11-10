/* Exact, stable upload URLs shared by the browser and server. */
(function (root) {
  'use strict';
  const pattern = /^\/media\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;
  const api = Object.freeze({
    uploadId: value => typeof value === 'string' ? pattern.exec(value)?.[1] || null : null,
    imagePath: id => `/media/uploads/${id}.webp`,
    maxBytes: 8 * 1024 * 1024,
    types: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BAUploads = api;
})(typeof window === 'object' ? window : {});
