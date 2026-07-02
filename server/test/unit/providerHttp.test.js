import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveFetch, requestProviderJson } from '../../src/services/ai/providerHttp.js'
import { ProviderError, PROVIDER_ERROR_KINDS } from '../../src/services/ai/providerContract.js'

const K = PROVIDER_ERROR_KINDS

// ---------- fake Response helpers ----------

/** Build a fake Response-like object that the helper reads via {ok,status,text()}. */
function fakeRes({ ok = true, status = 200, text }) {
  return {
    ok,
    status,
    text: () => Promise.resolve(text),
  }
}

/** Response whose text() rejects. */
function fakeResTextRejects({ ok = true, status = 200, cause }) {
  return {
    ok,
    status,
    text: () => Promise.reject(cause),
  }
}

/** A fetch that returns the given res and records the call args. */
function fetchReturning(res, calls) {
  return (url, init) => {
    if (calls) calls.push({ url, init })
    return Promise.resolve(res)
  }
}

/** Standard valid args factory, overridable. */
function baseArgs(overrides = {}) {
  return {
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{"a":1}' })),
    url: 'https://example.test/v1',
    headers: { 'content-type': 'application/json' },
    body: { hello: 'world' },
    provider: 'gemini',
    extractErrorMessage: (data, status) => `err ${status}`,
    ...overrides,
  }
}

/** Assert a thrown value is a ProviderError with the given kind (and optionally provider). */
function assertProviderError(err, { kind, provider } = {}) {
  assert.ok(err instanceof ProviderError, `expected ProviderError, got ${err && err.constructor && err.constructor.name}: ${err}`)
  assert.equal(err.name, 'ProviderError')
  if (kind !== undefined) assert.equal(err.kind, kind, `expected kind ${kind}, got ${err.kind}`)
  if (provider !== undefined) assert.equal(err.provider, provider, `expected provider ${provider}, got ${err.provider}`)
}

async function captureThrow(promise) {
  try {
    await promise
    return { threw: false, err: undefined }
  } catch (err) {
    return { threw: true, err }
  }
}

// ==================================================================
// resolveFetch
// ==================================================================

test('resolveFetch: injected function returned as-is (identity)', () => {
  const fn = () => {}
  assert.equal(resolveFetch(fn), fn)
})

test('resolveFetch: undefined + globalThis.fetch present → late-binding wrapper', async () => {
  const saved = globalThis.fetch
  try {
    const callsA = []
    globalThis.fetch = (u, i) => { callsA.push('A'); return Promise.resolve('resA') }
    const wrapper = resolveFetch(undefined)
    assert.equal(typeof wrapper, 'function')
    assert.notEqual(wrapper, globalThis.fetch, 'wrapper should not be the raw global fetch (it is a late binding wrapper)')

    const r1 = await wrapper('u1', { m: 1 })
    assert.equal(r1, 'resA')
    assert.deepEqual(callsA, ['A'])

    // Swap the global; the SAME wrapper must now call the new fetch (late binding).
    const callsB = []
    globalThis.fetch = (u, i) => { callsB.push({ u, i }); return Promise.resolve('resB') }
    const r2 = await wrapper('u2', { m: 2 })
    assert.equal(r2, 'resB')
    assert.deepEqual(callsA, ['A'], 'original fetch must not be called again after swap')
    assert.deepEqual(callsB, [{ u: 'u2', i: { m: 2 } }], 'wrapper must forward args to the current global fetch')
  } finally {
    globalThis.fetch = saved
  }
})

test('resolveFetch: undefined + globalThis.fetch absent → ProviderError kind config', () => {
  const saved = globalThis.fetch
  try {
    delete globalThis.fetch
    let threw = false
    try {
      resolveFetch(undefined)
    } catch (err) {
      threw = true
      assertProviderError(err, { kind: K.CONFIG })
    }
    assert.ok(threw, 'expected resolveFetch to throw when global fetch is absent')
  } finally {
    globalThis.fetch = saved
  }
})

test('resolveFetch: non-function injected (object) falls through to global check → config when absent', () => {
  const saved = globalThis.fetch
  try {
    delete globalThis.fetch
    let threw = false
    try {
      resolveFetch({})
    } catch (err) {
      threw = true
      assertProviderError(err, { kind: K.CONFIG })
    }
    assert.ok(threw, 'expected non-function injected + no global fetch to throw config')
  } finally {
    globalThis.fetch = saved
  }
})

// ==================================================================
// requestProviderJson — happy path & request wiring
// ==================================================================

test('requestProviderJson: ok + JSON object → returns that object', async () => {
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{"a":1,"b":{"c":2}}' })),
  })
  const out = await requestProviderJson(args)
  assert.deepEqual(out, { a: 1, b: { c: 2 } })
})

test('requestProviderJson: sends method, headers, JSON.stringify(body); defaults method POST', async () => {
  const calls = []
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{"ok":true}' }), calls),
    headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
    body: { q: 'hi', n: 3, nested: { z: [1, 2] } },
  })
  await requestProviderJson(args)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://example.test/v1')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(calls[0].init.headers, { authorization: 'Bearer x', 'content-type': 'application/json' })
  assert.equal(calls[0].init.body, JSON.stringify({ q: 'hi', n: 3, nested: { z: [1, 2] } }))
})

test('requestProviderJson: explicit method is forwarded', async () => {
  const calls = []
  const args = baseArgs({
    method: 'PUT',
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{"ok":1}' }), calls),
  })
  await requestProviderJson(args)
  assert.equal(calls[0].init.method, 'PUT')
})

test('requestProviderJson: URL instance is accepted and forwarded', async () => {
  const calls = []
  const u = new URL('https://example.test/path?x=1')
  const args = baseArgs({
    url: u,
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{"ok":1}' }), calls),
  })
  const out = await requestProviderJson(args)
  assert.deepEqual(out, { ok: 1 })
  assert.equal(calls[0].url, u)
})

// ==================================================================
// requestProviderJson — fetch rejection
// ==================================================================

test('requestProviderJson: fetch rejects → ProviderError request, provider set, cause preserved', async () => {
  const original = new Error('network down')
  const args = baseArgs({
    fetch: () => Promise.reject(original),
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.cause, original, 'cause must be the original rejection error')
})

// ==================================================================
// requestProviderJson — non-ok handling
// ==================================================================

test('requestProviderJson: !ok + JSON body → message === extractErrorMessage(data, status)', async () => {
  let seen
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: false, status: 429, text: '{"error":{"message":"rate limited"}}' })),
    extractErrorMessage: (data, status) => {
      seen = { data, status }
      return `custom: ${data.error.message} (${status})`
    },
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.message, 'custom: rate limited (429)')
  assert.deepEqual(seen, { data: { error: { message: 'rate limited' } }, status: 429 })
})

test('requestProviderJson: !ok + non-JSON body → deterministic fallback with provider name and status', async () => {
  let called = false
  const args = baseArgs({
    provider: 'groq',
    fetch: fetchReturning(fakeRes({ ok: false, status: 500, text: '<html>Internal Server Error</html>' })),
    extractErrorMessage: () => { called = true; return 'should not be used' },
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'groq' })
  assert.equal(called, false, 'extractErrorMessage must not run when body is not JSON')
  assert.match(err.message, /groq/)
  assert.match(err.message, /500/)
})

test('requestProviderJson: !ok + extractErrorMessage throws → deterministic fallback, no crash', async () => {
  const args = baseArgs({
    provider: 'ollama',
    fetch: fetchReturning(fakeRes({ ok: false, status: 400, text: '{"bad":true}' })),
    extractErrorMessage: () => { throw new Error('boom in extractor') },
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'ollama' })
  assert.match(err.message, /ollama/)
  assert.match(err.message, /400/)
})

test('requestProviderJson: !ok + extractErrorMessage returns empty string → deterministic fallback', async () => {
  const args = baseArgs({
    provider: 'gemini',
    fetch: fetchReturning(fakeRes({ ok: false, status: 403, text: '{"x":1}' })),
    extractErrorMessage: () => '',
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.match(err.message, /gemini/)
  assert.match(err.message, /403/)
})

test('requestProviderJson: !ok + extractErrorMessage returns non-string (number) → deterministic fallback', async () => {
  const args = baseArgs({
    provider: 'gemini',
    fetch: fetchReturning(fakeRes({ ok: false, status: 418, text: '{"x":1}' })),
    extractErrorMessage: () => 12345,
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST })
  assert.match(err.message, /418/)
  assert.ok(!/12345/.test(err.message), 'must not use the non-string extractor return')
})

test('requestProviderJson: !ok + extractErrorMessage returns null → deterministic fallback', async () => {
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: false, status: 401, text: '{"x":1}' })),
    extractErrorMessage: () => null,
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST })
  assert.match(err.message, /401/)
})

test('requestProviderJson: !ok + text() rejects → ProviderError request with cause', async () => {
  const cause = new Error('body read failure')
  const args = baseArgs({
    fetch: fetchReturning(fakeResTextRejects({ ok: false, status: 502, cause })),
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.cause, cause)
  assert.match(err.message, /502/)
})

test('requestProviderJson: never returns on non-ok (JSON valid object body still throws)', async () => {
  // A non-ok response with a valid JSON object body must still throw, never return.
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: false, status: 400, text: '{"looks":"fine"}' })),
    extractErrorMessage: (d, s) => `msg ${s}`,
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw, 'must throw on non-ok even with a valid JSON object body')
  assertProviderError(err, { kind: K.REQUEST })
})

// ==================================================================
// requestProviderJson — ok body parsing
// ==================================================================

test('requestProviderJson: ok + malformed JSON → ProviderError request, cause preserved', async () => {
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{not valid json' })),
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.ok(err.cause instanceof Error, 'cause should be the JSON.parse SyntaxError')
})

test('requestProviderJson: ok + text() rejects → ProviderError request with cause', async () => {
  const cause = new Error('stream aborted')
  const args = baseArgs({
    fetch: fetchReturning(fakeResTextRejects({ ok: true, status: 200, cause })),
  })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  assert.equal(err.cause, cause)
})

for (const [label, text] of [
  ['null', 'null'],
  ['number', '42'],
  ['string', '"hello"'],
  ['array', '[1,2,3]'],
  ['boolean', 'true'],
]) {
  test(`requestProviderJson: ok + JSON root ${label} → ProviderError request`, async () => {
    const args = baseArgs({
      fetch: fetchReturning(fakeRes({ ok: true, status: 200, text })),
    })
    const { threw, err } = await captureThrow(requestProviderJson(args))
    assert.ok(threw, `root ${label} must throw`)
    assertProviderError(err, { kind: K.REQUEST, provider: 'gemini' })
  })
}

test('requestProviderJson: ok + empty object {} → returns {}', async () => {
  const args = baseArgs({
    fetch: fetchReturning(fakeRes({ ok: true, status: 200, text: '{}' })),
  })
  const out = await requestProviderJson(args)
  assert.deepEqual(out, {})
})

// ==================================================================
// requestProviderJson — invalid params (arg validation)
// ==================================================================

test('requestProviderJson: args not an object (undefined) → invalid-params', async () => {
  const { threw, err } = await captureThrow(requestProviderJson(undefined))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS })
})

test('requestProviderJson: args null → invalid-params', async () => {
  const { threw, err } = await captureThrow(requestProviderJson(null))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS })
})

test('requestProviderJson: missing provider → invalid-params', async () => {
  const args = baseArgs({ provider: undefined })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS })
})

test('requestProviderJson: empty provider string → invalid-params', async () => {
  const args = baseArgs({ provider: '' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS })
})

test('requestProviderJson: fetch not a function → invalid-params, provider set', async () => {
  const args = baseArgs({ fetch: 'not-a-fn' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: url missing (undefined) → invalid-params', async () => {
  const args = baseArgs({ url: undefined })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: url empty string → invalid-params', async () => {
  const args = baseArgs({ url: '' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: url wrong type (number) → invalid-params', async () => {
  const args = baseArgs({ url: 123 })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: method non-string (number) → invalid-params', async () => {
  const args = baseArgs({ method: 123 })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: method empty string → invalid-params', async () => {
  const args = baseArgs({ method: '' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: headers not an object (string) → invalid-params', async () => {
  const args = baseArgs({ headers: 'nope' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: headers is array → invalid-params', async () => {
  const args = baseArgs({ headers: [] })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: headers null → invalid-params', async () => {
  const args = baseArgs({ headers: null })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: body not an object (string) → invalid-params', async () => {
  const args = baseArgs({ body: 'nope' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: body is array → invalid-params', async () => {
  const args = baseArgs({ body: [1, 2] })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: extractErrorMessage not a function → invalid-params', async () => {
  const args = baseArgs({ extractErrorMessage: 'nope' })
  const { threw, err } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assertProviderError(err, { kind: K.INVALID_PARAMS, provider: 'gemini' })
})

test('requestProviderJson: invalid params → fetch is never invoked', async () => {
  let called = false
  const args = baseArgs({
    url: '',
    fetch: () => { called = true; return Promise.resolve(fakeRes({ ok: true, status: 200, text: '{}' })) },
  })
  const { threw } = await captureThrow(requestProviderJson(args))
  assert.ok(threw)
  assert.equal(called, false, 'fetch must not be called when args are invalid')
})
