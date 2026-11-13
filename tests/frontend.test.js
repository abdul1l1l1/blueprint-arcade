// Run the actual plain-JS event handlers with a small DOM fixture.
// These are handler tests, not browser end-to-end tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const formCode = fs.readFileSync(path.join(__dirname, '../public/js/auth-form.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

function formFixture(mode, api) {
  const handlers = {};
  const errorBox = { textContent: '' };
  const button = { disabled: false };
  const inputs = {};
  let destination;
  const form = {
    dataset: { auth: mode },
    reportValidity: () => true,
    elements: { namedItem: name => inputs[name] },
    querySelector: selector => selector === '[role="alert"]' ? errorBox
      : selector === '[aria-invalid]' ? Object.values(inputs).find(input => input.invalid) : button,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => { handlers[name] = fn; },
  };
  const domHandlers = {};
  const document = {
    addEventListener: (name, fn) => { domHandlers[name] = fn; },
    querySelector: () => form,
    createElement: () => ({ setAttribute() {} }),
  };
  const context = {
    document, api,
    location: { assign: value => { destination = value; } },
    FormData: class { *[Symbol.iterator]() { yield ['username', 'FormBuilder']; yield ['password', 'not-a-real-credential']; } },
  };
  vm.runInNewContext(formCode, context);
  domHandlers.DOMContentLoaded();
  return { handlers, errorBox, button, inputs, destination: () => destination };
}

test('login and register handlers send form values to the correct API and redirect on success', async () => {
  for (const mode of ['login', 'register']) {
    let called;
    const fixture = formFixture(mode, async (url, options) => { called = { url, options }; });
    await fixture.handlers.submit({ preventDefault() {} });
    assert.equal(called.url, `/api/auth/${mode}`);
    assert.equal(called.options.method, 'POST');
    assert.equal(called.options.body.username, 'FormBuilder');
    assert.equal(fixture.destination(), '/');
    assert.equal(fixture.button.disabled, true);
  }
});

test('server validation is displayed inline and focuses the invalid field', async () => {
  let message;
  let focused = false;
  const fixture = formFixture('register', async () => {
    throw { data: { errors: { email: 'Enter a valid email address.' } } };
  });
  fixture.inputs.email = {
    setAttribute(name) { if (name === 'aria-invalid') this.invalid = true; },
    after(element) { message = element.textContent; },
    focus() { focused = true; },
  };
  await fixture.handlers.submit({ preventDefault() {} });
  assert.equal(message, 'Enter a valid email address.');
  assert.equal(focused, true);
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.destination(), undefined);
});

test('login rejection and network failure show errors without redirecting', async () => {
  for (const failure of [
    { data: { errors: { _general: 'Invalid username or password.' } } },
    new Error('Network unavailable'),
  ]) {
    const fixture = formFixture('login', async () => { throw failure; });
    await fixture.handlers.submit({ preventDefault() {} });
    assert.ok(fixture.errorBox.textContent.length > 0);
    assert.equal(fixture.destination(), undefined);
    assert.equal(fixture.button.disabled, false);
  }
});

test('logged-in top bar exposes a working Logout button; anonymous top bar shows login/register', async () => {
  for (const user of [null, { username: 'CaseBuilder', displayName: 'QA Builder' }]) {
    let ready;
    let destination;
    let logoutCalls = 0;
    const nodes = [];
    const sidebarNodes = [];
    const topbar = { append: node => nodes.push(node) };
    const sidebar = {
      append: node => sidebarNodes.push(node),
      querySelector: () => null,
    };
    const document = {
      documentElement: { dataset: {} },
      addEventListener: (name, fn) => { ready = fn; },
      querySelector: selector => selector === '.sidebar' ? sidebar : topbar,
      createElement: tag => ({
        tag, children: [], append(...children) { this.children.push(...children); },
        addEventListener(name, fn) { this[name] = fn; },
        setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
      }),
    };
    const events = {};
    vm.runInNewContext(appCode, {
      document, location: { pathname: '/', assign: value => { destination = value; } },
      getMe: async () => ({ user }), logout: async () => { logoutCalls++; },
      api: async path => path === '/api/notifications/unread-count' ? { unread_count: 3 } : {},
      setTimeout,
    });
    document.addEventListener = (name, fn) => {
      if (name === 'DOMContentLoaded') ready = fn;
      else events[name] = fn;
    };
    await ready();
    const children = nodes[0].children;
    assert.equal(sidebarNodes[0].href, '/about.html');
    if (user) {
      const bell = children.find(node => node.href === '/notifications.html');
      assert.ok(bell);
      assert.equal(bell.attributes['aria-label'], 'Notifications, 3 unread');
      assert.equal(bell.children[1].textContent, '3');
      events['blueprint:notifications-read']();
      assert.equal(bell.children[1].hidden, true);
      const button = children.find(node => node.tag === 'button');
      assert.equal(button.textContent, 'Logout');
      await button.click();
      assert.equal(logoutCalls, 1);
      assert.equal(destination, '/login.html');
    } else {
      assert.deepEqual(children.map(node => node.href), ['/login.html', '/register.html']);
      assert.equal(children.some(node => node.textContent === 'Logout'), false);
      assert.equal(children.some(node => node.href === '/notifications.html'), false);
    }
  }
});
