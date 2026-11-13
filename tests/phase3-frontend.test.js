// Actual shared Phase 3 browser handlers exercised in a small DOM fixture.
// The separate browser pass covers the complete form/profile navigation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../public/js/builds-ui.js'), 'utf8');
function fixture() {
  const calls = [];
  const messages = [];
  let refreshes = 0;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.handlers = {}; this.attributes = {}; this.classList = { add() {} }; }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    replaceWith(node) { const list = this.parent.children; list.splice(list.indexOf(this), 1, node); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, handler) { this.handlers[key] = handler; }
  }
  const window = { confirm: () => false };
  const context = {
    window, URL,
    document: { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) },
    api: async (path, options) => { calls.push({ path, options }); return {}; },
    toast: message => messages.push(message),
  };
  vm.runInNewContext(source, context);
  const walk = node => [node, ...(node.children || []).flatMap(walk)];
  const build = {
    id: 'qa-build-id', owner_id: 'owner-id', owner: 'abdul_builds', display_name: 'Abdul',
    title: '<script>inert title</script>', description: 'Full description', game_name: 'Bloxburg',
    game_slug: 'bloxburg', image_urls: [], tags: ['Modern Villa'], is_pinned: false,
  };
  const options = { me: { id: 'owner-id' }, onRefresh: async () => { refreshes++; } };
  return { ui: window.BuildsUI, window, context, build, options, calls, messages, walk, refreshes: () => refreshes };
}

test('P3 UI: creator profile links use the real username, not the display name; text is not HTML', () => {
  const f = fixture();
  const nodes = f.walk(f.ui.buildCard(f.build));
  const credit = nodes.find(node => node.href?.startsWith('/profile.html'));
  assert.equal(credit.textContent, 'Abdul');
  assert.equal(credit.href, '/profile.html?username=abdul_builds');
  const detail = nodes.find(node => node.className === 'build-detail-link');
  assert.equal(detail.textContent, '<script>inert title</script>');
  assert.equal(detail.href, '/build.html?id=qa-build-id');
});

test('approved demo covers have honest visible labels and accessible alt text without changing creator credit', () => {
  const f = fixture();
  vm.runInNewContext(readFileSync(require.resolve('../public/js/approved-images.js'), 'utf8'), f.context);
  const path = f.window.BAApprovedImages.entries[0].path;
  const card = f.ui.buildCard({ ...f.build, image_urls: [path] });
  const nodes = f.walk(card);
  assert.equal(nodes.find(n => n.className === 'illustration-label').textContent, 'Illustration — not an in-game screenshot');
  assert.match(nodes.find(n => n.tag === 'img').alt, /^Illustration — not an in-game screenshot:/);
  assert.equal(nodes.find(n => n.href?.startsWith('/profile.html')).textContent, 'Abdul');
  assert.equal(f.ui.safeImageUrl(path), path);
  assert.equal(f.ui.safeImageUrl(path + '?x=1'), '');
  assert.equal(f.ui.safeImageUrl('/media/unapproved.jpg'), '');
  const noImage = f.walk(f.ui.buildCard(f.build));
  assert.equal(noImage.some(n => n.className === 'illustration-label'), false);
});

test('P3 UI: only owners get controls; delete cancellation sends nothing; confirmed delete and pin refresh the view', async () => {
  const f = fixture();
  for (const me of [null, { id: 'someone-else' }]) {
    assert.equal(f.walk(f.ui.buildCard(f.build, { me })).some(node => node.tag === 'button'), false);
  }
  const nodes = f.walk(f.ui.buildCard(f.build, f.options));
  assert.ok(nodes.some(node => node.href === '/post.html?id=qa-build-id'));
  const remove = nodes.find(node => node.textContent === 'Delete');
  await remove.handlers.click();
  assert.equal(f.calls.length, 0);
  f.window.confirm = () => true;
  await remove.handlers.click();
  assert.equal(f.calls[0].options.method, 'DELETE');
  assert.equal(f.refreshes(), 1);
  const pin = nodes.find(node => node.textContent === 'Pin');
  await pin.handlers.click();
  assert.equal(f.calls[1].options.body.is_pinned, true);
  assert.equal(f.refreshes(), 2);
});

test('P3 UI: failed mutations show errors without refresh; unsafe covers are rejected and failed images keep pin badge', async () => {
  const f = fixture();
  f.context.api = async () => { throw { status: 409, data: { errors: { is_pinned: 'Only three pins allowed.' } } }; };
  const pin = f.walk(f.ui.buildCard(f.build, f.options)).find(node => node.textContent === 'Pin');
  await pin.handlers.click();
  assert.equal(f.refreshes(), 0);
  assert.equal(pin.disabled, false);
  assert.equal(f.messages[0], 'Only three pins allowed.');
  assert.equal(f.ui.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(f.ui.safeImageUrl('https://name:private@example.test/image'), '');
  const card = f.ui.buildCard({ ...f.build, is_pinned: true, image_urls: ['https://example.test/cover.png'] });
  const image = f.walk(card).find(node => node.tag === 'img');
  image.handlers.error();
  assert.ok(f.walk(card).some(node => node.textContent === 'Cover image unavailable'));
  assert.ok(f.walk(card).some(node => node.textContent === 'Pinned'));
});
