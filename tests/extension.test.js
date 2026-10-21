'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const content = fs.readFileSync(path.join(root, 'src/content.js'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'src/popup.js'), 'utf8');

function harness(initialCount = 0, initialEnabled = false, cssSupported = true) {
  let count = initialCount;
  let style = null;
  let storageCallback;
  let messageCallback;
  let intervalCallback;
  let pendingGet;
  let warnCount = 0;
  let throwOnQuery = false;
  const document = {
    body: {},
    documentElement: { appendChild(node) { style = node; } },
    head: { appendChild(node) { style = node; } },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-message-author-role]');
      if (throwOnQuery) throw new Error('DOM changed');
      return { length: count };
    },
    getElementById(id) { return style && style.id === id ? style : null; },
    createElement(tag) {
      assert.equal(tag, 'style');
      return { id: '', textContent: '', remove() { style = null; } };
    }
  };
  const chrome = {
    storage: {
      local: { get: () => new Promise(resolve => { pendingGet = resolve; }) },
      onChanged: { addListener(fn) { storageCallback = fn; } }
    },
    runtime: { onMessage: { addListener(fn) { messageCallback = fn; } } }
  };
  vm.runInNewContext(content, {
    document, chrome,
    CSS: { supports() { return cssSupported; } },
    setInterval(fn, ms) { assert.equal(ms, 5000); intervalCallback = fn; },
    console: { warn() { warnCount += 1; } }
  }, { filename: 'content.js' });
  function status() {
    let result;
    messageCallback({ type: 'GCO_STATUS' }, {}, response => { result = response; });
    return result;
  }
  return {
    get style() { return style; },
    get warns() { return warnCount; },
    status,
    start(value = initialEnabled) { pendingGet({ enabled: value }); },
    changeEnabled(value) { storageCallback({ enabled: { newValue: value } }, 'local'); },
    setCount(value) { count = value; intervalCallback(); },
    failDOM() { throwOnQuery = true; intervalCallback(); },
    unrelatedChange() { storageCallback({ other: { newValue: 1 } }, 'local'); }
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('MV3 has narrowly scoped match and storage-only permissions', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://chatgpt.com/*']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.externally_connectable, undefined);
});

test('source uses no remote request, dynamic evaluation, or message text reads', () => {
  for (const source of [content, popup]) {
    assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\bimport\s*\(/);
  }
  assert.equal((content.match(/\.textContent/g) || []).length, 1);
  assert.match(content, /style\.textContent\s*=\s*OPTIMIZATION_CSS/);
  assert.doesNotMatch(content, /\.innerHTML|\.innerText|\.removeChild\s*\(/);
  assert.doesNotMatch(content, /\.dataset\b|\.localStorage\b|\bdocument\.cookie\b/);
});

test('defaults to OFF even on long chats', async () => {
  const h = harness(100);
  h.start(); await flush();
  assert.equal(h.style, null);
  assert.equal(h.status().active, false);
  assert.equal(h.status().messageCount, 100);
});

test('waits for threshold, then injects CSS only; disabling reverses', async () => {
  const h = harness(39, true);
  h.start(); await flush();
  assert.equal(h.style, null);
  h.setCount(40);
  assert.match(h.style.textContent, /content-visibility:\s*auto/);
  assert.match(h.style.textContent, /contain-intrinsic-size:\s*auto 420px/);
  assert.equal(h.status().active, true);
  h.changeEnabled(false);
  assert.equal(h.style, null);
  assert.equal(h.status().active, false);
});

test('unsupported browser applies no CSS', async () => {
  const h = harness(60, true, false);
  h.start(); await flush();
  assert.equal(h.style, null);
  assert.equal(h.status().supported, false);
});

test('DOM failure disables optimization safely for session', async () => {
  const h = harness(60, true);
  h.start(); await flush();
  assert.ok(h.style);
  h.failDOM();
  assert.equal(h.style, null);
  assert.equal(h.status().failed, true);
  assert.equal(h.warns, 1);
});

test('storage update wins over an unresolved initial read', async () => {
  const h = harness(60, true);
  h.changeEnabled(false);
  h.start(true);
  await flush();
  assert.equal(h.style, null);
  assert.equal(h.status().enabled, false);
});

test('unrelated storage changes do not enable optimization', async () => {
  const h = harness(70);
  h.start(); await flush();
  h.unrelatedChange();
  assert.equal(h.style, null);
});
