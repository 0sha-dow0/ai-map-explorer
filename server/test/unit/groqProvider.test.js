import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGroqProvider } from '../../src/services/ai/groqProvider.js'
import { ProviderError } from '../../src/services/ai/providerContract.js'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const KEY = 'gsk_super_secret_key_1234567890'

// Build a fake fetch that records calls and returns a canned response.
function makeFetch({ ok = true, status = 200, payload = undefined, textOverride = undefined } = {}) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    const text = textOverride !== undefined ? textOverride : JSON.stringify(payload)
    return { ok, status, text: async () => text }
  }
  fn.calls = calls
  return fn
}

function contentPayload(content) {
  return { choices: [{ message: { content } }] }
}

function baseParams(overrides = {}) {
  return {
    systemPrompt: 'sys prompt',
    userPrompt: 'usr prompt',
    maxOutputTokens: 512,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory deps validation
// ---------------------------------------------------------------------------

test('factory: null deps -> invalid-params provider groq, zero fetch calls', () => {
  assert.throws(
    () => createGroqProvider(null),
    (err) => {
      assert.ok(err instanceof ProviderError)
      assert.equal(err.kind, 'invalid-params')
      assert.equal(err.provider, 'groq')
      return true
    },
  )
})

test('factory: undefined deps -> invalid-params', () => {
  assert.throws(() => createGroqProvider(undefined), (err) => err instanceof ProviderError && err.kind === 'invalid-params' && err.provider === 'groq')
})

test('factory: array deps rejected (not plain object)', () => {
  assert.throws(() => createGroqProvider([]), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
})

test('factory: env not an object -> invalid-params', () => {
  const fetch = makeFetch()
  assert.throws(() => createGroqProvider({ env: 'nope', fetch }), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
  assert.throws(() => createGroqProvider({ env: null, fetch }), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
  assert.throws(() => createGroqProvider({ env: [], fetch }), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
})

test('factory: fetch not a function -> invalid-params', () => {
  assert.throws(() => createGroqProvider({ env: {}, fetch: 'nope' }), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
  assert.throws(() => createGroqProvider({ env: {}, fetch: undefined }), (err) => err.kind === 'invalid-params' && err.provider === 'groq')
})

test('factory: valid deps returns object with generateJson function', () => {
  const provider = createGroqProvider({ env: {}, fetch: makeFetch() })
  assert.equal(typeof provider.generateJson, 'function')
})

// ---------------------------------------------------------------------------
// API key config validation (zero fetch calls, no leak)
// ---------------------------------------------------------------------------

for (const [label, keyValue] of [
  ['missing', undefined],
  ['empty string', ''],
  ['whitespace only', '   \t\n'],
]) {
  test(`config: ${label} GROQ_API_KEY -> config error provider groq, zero fetch calls`, async () => {
    const fetch = makeFetch()
    const env = keyValue === undefined ? {} : { GROQ_API_KEY: keyValue }
    const provider = createGroqProvider({ env, fetch })
    await assert.rejects(
      () => provider.generateJson(baseParams()),
      (err) => {
        assert.ok(err instanceof ProviderError)
        assert.equal(err.kind, 'config')
        assert.equal(err.provider, 'groq')
        assert.match(err.message, /GROQ_API_KEY/)
        if (keyValue) assert.ok(!err.message.includes(keyValue))
        return true
      },
    )
    assert.equal(fetch.calls.length, 0)
  })
}

test('config: GROQ_API_KEY as non-string number -> config error, zero fetch calls', async () => {
  const fetch = makeFetch()
  const provider = createGroqProvider({ env: { GROQ_API_KEY: 12345 }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err instanceof ProviderError && err.kind === 'config' && err.provider === 'groq',
  )
  assert.equal(fetch.calls.length, 0)
})

// ---------------------------------------------------------------------------
// Invalid params (zero fetch calls) — key present so config passes only after params
// ---------------------------------------------------------------------------

test('params validated BEFORE api key resolution -> invalid-params even with missing key, zero fetch', async () => {
  const fetch = makeFetch()
  const provider = createGroqProvider({ env: {}, fetch })
  await assert.rejects(
    () => provider.generateJson({ systemPrompt: '', userPrompt: 'u', maxOutputTokens: 10 }),
    (err) => err instanceof ProviderError && err.kind === 'invalid-params',
  )
  assert.equal(fetch.calls.length, 0)
})

for (const [label, params] of [
  ['non-object params', 42],
  ['empty systemPrompt', baseParams({ systemPrompt: '   ' })],
  ['empty userPrompt', baseParams({ userPrompt: '' })],
  ['maxOutputTokens 0 (below min)', baseParams({ maxOutputTokens: 0 })],
  ['maxOutputTokens 8193 (above limit)', baseParams({ maxOutputTokens: 8193 })],
  ['maxOutputTokens non-integer', baseParams({ maxOutputTokens: 1.5 })],
  ['temperature below 0', baseParams({ temperature: -0.1 })],
  ['temperature above 2', baseParams({ temperature: 2.1 })],
  ['temperature NaN', baseParams({ temperature: NaN })],
]) {
  test(`params: ${label} -> invalid-params, zero fetch calls`, async () => {
    const fetch = makeFetch()
    const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
    await assert.rejects(
      () => provider.generateJson(params),
      (err) => err instanceof ProviderError && err.kind === 'invalid-params',
    )
    assert.equal(fetch.calls.length, 0)
  })
}

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

test('request shape: url, method, headers, body, exact keys', async () => {
  const fetch = makeFetch({ payload: contentPayload('  {"a":1}  ') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  const out = await provider.generateJson(baseParams({ temperature: 0.3 }))

  assert.equal(out, '{"a":1}')
  assert.equal(fetch.calls.length, 1)
  const { url, init } = fetch.calls[0]
  assert.equal(url, ENDPOINT)
  assert.equal(init.method, 'POST')
  assert.deepEqual(init.headers, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${KEY}`,
  })

  const body = JSON.parse(init.body)
  assert.deepEqual(Object.keys(body).sort(), ['max_tokens', 'messages', 'model', 'response_format', 'temperature'].sort())
  assert.equal(body.model, DEFAULT_MODEL)
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'sys prompt' },
    { role: 'user', content: 'usr prompt' },
  ])
  assert.equal(body.temperature, 0.3)
  assert.equal(body.max_tokens, 512)
  assert.deepEqual(body.response_format, { type: 'json_object' })
  // No stray token field.
  assert.ok(!('maxOutputTokens' in body))
  assert.ok(!('maxTokens' in body))
  assert.ok(!('max_output_tokens' in body))
})

test('request shape: body is a JSON string (not object)', async () => {
  const fetch = makeFetch({ payload: contentPayload('x') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await provider.generateJson(baseParams())
  assert.equal(typeof fetch.calls[0].init.body, 'string')
})

test('request shape: temperature defaults to 0.7 when omitted', async () => {
  const fetch = makeFetch({ payload: contentPayload('x') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await provider.generateJson(baseParams())
  const body = JSON.parse(fetch.calls[0].init.body)
  assert.equal(body.temperature, 0.7)
})

test('request shape: temperature boundary 0 preserved (not defaulted)', async () => {
  const fetch = makeFetch({ payload: contentPayload('x') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await provider.generateJson(baseParams({ temperature: 0 }))
  const body = JSON.parse(fetch.calls[0].init.body)
  assert.equal(body.temperature, 0)
})

test('request shape: maxOutputTokens boundaries 1 and 8192 map to max_tokens', async () => {
  for (const t of [1, 8192]) {
    const fetch = makeFetch({ payload: contentPayload('x') })
    const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
    await provider.generateJson(baseParams({ maxOutputTokens: t }))
    const body = JSON.parse(fetch.calls[0].init.body)
    assert.equal(body.max_tokens, t)
  }
})

test('request shape: trimmed api key used in Authorization', async () => {
  const fetch = makeFetch({ payload: contentPayload('x') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: `   ${KEY}   ` }, fetch })
  await provider.generateJson(baseParams())
  assert.equal(fetch.calls[0].init.headers.Authorization, `Bearer ${KEY}`)
})

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

test('model: GROQ_MODEL honored and trimmed', async () => {
  const fetch = makeFetch({ payload: contentPayload('x') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY, GROQ_MODEL: '  custom-model  ' }, fetch })
  await provider.generateJson(baseParams())
  const body = JSON.parse(fetch.calls[0].init.body)
  assert.equal(body.model, 'custom-model')
})

for (const [label, modelVal] of [
  ['unset', undefined],
  ['empty', ''],
  ['whitespace', '   '],
]) {
  test(`model: ${label} GROQ_MODEL -> default`, async () => {
    const fetch = makeFetch({ payload: contentPayload('x') })
    const env = { GROQ_API_KEY: KEY }
    if (modelVal !== undefined) env.GROQ_MODEL = modelVal
    const provider = createGroqProvider({ env, fetch })
    await provider.generateJson(baseParams())
    const body = JSON.parse(fetch.calls[0].init.body)
    assert.equal(body.model, DEFAULT_MODEL)
  })
}

// ---------------------------------------------------------------------------
// Response extraction success
// ---------------------------------------------------------------------------

test('response: content trimmed and returned', async () => {
  const fetch = makeFetch({ payload: contentPayload('\n\t  hello world  \n') })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  const out = await provider.generateJson(baseParams())
  assert.equal(out, 'hello world')
})

test('response: only first choice used', async () => {
  const payload = { choices: [{ message: { content: 'first' } }, { message: { content: 'second' } }] }
  const fetch = makeFetch({ payload })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  assert.equal(await provider.generateJson(baseParams()), 'first')
})

// ---------------------------------------------------------------------------
// Response extraction -> empty errors
// ---------------------------------------------------------------------------

for (const [label, payload] of [
  ['empty choices array', { choices: [] }],
  ['choices not array', { choices: 'nope' }],
  ['choices missing', {}],
  ['first choice not object', { choices: ['x'] }],
  ['first choice null', { choices: [null] }],
  ['missing message', { choices: [{}] }],
  ['message not object', { choices: [{ message: 'hi' }] }],
  ['content non-string (number)', { choices: [{ message: { content: 42 } }] }],
  ['content null', { choices: [{ message: { content: null } }] }],
  ['content missing', { choices: [{ message: {} }] }],
  ['content empty string', { choices: [{ message: { content: '' } }] }],
  ['content whitespace only', { choices: [{ message: { content: '   \n\t' } }] }],
]) {
  test(`response empty: ${label} -> empty error provider groq`, async () => {
    const fetch = makeFetch({ payload })
    const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
    await assert.rejects(
      () => provider.generateJson(baseParams()),
      (err) => {
        assert.ok(err instanceof ProviderError)
        assert.equal(err.kind, 'empty')
        assert.equal(err.provider, 'groq')
        assert.ok(!err.message.includes(KEY))
        return true
      },
    )
  })
}

// ---------------------------------------------------------------------------
// Non-ok responses -> request errors
// ---------------------------------------------------------------------------

test('non-ok 401 with error.message -> request error carries message', async () => {
  const fetch = makeFetch({ ok: false, status: 401, payload: { error: { message: 'Invalid API Key' } } })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => {
      assert.ok(err instanceof ProviderError)
      assert.equal(err.kind, 'request')
      assert.equal(err.provider, 'groq')
      assert.equal(err.message, 'Invalid API Key')
      return true
    },
  )
})

test('non-ok 429 with error.message -> request error carries message', async () => {
  const fetch = makeFetch({ ok: false, status: 429, payload: { error: { message: 'Rate limited' } } })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err.kind === 'request' && err.message === 'Rate limited',
  )
})

test('non-ok 500 without message -> fallback contains status', async () => {
  const fetch = makeFetch({ ok: false, status: 500, payload: { error: {} } })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => {
      assert.equal(err.kind, 'request')
      assert.match(err.message, /500/)
      assert.ok(!err.message.includes(KEY))
      return true
    },
  )
})

test('non-ok with empty error.message string -> fallback contains status', async () => {
  const fetch = makeFetch({ ok: false, status: 503, payload: { error: { message: '   ' } } })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err.kind === 'request' && /503/.test(err.message),
  )
})

test('non-ok with non-JSON body -> request error with status', async () => {
  const fetch = makeFetch({ ok: false, status: 502, textOverride: 'Bad Gateway <html>' })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err.kind === 'request' && /502/.test(err.message),
  )
})

// ---------------------------------------------------------------------------
// Transport failure
// ---------------------------------------------------------------------------

test('fetch rejects -> request error with cause preserved, no key leak', async () => {
  const cause = new Error('ECONNRESET network down')
  const fetch = async () => { throw cause }
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => {
      assert.ok(err instanceof ProviderError)
      assert.equal(err.kind, 'request')
      assert.equal(err.provider, 'groq')
      assert.equal(err.cause, cause)
      assert.ok(!err.message.includes(KEY))
      return true
    },
  )
})

test('ok response with invalid JSON body -> request error', async () => {
  const fetch = makeFetch({ ok: true, status: 200, textOverride: 'not json {{{' })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err instanceof ProviderError && err.kind === 'request',
  )
})

test('ok response with non-object JSON root -> request error', async () => {
  const fetch = makeFetch({ ok: true, status: 200, textOverride: '[1,2,3]' })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err instanceof ProviderError && err.kind === 'request',
  )
})

// ---------------------------------------------------------------------------
// Key never leaks across all error paths (aggregate guard)
// ---------------------------------------------------------------------------

test('api key never appears in message for non-ok that echoes key-like data', async () => {
  // Even if the provider error body contains the key, extractErrorMessage only pulls error.message.
  const fetch = makeFetch({ ok: false, status: 400, payload: { error: { message: 'bad request' }, key: KEY } })
  const provider = createGroqProvider({ env: { GROQ_API_KEY: KEY }, fetch })
  await assert.rejects(
    () => provider.generateJson(baseParams()),
    (err) => err.message === 'bad request' && !err.message.includes(KEY),
  )
})
