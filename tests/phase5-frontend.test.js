const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = readFileSync(path.join(__dirname, '../public/js/theme.js'), 'utf8');

function fixture(saved, blocked = false) {
  const attributes = {};
  const button = { setAttribute(key, value) { attributes[key] = value; } };
  const handlers = {}, storageHandlers = {}, values = new Map(saved ? [['ba-theme', saved]] : []);
  const document = {
    documentElement: { dataset: {} },
    querySelectorAll: () => [button],
    addEventListener: (name, callback) => { handlers[name] = callback; },
  };
  const window = {
    localStorage: {
      getItem(key) { if (blocked) throw new Error('blocked'); return values.get(key); },
      setItem(key, value) { if (blocked) throw new Error('blocked'); values.set(key, value); },
    },
    addEventListener: (name, callback) => { storageHandlers[name] = callback; },
  };
  vm.runInNewContext(source, { document, window });
  return { root: document.documentElement, button, attributes, handlers, storageHandlers, values };
}

test('P5 theme applies stored preference before DOM readiness and persists both directions', () => {
  const f = fixture('dark');
  assert.equal(f.root.dataset.theme, 'dark');
  assert.equal(f.button.textContent, 'Light mode');
  assert.equal(f.attributes['aria-pressed'], 'true');
  f.handlers.click({ target: { closest: () => f.button } });
  assert.equal(f.root.dataset.theme, 'light');
  assert.equal(f.values.get('ba-theme'), 'light');
  assert.equal(f.button.textContent, 'Dark mode');
  assert.equal(f.attributes['aria-label'], 'Switch to dark mode');
  f.handlers.click({ target: { closest: () => f.button } });
  assert.equal(f.values.get('ba-theme'), 'dark');
});

test('P5 blocked or invalid storage does not break theme controls; storage events synchronize', () => {
  for (const f of [fixture('invalid'), fixture('dark', true)]) {
    assert.equal(f.root.dataset.theme, 'light');
    f.handlers.click({ target: { closest: () => f.button } });
    assert.equal(f.root.dataset.theme, 'dark');
    f.storageHandlers.storage({ key: 'unrelated', newValue: 'light' });
    assert.equal(f.root.dataset.theme, 'dark');
    f.storageHandlers.storage({ key: 'ba-theme', newValue: 'light' });
    assert.equal(f.root.dataset.theme, 'light');
    f.storageHandlers.storage({ key: 'ba-theme', newValue: 'dark' });
    assert.equal(f.root.dataset.theme, 'dark');
    f.storageHandlers.storage({ key: null, newValue: null });
    assert.equal(f.root.dataset.theme, 'light');
  }
});

test('P5 all sixteen pages load theme before styles/content, expose required top actions, and contain no emoji', () => {
  const dir = path.join(__dirname, '../public');
  const pages = readdirSync(dir).filter(name => name.endsWith('.html'));
  assert.equal(pages.length, 16);
  for (const page of pages) {
    const html = readFileSync(path.join(dir, page), 'utf8');
    assert.ok(html.indexOf('/js/theme.js') < html.indexOf('</head>'), page);
    assert.ok(html.indexOf('/js/theme.js') < html.indexOf('rel="stylesheet"'), page);
    assert.match(html, /data-theme-toggle/, page);
    assert.match(html, /href="\/favorites.html"/, page);
    assert.match(html, /href="\/post.html"/, page);
    assert.match(html, /name="viewport"/, page);
    assert.doesNotMatch(html, /onclick="toggleTheme/, page);
    assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, page);
  }
  for (const file of readdirSync(path.join(dir, 'js'))) {
    assert.doesNotMatch(readFileSync(path.join(dir, 'js', file), 'utf8'), /\p{Extended_Pictographic}/u, file);
  }
});
