const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relative => fs.readFileSync(path.join(__dirname, '..', 'public', relative), 'utf8');

test('showcase exposes the followed-build filter and loads additional 12-item pages', () => {
  const html = read('index.html');
  const script = read('js/showcase.js');
  assert.match(html, /id="filter-following"/);
  assert.match(html, /Builds from people I follow/);
  assert.match(html, /id="showcase-load-more"/);
  assert.match(script, /following: followingSelect\.value/);
  assert.match(script, /params\.set\('offset'/);
  assert.match(script, /result\.page\.has_more/);
  assert.match(script, /loadBuilds\(currentFilters\(\), true\)/);
});

test('profiles expose follows, owner avatar uploads, and paginated builds and reposts', () => {
  const html = read('profile.html');
  const script = read('js/profile.js');
  const upload = read('js/avatar-upload.js');
  assert.match(html, /id="profile-follower-count"/);
  assert.match(html, /id="profile-following-count"/);
  assert.match(html, /id="avatar-upload-form"/);
  assert.match(html, /id="profile-build-more"/);
  assert.match(html, /id="profile-reposts-more"/);
  assert.match(script, /\/api\/follows\//);
  assert.match(script, /list=\$\{kind\}&offset=\$\{offset\}/);
  assert.match(upload, /\/api\/profile\/avatar/);
  assert.match(upload, /publicConsent: true/);
});

test('build cards, comments, and moderation UI show avatars and private report controls', () => {
  const ui = read('js/builds-ui.js');
  const social = read('js/social.js');
  const moderation = read('js/moderation.js');
  const app = read('js/app.js');
  const css = read('css/builds.css') + read('css/phase4.css');
  assert.match(ui, /userAvatar/);
  assert.match(ui, /\/api\/reports\/\$\{targetType\}/);
  assert.match(social, /userAvatar\(comment\.avatar_url/);
  assert.match(social, /reportControl\('comments'/);
  assert.match(moderation, /api\('\/api\/reports\/moderation'\)/);
  assert.match(app, /user\.role === 'admin'/);
  assert.match(css, /\.profile-avatar img[\s\S]*object-fit: cover/);
  assert.match(css, /\.user-avatar img[\s\S]*object-fit: cover/);
});
