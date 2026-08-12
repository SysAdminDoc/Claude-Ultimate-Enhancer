const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '..');
const activeFile = path.join(repo, 'Claude Ultimate Enhancer.user.js');
const source = fs.readFileSync(activeFile, 'utf8');

function loadCue(seed = {}) {
  const values = new Map(Object.entries(seed));
  class MutationObserver { observe() {} disconnect() {} takeRecords() { return []; } }
  class ResizeObserver { observe() {} disconnect() {} }
  const document = {
    readyState: 'loading',
    body: null,
    documentElement: { lang: 'en-US' },
    addEventListener() {},
    removeEventListener() {},
    createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, removeEventListener() {} }; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const context = {
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Blob,
    Response,
    Request,
    Headers,
    MutationObserver,
    ResizeObserver,
    document,
    location: { href: 'https://claude.ai/new', origin: 'https://claude.ai', pathname: '/new', search: '', hash: '' },
    navigator: { userAgent: 'node-test', language: 'en-US', clipboard: { writeText: async () => {} } },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    queueMicrotask,
    requestAnimationFrame: callback => callback(),
    fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) }),
    GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
    GM_setValue: (key, value) => values.set(key, value),
    GM_addStyle() {},
    trustedTypes: { createPolicy: (_name, policy) => policy },
    confirm: () => false,
    alert() {},
    prompt: () => null,
    performance: { now: () => 0 },
    Math,
    Date,
    JSON,
    Promise,
    Intl,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    __CUE_TEST__: true
  };
  context.window = context;
  context.globalThis = context;
  context.top = context;
  context.self = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: activeFile });
  return { api: context.__CUE_TEST_API, context, values };
}

test('release metadata is scoped and internally consistent', () => {
  assert.match(source, /^\/\/ @noframes/m);
  const headerVersion = source.match(/^\/\/ @version\s+(.+)$/m)?.[1].trim();
  const codeVersion = source.match(/const VERSION = '([^']+)'/)?.[1];
  assert.equal(headerVersion, codeVersion);
  assert.match(source, /@updateURL\s+https:\/\/raw\.githubusercontent\.com\/SysAdminDoc\/Claude-Ultimate-Enhancer\/main\/Claude%20Ultimate%20Enhancer\.user\.js/);
  assert.match(source, /@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/SysAdminDoc\/Claude-Ultimate-Enhancer\/main\/Claude%20Ultimate%20Enhancer\.user\.js/);
});

test('sanitizer removes executable tags, handlers, and dangerous URLs', () => {
  const { api } = loadCue();
  const safe = api.sanitizeMarkup('<img src="javascript:alert(1)" onerror="alert(2)"><script>alert(3)</script><a href="https://example.com">ok</a>');
  assert.doesNotMatch(safe, /<script|onerror|javascript:/i);
  assert.match(safe, /https:\/\/example\.com/);
  assert.match(api.sanitizeMarkup('<button type="button">Panel</button>'), /<button/);
});

test('conversation serializer preserves tree, active branch, artifacts, and unknown fields', () => {
  const { api } = loadCue();
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'conversation.json'), 'utf8'));
  const archive = api.ConversationSerializer.from(fixture);
  assert.equal(archive.metadata.id, 'conversation-1');
  assert.deepEqual(Array.from(archive.branches.activePath), ['human-root', 'assistant-branch']);
  assert.deepEqual(Array.from(archive.branches.children['human-root']), ['assistant-main', 'assistant-branch']);
  assert.equal(archive.messages.find(message => message.id === 'assistant-branch').artifacts[0].id, 'artifact-1');
  assert.equal(archive.messages.find(message => message.id === 'assistant-main').raw.unknown_future_block.kept, true);
  assert.match(api.ConversationSerializer.toMarkdown(archive), /Branch answer/);
  assert.doesNotMatch(api.ConversationSerializer.toHTML(archive), /<script/i);
});

test('config parser accepts valid entries while reporting invalid partial entries', () => {
  const { api } = loadCue();
  const result = api.ConfigCodec.parse(JSON.stringify({
    format: 'claude-ultimate-enhancer-config',
    schema: 1,
    settings: { themeEnabled: false, panelWidth: 400, panelPinned: 'yes' },
    prompts: [
      { id: 'user_valid', label: 'Valid', prompt: 'Do the thing', cat: 'custom' },
      { id: 'bad', label: '<unsafe>', prompt: 'ignored', cat: 'custom' }
    ]
  }));
  assert.equal(result.settings.themeEnabled, false);
  assert.equal(result.settings.panelWidth, 400);
  assert.equal(result.settings.panelPinned, undefined);
  assert.equal(result.prompts.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.throws(() => api.ConfigCodec.parse(JSON.stringify({ schema: 99, settings: {} })), /Unsupported config schema/);
});

test('storage migrates legacy JSON and quarantines malformed values', () => {
  const { api, values } = loadCue({ 'cue-test': JSON.stringify([1, 2]) });
  const migrated = api.StorageRepository.read('cue-test', [], {
    version: 1,
    migrate: value => value,
    validate: value => Array.isArray(value) && value.every(Number.isFinite)
  });
  assert.deepEqual(migrated, [1, 2]);
  assert.equal(JSON.parse(values.get('cue-test')).schema, 1);
  values.set('cue-bad', '{not-json');
  assert.deepEqual(api.StorageRepository.read('cue-bad', ['fallback'], { version: 1, validate: Array.isArray }), ['fallback']);
  assert.match(String(values.get('cue-bad_quarantine')), /malformed JSON/);
});

test('API contract records rate limits without exposing response bodies', async () => {
  const { api, context } = loadCue();
  api.ClaudeAPI._orgId = null;
  context.fetch = async () => ({ ok: false, status: 429, headers: { get: name => name === 'Retry-After' ? '30' : null }, json: async () => ({ secret: 'not logged' }) });
  assert.deepEqual(Array.from(await api.ClaudeAPI.getOrgs()), []);
  const status = api.ClaudeAPI.getLastStatus('organizations');
  assert.equal(status.category, 'rate-limited');
  assert.equal(status.retryAfter, '30');
  assert.doesNotMatch(JSON.stringify(status), /not logged/);
});
