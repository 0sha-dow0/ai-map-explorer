import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createGeminiProvider } from '../../src/services/ai/geminiProvider.js'
import { ProviderError, PROVIDER_ERROR_KINDS } from '../../src/services/ai/providerContract.js'

const K = PROVIDER_ERROR_KINDS
const EXPECTED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
const SECRET = 'super-secret-api-key-xyz'

// ---------- fake Response + fetch helpers ----------

/** Response-like object read by providerHttp via {ok,status,text()}. */
function fakeRes({ ok = true, status = 200, text = '' }) {
  return { ok, status, text: () => Promise.resolve(text) }
}

/** A fetch stub returning `res` and recording every call's (url, init). */
function fetchReturning(res, calls) {
  return (url, init) => {
    calls.push({ url, init })
    return Promise.resolve(res)
  }
}

/** A fetch stub whose invocation count can be asserted (should stay 0). */
function countingFetch(calls) {
  return (url, init) => {
    calls.push({ url, init })
    return Promise.resolve(fakeRes({ text: '{}' }))
  }
}

/** A fetch stub that rejects (transport error). */
function fetchRejecting(cause, calls) {
  return (url, init) => {
    calls.push({ url, init })
    return Promise.reject(cause)
  }
}

/** Build a candidates response body string. */
function candidatesBody(parts) {
  return JSON.stringify({ candidates: [{ content: { parts } }] })
}

const validParams = () => ({
  systemPrompt: 'You are helpful.',
  userPrompt: 'Say hi.',
  maxOutputTokens: 256,
})

/** Assert thrown value is a ProviderError with kind (+ optional provider). */
async function rejectsWith(fn, { kind, provider } = {}) {
  let err
  try {
    await fn()
  } catch (e) {
    err = e
  }
  assert.ok(err, 'expected a thrown error')
  assert.ok(err instanceof ProviderError, `expected ProviderError, got ${err && err.name}: ${err}`)
  assert.equal(err.name, 'ProviderError')
  if (kind !== undefined) assert.equal(err.kind, kind, `kind mismatch: ${err.kind}`)
  if (provider !== undefined) assert.equal(err.provider, provider, `provider mismatch: ${err.provider}`)
  return err
}

// ================= Factory validation =================

test('factory: null deps -> invalid-params/gemini, no fetch call', () => {
  assert.throws(() => createGeminiProvider(null), (e) => e instanceof ProviderError && e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
})

test('factory: undefined deps -> invalid-params/gemini', () => {
  assert.throws(() => createGeminiProvider(undefined), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
})

test('factory: array deps -> invalid-params/gemini', () => {
  assert.throws(() => createGeminiProvider([]), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
})

test('factory: env not an object -> invalid-params/gemini', () => {
  assert.throws(() => createGeminiProvider({ env: 'nope', fetch: () => {} }), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
  assert.throws(() => createGeminiProvider({ env: null, fetch: () => {} }), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
  assert.throws(() => createGeminiProvider({ env: [], fetch: () => {} }), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
})

test('factory: fetch not a function -> invalid-params/gemini', () => {
  assert.throws(() => createGeminiProvider({ env: {}, fetch: 'nope' }), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
  assert.throws(() => createGeminiProvider({ env: {}, fetch: undefined }), (e) => e.kind === K.INVALID_PARAMS && e.provider === 'gemini')
})

test('factory: valid deps returns object with generateJson function', () => {
  const provider = createGeminiProvider({ env: {}, fetch: () => {} })
  assert.equal(typeof provider.generateJson, 'function')
})

// ================= Config: API key =================

test('config: missing GEMINI_API_KEY -> config/gemini, names key, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: {}, fetch: countingFetch(calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.CONFIG, provider: 'gemini' })
  assert.match(err.message, /GEMINI_API_KEY/)
  assert.equal(calls.length, 0, 'fetch must not be invoked when API key missing')
})

test('config: empty GEMINI_API_KEY -> config/gemini, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: '' }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.CONFIG, provider: 'gemini' })
  assert.equal(calls.length, 0)
})

test('config: whitespace GEMINI_API_KEY -> config/gemini, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: '   \t\n ' }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.CONFIG, provider: 'gemini' })
  assert.equal(calls.length, 0)
})

test('config: error message never leaks the key value', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: '   ' }, fetch: countingFetch(calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.CONFIG })
  assert.ok(!err.message.includes('   ') || err.message.trim().length > 0)
})

// ================= Invalid params -> zero fetch =================

test('invalid params: empty systemPrompt -> invalid-params, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson({ systemPrompt: '', userPrompt: 'x', maxOutputTokens: 10 }), { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

test('invalid params: maxOutputTokens 0 -> invalid-params, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson({ systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 0 }), { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

test('invalid params: null params -> invalid-params, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson(null), { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

test('invalid params: missing userPrompt -> invalid-params, zero fetch', async () => {
  const calls = []
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson({ systemPrompt: 's', maxOutputTokens: 10 }), { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

test('invalid params precedence: params validated before API key check', async () => {
  // No API key AND bad params -> still invalid-params (params asserted first), zero fetch.
  const calls = []
  const provider = createGeminiProvider({ env: {}, fetch: countingFetch(calls) })
  await rejectsWith(() => provider.generateJson({ systemPrompt: '', userPrompt: '', maxOutputTokens: 0 }), { kind: K.INVALID_PARAMS })
  assert.equal(calls.length, 0)
})

// ================= Request shape =================

test('request shape: URL, headers, and body are exactly correct', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: '{"ok":true}' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })

  const out = await provider.generateJson({ systemPrompt: 'SYS', userPrompt: 'USR', maxOutputTokens: 512, temperature: 0.3 })
  assert.equal(out, '{"ok":true}')

  assert.equal(calls.length, 1)
  const { url, init } = calls[0]
  assert.equal(String(url), EXPECTED_URL)
  assert.equal(init.method, 'POST')
  assert.deepEqual(init.headers, { 'Content-Type': 'application/json', 'x-goog-api-key': SECRET })

  const body = JSON.parse(init.body)
  assert.deepEqual(body, {
    system_instruction: { parts: [{ text: 'SYS' }] },
    contents: [{ role: 'user', parts: [{ text: 'USR' }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 512, responseMimeType: 'application/json' },
  })
})

test('request shape: temperature defaults to 0.7 when omitted', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await provider.generateJson(validParams())
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.generationConfig.temperature, 0.7)
})

test('request shape: temperature 0 is honored (not treated as missing)', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await provider.generateJson({ systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 10, temperature: 0 })
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.generationConfig.temperature, 0)
})

test('request shape: body is a JSON string, not an object', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await provider.generateJson(validParams())
  assert.equal(typeof calls[0].init.body, 'string')
})

// ================= Model selection =================

test('model: default gemini-2.5-flash-lite when GEMINI_MODEL unset', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await provider.generateJson(validParams())
  assert.equal(String(calls[0].url), EXPECTED_URL)
})

test('model: blank GEMINI_MODEL falls back to default', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET, GEMINI_MODEL: '   ' }, fetch: fetchReturning(res, calls) })
  await provider.generateJson(validParams())
  assert.equal(String(calls[0].url), EXPECTED_URL)
})

test('model: custom GEMINI_MODEL honored and trimmed', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'x' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET, GEMINI_MODEL: '  gemini-2.5-pro  ' }, fetch: fetchReturning(res, calls) })
  await provider.generateJson(validParams())
  assert.equal(String(calls[0].url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent')
})

// ================= Response parsing =================

test('parse: multiple parts joined in order', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'foo' }, { text: 'bar' }, { text: 'baz' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, 'foobarbaz')
})

test('parse: parts with missing text treated as empty string', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: 'a' }, { notText: 'ignored' }, { text: 'b' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, 'ab')
})

test('parse: result is trimmed', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: '   {"k":1}   ' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, '{"k":1}')
})

test('parse: happy path returns non-empty string', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: '{"result":42}' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const out = await provider.generateJson(validParams())
  assert.equal(typeof out, 'string')
  assert.ok(out.length > 0)
})

test('parse: parts across multiple candidates joined in order', async () => {
  const calls = []
  const body = JSON.stringify({
    candidates: [
      { content: { parts: [{ text: 'one' }] } },
      { content: { parts: [{ text: 'two' }] } },
    ],
  })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(fakeRes({ text: body }), calls) })
  const out = await provider.generateJson(validParams())
  assert.equal(out, 'onetwo')
})

// ================= Empty responses =================

test('empty: candidates missing -> empty/gemini', async () => {
  const calls = []
  const res = fakeRes({ text: JSON.stringify({ foo: 'bar' }) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.EMPTY, provider: 'gemini' })
})

test('empty: candidates [] -> empty/gemini', async () => {
  const calls = []
  const res = fakeRes({ text: JSON.stringify({ candidates: [] }) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.EMPTY, provider: 'gemini' })
})

test('empty: all parts whitespace/empty -> empty/gemini', async () => {
  const calls = []
  const res = fakeRes({ text: candidatesBody([{ text: '  ' }, { text: '' }, { text: '\n\t' }]) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.EMPTY, provider: 'gemini' })
})

test('empty: candidate with no content/parts -> empty/gemini', async () => {
  const calls = []
  const res = fakeRes({ text: JSON.stringify({ candidates: [{}] }) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.EMPTY, provider: 'gemini' })
})

// ================= Non-ok / transport errors =================

test('non-ok: {error:{message}} surfaces the message as request/gemini', async () => {
  const calls = []
  const res = fakeRes({ ok: false, status: 400, text: JSON.stringify({ error: { message: 'bad thing' } }) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.message, 'bad thing')
})

test('non-ok: no message -> fallback contains status', async () => {
  const calls = []
  const res = fakeRes({ ok: false, status: 503, text: JSON.stringify({ error: {} }) })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
  assert.match(err.message, /503/)
})

test('non-ok: non-JSON body -> fallback contains status', async () => {
  const calls = []
  const res = fakeRes({ ok: false, status: 500, text: 'Internal Server Error' })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
  assert.match(err.message, /500/)
})

test('transport: fetch rejects -> request/gemini with cause', async () => {
  const calls = []
  const cause = new Error('ECONNREFUSED')
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchRejecting(cause, calls) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.cause, cause)
})

test('malformed: ok response with invalid JSON body -> request/gemini', async () => {
  const calls = []
  const res = fakeRes({ ok: true, status: 200, text: 'not json{' })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
})

test('malformed: ok response JSON root not an object -> request/gemini', async () => {
  const calls = []
  const res = fakeRes({ ok: true, status: 200, text: '[1,2,3]' })
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: SECRET }, fetch: fetchReturning(res, calls) })
  await rejectsWith(() => provider.generateJson(validParams()), { kind: K.REQUEST, provider: 'gemini' })
})

// ================= Key never leaks across error paths =================

test('security: API key never appears in any error message', async () => {
  const key = 'LEAK_ME_1234567890'
  const scenarios = [
    // non-ok with error message
    { env: { GEMINI_API_KEY: key }, fetch: () => Promise.resolve(fakeRes({ ok: false, status: 401, text: JSON.stringify({ error: { message: 'unauthorized' } }) })) },
    // transport reject
    { env: { GEMINI_API_KEY: key }, fetch: () => Promise.reject(new Error('boom')) },
    // empty candidates
    { env: { GEMINI_API_KEY: key }, fetch: () => Promise.resolve(fakeRes({ text: JSON.stringify({ candidates: [] }) })) },
    // malformed json
    { env: { GEMINI_API_KEY: key }, fetch: () => Promise.resolve(fakeRes({ text: 'xx' })) },
  ]
  for (const deps of scenarios) {
    const provider = createGeminiProvider(deps)
    let err
    try {
      await provider.generateJson(validParams())
    } catch (e) {
      err = e
    }
    assert.ok(err, 'expected an error')
    assert.ok(!String(err.message).includes(key), `key leaked in message: ${err.message}`)
    if (err.cause) assert.ok(!String(err.cause.message || '').includes(key), 'key leaked in cause')
  }
})

test('security: config-path error message does not include key', async () => {
  const key = 'CONFIG_LEAK_9999'
  // whitespace key still triggers config; ensure message names the env var, not the value
  const provider = createGeminiProvider({ env: { GEMINI_API_KEY: `  ${key}  ` === '' ? '' : ' ' }, fetch: () => Promise.resolve(fakeRes({ text: '{}' })) })
  const err = await rejectsWith(() => provider.generateJson(validParams()), { kind: K.CONFIG })
  assert.ok(!err.message.includes(key))
})
