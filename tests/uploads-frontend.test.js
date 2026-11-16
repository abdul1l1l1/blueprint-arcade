const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const BAUploads = require('../public/js/upload-path');
const source = readFileSync(require.resolve('../public/js/post-uploads'), 'utf8');

function fixture() {
  class Element {
    constructor() { this.handlers = {}; this.value = ''; this.style = {}; this.children = []; }
    addEventListener(event, handler) { this.handlers[event] = handler; }
    dispatchEvent(event) { this.handlers[event.type]?.(); }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
  }
  const ids = Object.fromEntries(['upload-images', 'clear-image-files', 'upload-status', 'upload-previews'].map(id => [id, new Element()]));
  const form = { elements: Object.fromEntries(['image_files', 'image_consent', 'image_urls', 'title', 'description'].map(name => [name, new Element()])) };
  form.elements.image_urls.value = 'https://example.test/original.jpg';
  form.elements.title.value = 'Unchanged title';
  form.elements.description.value = 'Unchanged description';
  const requests = [];
  const busy = [];
  const errors = [];
  let nextId = 0;
  let fail = new Set();
  const context = {
    BAUploads, AbortSignal, Event, console,
    document: { getElementById: id => ids[id], createElement: () => new Element() },
    BuildsUI: { apiMessage: error => error.message },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fail.has(url)) throw new Error('Network disconnected.');
      return { ok: true };
    },
    api: async (path, options) => {
      requests.push({ path, options });
      if (path.endsWith('/request-url')) {
        nextId++;
        return { id: `00000000-0000-0000-0000-${String(nextId).padStart(12, '0')}`, uploadURL: `https://storage.test/${nextId}` };
      }
      if (fail.has(path)) throw new Error('Completion response lost.');
      return { imageUrl: BAUploads.imagePath(path.split('/')[3]) };
    },
  };
  vm.runInNewContext(source, context);
  const uploads = context.BAPostUploads({ form, onBusy: value => busy.push(value), onError: error => errors.push(error) });
  uploads.refresh(false);
  const select = files => { form.elements.image_files.files = files; form.elements.image_files.handlers.change(); };
  const consent = () => { form.elements.image_consent.checked = true; form.elements.image_consent.handlers.change(); };
  return { form, ids, uploads, select, consent, requests, busy, errors, fail, context };
}
const file = name => ({ name, type: 'image/png', size: 100 });

test('upload script initializes, gates consent and invalid files, and supports clearing selection without clearing entries', async () => {
  const f = fixture();
  f.select([file('screenshot.png')]);
  assert.equal(f.ids['upload-images'].disabled, true);
  f.consent();
  assert.equal(f.ids['upload-images'].disabled, false);
  f.select([{ ...file('large.png'), size: BAUploads.maxBytes + 1 }]);
  await f.ids['upload-images'].handlers.click();
  assert.equal(f.requests.length, 0);
  assert.match(f.errors.at(-1), /8 MB/);
  f.ids['clear-image-files'].handlers.click();
  assert.equal(f.uploads.hasPending(), false);
  assert.equal(f.form.elements.title.value, 'Unchanged title');
  assert.equal(f.form.elements.image_urls.value, 'https://example.test/original.jpg');
});

test('partial direct PUT failures retain entries and successful paths; retry only sends failed files', async () => {
  const f = fixture();
  f.select([file('one.png'), file('two.png')]);
  f.consent();
  f.fail.add('https://storage.test/2');
  await f.ids['upload-images'].handlers.click();
  assert.deepEqual(f.busy, [true, false]);
  assert.equal(f.uploads.hasPending(), true);
  const firstPath = BAUploads.imagePath('00000000-0000-0000-0000-000000000001');
  assert.equal(f.form.elements.image_urls.value, `https://example.test/original.jpg\n${firstPath}`);
  assert.equal(f.form.elements.title.value, 'Unchanged title');
  assert.equal(f.form.elements.description.value, 'Unchanged description');
  f.fail.clear();
  await f.ids['upload-images'].handlers.click();
  assert.equal(f.uploads.hasPending(), false);
  assert.equal(f.requests.filter(r => r.url === 'https://storage.test/1').length, 1);
  assert.equal(f.form.elements.image_urls.value.split('\n').length, 3);
  assert.equal(f.ids['upload-previews'].children.length, 2);
  const remove = f.ids['upload-previews'].children[0].children[1];
  remove.handlers.click();
  assert.equal(f.form.elements.image_urls.value.includes(firstPath), false);
  assert.equal(f.form.elements.image_urls.value.includes('original.jpg'), true);
});

test('lost completion responses retry idempotently without resending file bytes or duplicating URLs', async () => {
  const f = fixture();
  const id = '00000000-0000-0000-0000-000000000001';
  f.fail.add(`/api/uploads/${id}/complete`);
  f.select([file('one.png')]);
  f.consent();
  await f.ids['upload-images'].handlers.click();
  assert.equal(f.uploads.hasPending(), true);
  f.fail.clear();
  await f.ids['upload-images'].handlers.click();
  assert.equal(f.uploads.hasPending(), false);
  assert.equal(f.requests.filter(r => r.url).length, 1);
  assert.equal(f.requests.filter(r => r.path?.endsWith('/request-url')).length, 1);
  assert.equal(f.requests.filter(r => r.path?.endsWith('/complete')).length, 2);
  assert.equal(f.form.elements.image_urls.value.split('\n').length, 2);
});

test('all card/carousel views load the shared uploaded-image validator before rendering', () => {
  for (const page of ['index', 'profile', 'favorites', 'top10', 'game', 'post']) {
    const html = readFileSync(require.resolve(`../public/${page}.html`), 'utf8');
    const shared = html.indexOf('/js/upload-path.js');
    assert.ok(shared >= 0, `${page} loads upload paths`);
    for (const consumer of ['builds-ui', 'social']) {
      const index = html.indexOf(`/js/${consumer}.js`);
      if (index >= 0) assert.ok(shared < index, `${page} loads validator before ${consumer}`);
    }
  }
  for (const consumer of ['builds-ui', 'social']) {
    const script = readFileSync(require.resolve(`../public/js/${consumer}.js`), 'utf8');
    assert.match(script, /window\.BAUploads\?\.uploadId\(value\)/);
  }
});
