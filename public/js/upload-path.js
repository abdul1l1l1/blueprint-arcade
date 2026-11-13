/* Stable public paths for already validated uploaded build images. */
(function (root) {
  'use strict';
  const pattern = /^\/media\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;
  const api = Object.freeze({
    uploadId: value => typeof value === 'string' ? pattern.exec(value)?.[1] || null : null,
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BAUploads = api;
})(typeof window === 'object' ? window : {});
