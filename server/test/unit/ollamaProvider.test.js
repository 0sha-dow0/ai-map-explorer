import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createOllamaProvider } from '../../src/services/ai/ollamaProvider.js'
import { ProviderError, PROVIDER_ERROR_KINDS } from '../../src/services/ai/providerContract.js'

const K = PROVIDER_ERROR_KINDS

// ---------- helpers ----------

/** Build a fake Response-like object read via {ok,status,text()}. */
function fakeRes({ ok = true, status = 200, text }) {
  return { ok, status, text: () => Promise.resolve(text) }
}

/** A fetch that returns the given res and records each call's args. */
function fetchReturning(res, calls) {
  return (url, init) => {
    if (calls) calls.push({ url, init })
    return Promise.resolve(res)
  }
}

/** A fetch that rejects (transport failure). */
function fetchRejecting(cause, calls) {
  return (url, init) => {
    if (calls) calls.push({ url, init })
    return Promise.reject(cause)
  }
}

/** A fetch that must never be called. */
function fetchThatThrows() {
  return () => {
    throw new Error('fetch must not be called')
  }
}

/** Valid content response. */
function contentRes(content) {
  return fakeRes({ ok: true, status: 200, text: JSON.stringify({ message: { content } }) })
}

/** Valid params factory. */
function validParams(overrides = {}) {
  return {
    systemPrompt: 'sys prompt',
    userPrompt: 'usr prompt',
    maxOutputTokens: 256,
    ...overrides,
  }
}

/** Assert value is a ProviderError with expected provider/kind. */
function assertProviderError(err, { provider, kind }) {
  assert.ok(err instanceof ProviderError, `expected ProviderError, got ${err && err.name}: ${err}`)
  assert.equal(err.name, 'ProviderError')
  assert.equal(err.kind, kind, `kind mismatch: ${err.message}`)
  if (provider !== undefined) assert.equal(err.provider, provider, `provider mismatch: ${err.message}`)
}

// =====================================================================
// Factory deps validation
// =====================================================================

test('deps null -> invalid-params, provider ollama', () => {
  const err = (() => {
    try {
      createOllamaProvider(null)
    } catch (e) {
      return e
    }
    return null
  })()
  assertProviderError(err, { provider: 'ollama', kind: K.INVALID_PARAMS })
})

test('deps undefined -> invalid-params', () => {
  let err
  try {
    createOllamaProvider(undefined)
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.INVALID_PARAMS })
})

test('deps array -> invalid-params (not a plain object)', () => {
  let err
  try {
    createOllamaProvider([])
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.INVALID_PARAMS })
})

test('env not an object -> invalid-params', () => {
  for (const badEnv of [null, undefined, 'x', 42, [], () => {}]) {
    let err
    try {
      createOllamaProvider({ env: badEnv, fetch: () => {} })
    } catch (e) {
      err = e
    }
    assertProviderError(err, { provider: 'ollama', kind: K.INVALID_PARAMS })
  }
})

test('fetch not a function -> invalid-params', () => {
  for (const badFetch of [null, undefined, 'x', 42, {}, []]) {
    let err
    try {
      createOllamaProvider({ env: {}, fetch: badFetch })
    } catch (e) {
      err = e
    }
    assertProviderError(err, { provider: 'ollama', kind: K.INVALID_PARAMS })
  }
})

test('valid deps -> returns object with generateJson function', () => {
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: () => {} })
  assert.equal(typeof provider.generateJson, 'function')
})

// =====================================================================
// Config validation (OLLAMA_MODEL) — ZERO fetch calls
// =====================================================================

test('missing OLLAMA_MODEL -> config error, names OLLAMA_MODEL, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: {}, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.CONFIG })
  assert.match(err.message, /OLLAMA_MODEL/)
  assert.equal(calls.length, 0, 'must not call fetch when model missing')
})

test('empty-string OLLAMA_MODEL -> config error, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: '' }, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.CONFIG })
  assert.match(err.message, /OLLAMA_MODEL/)
  assert.equal(calls.length, 0)
})

test('whitespace-only OLLAMA_MODEL -> config error, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: '   \t\n ' }, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.CONFIG })
  assert.equal(calls.length, 0)
})

test('non-string OLLAMA_MODEL (number) -> config error, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 123 }, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.CONFIG })
  assert.equal(calls.length, 0)
})

// =====================================================================
// Params validation — ZERO fetch calls
// =====================================================================

test('invalid params (missing systemPrompt) -> invalid-params, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson({ userPrompt: 'u', maxOutputTokens: 10 })
  } catch (e) {
    err = e
  }
  assertProviderError(err, { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

test('invalid params (non-object) -> invalid-params, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  for (const bad of [null, undefined, 'x', 5, []]) {
    let err
    try {
      await provider.generateJson(bad)
    } catch (e) {
      err = e
    }
    assertProviderError(err, { kind: K.INVALID_PARAMS })
  }
  assert.equal(calls.length, 0)
})

test('invalid maxOutputTokens (out of range) -> invalid-params, zero fetch calls', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  let err
  try {
    await provider.generateJson(validParams({ maxOutputTokens: 999999 }))
  } catch (e) {
    err = e
  }
  assertProviderError(err, { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

// =====================================================================
// Request shape
// =====================================================================

test('default URL is http://localhost:11434/api/chat', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams())
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://localhost:11434/api/chat')
})

test('OLLAMA_BASE_URL override respected', async () => {
  const calls = []
  const provider = createOllamaProvider({
    env: { OLLAMA_MODEL: 'llama3', OLLAMA_BASE_URL: 'http://host:1234' },
    fetch: fetchReturning(contentRes('{}'), calls),
  })
  await provider.generateJson(validParams())
  assert.equal(calls[0].url, 'http://host:1234/api/chat')
})

test('single trailing slash base -> no double slash', async () => {
  const calls = []
  const provider = createOllamaProvider({
    env: { OLLAMA_MODEL: 'llama3', OLLAMA_BASE_URL: 'http://host:1234/' },
    fetch: fetchReturning(contentRes('{}'), calls),
  })
  await provider.generateJson(validParams())
  assert.equal(calls[0].url, 'http://host:1234/api/chat')
})

test('multiple trailing slashes base -> collapsed, no double slash', async () => {
  const calls = []
  const provider = createOllamaProvider({
    env: { OLLAMA_MODEL: 'llama3', OLLAMA_BASE_URL: 'http://host:1234////' },
    fetch: fetchReturning(contentRes('{}'), calls),
  })
  await provider.generateJson(validParams())
  assert.equal(calls[0].url, 'http://host:1234/api/chat')
})

test('whitespace-only OLLAMA_BASE_URL falls back to default', async () => {
  const calls = []
  const provider = createOllamaProvider({
    env: { OLLAMA_MODEL: 'llama3', OLLAMA_BASE_URL: '   ' },
    fetch: fetchReturning(contentRes('{}'), calls),
  })
  await provider.generateJson(validParams())
  assert.equal(calls[0].url, 'http://localhost:11434/api/chat')
})

test('method is POST', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams())
  assert.equal(calls[0].init.method, 'POST')
})

test('headers are exactly {Content-Type: application/json} with no Authorization', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams())
  const headers = calls[0].init.headers
  assert.deepEqual(headers, { 'Content-Type': 'application/json' })
  assert.deepEqual(Object.keys(headers), ['Content-Type'])
  assert.ok(!('Authorization' in headers), 'no Authorization header')
})

test('body shape: model, messages, stream:false, format:json, options', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams({ systemPrompt: 'SYS', userPrompt: 'USR', maxOutputTokens: 512, temperature: 0.3 }))
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.model, 'llama3')
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'USR' },
  ])
  assert.equal(body.stream, false)
  assert.equal(body.format, 'json')
  assert.equal(body.options.temperature, 0.3)
  assert.equal(body.options.num_predict, 512)
  assert.deepEqual(Object.keys(body.options).sort(), ['num_predict', 'temperature'])
})

test('temperature defaults to 0.7 when omitted', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams())
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.options.temperature, 0.7)
})

test('model is trimmed before use', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: '  llama3  ' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams())
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.model, 'llama3')
})

test('temperature=0 boundary is sent (not defaulted)', async () => {
  const calls = []
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{}'), calls) })
  await provider.generateJson(validParams({ temperature: 0 }))
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.options.temperature, 0)
})

// =====================================================================
// Response extraction
// =====================================================================

test('valid content is trimmed and returned', async () => {
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('  {"ok":true}  \n')) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, '{"ok":true}')
})

test('content with only inner value returned verbatim (no trim of interior)', async () => {
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('{ "a": 1 }')) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, '{ "a": 1 }')
})

test('missing message -> empty error', async () => {
  const res = fakeRes({ ok: true, status: 200, text: JSON.stringify({ foo: 'bar' }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('message present but content missing -> empty error', async () => {
  const res = fakeRes({ ok: true, status: 200, text: JSON.stringify({ message: { role: 'assistant' } }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('content non-string (number) -> empty error', async () => {
  const res = fakeRes({ ok: true, status: 200, text: JSON.stringify({ message: { content: 42 } }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('content non-string (null) -> empty error', async () => {
  const res = fakeRes({ ok: true, status: 200, text: JSON.stringify({ message: { content: null } }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('content empty string -> empty error', async () => {
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('')) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('content whitespace-only -> empty error', async () => {
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(contentRes('   \t\n  ')) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

test('message as array (not plain object) -> empty error', async () => {
  const res = fakeRes({ ok: true, status: 200, text: JSON.stringify({ message: [] }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.EMPTY })
})

// =====================================================================
// Non-ok responses
// =====================================================================

test('non-ok with {error:"model not found"} -> request error, message preserved', async () => {
  const res = fakeRes({ ok: false, status: 404, text: JSON.stringify({ error: 'model not found' }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.REQUEST })
  assert.equal(err.message, 'model not found')
})

test('non-ok without error field -> fallback message contains status', async () => {
  const res = fakeRes({ ok: false, status: 500, text: JSON.stringify({ something: 'else' }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.REQUEST })
  assert.match(err.message, /500/)
})

test('non-ok with non-string error field -> fallback message contains status', async () => {
  const res = fakeRes({ ok: false, status: 503, text: JSON.stringify({ error: { nested: true } }) })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchReturning(res) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.REQUEST })
  assert.match(err.message, /503/)
})

// =====================================================================
// Transport failure
// =====================================================================

test('fetch rejects (ECONNREFUSED) -> request error with cause preserved', async () => {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' })
  const provider = createOllamaProvider({ env: { OLLAMA_MODEL: 'llama3' }, fetch: fetchRejecting(cause) })
  let err
  try {
    await provider.generateJson(validParams())
  } catch (e) {
    err = e
  }
  assertProviderError(err, { provider: 'ollama', kind: K.REQUEST })
  assert.equal(err.cause, cause, 'cause must be preserved')
})

// =====================================================================
// No API key read / no leakage
// =====================================================================

test('GROQ_API_KEY / GEMINI_API_KEY in env do not affect headers or behavior', async () => {
  const calls = []
  const provider = createOllamaProvider({
    env: { OLLAMA_MODEL: 'llama3', GROQ_API_KEY: 'gk-secret', GEMINI_API_KEY: 'gm-secret' },
    fetch: fetchReturning(contentRes('{"ok":1}'), calls),
  })
  const out = await provider.generateJson(validParams())
  assert.equal(out, '{"ok":1}')
  const headers = calls[0].init.headers
  assert.deepEqual(headers, { 'Content-Type': 'application/json' })
  const serialized = JSON.stringify(calls[0])
  assert.ok(!serialized.includes('gk-secret'), 'secret must not leak into request')
  assert.ok(!serialized.includes('gm-secret'), 'secret must not leak into request')
})
