/* Early, scoped theme boot. Safe when storage is unavailable or blocked. */
(function () {
  'use strict';
  var key = 'ba-theme';
  var root = document.documentElement;

  function readPreference() {
    try {
      var saved = window.localStorage.getItem(key);
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function applyTheme(theme, persist) {
    var normalized = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = normalized;
    if (persist) {
      try { window.localStorage.setItem(key, normalized); } catch (_) { /* Theme remains active for this page. */ }
    }
    updateButtons();
  }

  function updateButtons() {
    var dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' mode');
      button.textContent = dark ? 'Light mode' : 'Dark mode';
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  applyTheme(readPreference() || 'light', false);
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  document.addEventListener('DOMContentLoaded', updateButtons);
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    applyTheme(event.key === null ? 'light' : event.newValue, false);
  });
})();
