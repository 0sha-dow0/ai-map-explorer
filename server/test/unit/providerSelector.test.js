import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveProviderName,
  createAiProvider,
  assertProviderConfigured,
} from '../../src/services/ai/providerSelector.js'
import { PROVIDER_ERROR_KINDS } from '../../src/services/ai/providerContract.js'

const VALID_NAMES = ['gemini', 'groq', 'ollama']
const GEN_PARAMS = { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 10 }

/**
 * Build a fetch mock that records the last call and returns a minimal
 * valid provider response for the given provider.
 */
function makeCapturingFetch(kind) {
  const calls = []
  const bodies = {
    groq: { choices: [{ message: { content: '{"ok":true}' } }] },
    ollama: { message: { content: '{"ok":true}' } },
    gemini: { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] },
  }
  const fetch = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(bodies[kind]),
    }
  }
  fetch.calls = calls
  return fetch
}

/**
 * Run fn, assert it threw, and return the thrown error.
 * (node:assert `assert.throws` does not return the error.)
 */
function captureThrow(fn, a, b) {
  const note = b !== undefined ? b : a
  let thrown
  let threw = false
  try {
    fn()
  } catch (e) {
    threw = true
    thrown = e
  }
  assert.ok(threw, `expected function to throw${note ? ` (${note})` : ''}`)
  return thrown
}

function assertProviderError(err, expectedKind) {
  assert.ok(err instanceof Error, `expected an Error, got ${String(err)}`)
  assert.equal(err.name, 'ProviderError', `expected name ProviderError, got ${err.name}`)
  assert.equal(err.kind, expectedKind, `expected kind ${expectedKind}, got ${err.kind}`)
}

// --------------------------------------------------------------------------
// resolveProviderName - exact matches
// --------------------------------------------------------------------------

test('resolveProviderName: exact lowercase names', () => {
  assert.equal(resolveProviderName({ AI_PROVIDER: 'gemini' }), 'gemini')
  assert.equal(resolveProviderName({ AI_PROVIDER: 'groq' }), 'groq')
  assert.equal(resolveProviderName({ AI_PROVIDER: 'ollama' }), 'ollama')
})

test('resolveProviderName: mixed case is normalized', () => {
  assert.equal(resolveProviderName({ AI_PROVIDER: 'GROQ' }), 'groq')
  assert.equal(resolveProviderName({ AI_PROVIDER: 'Ollama' }), 'ollama')
  assert.equal(resolveProviderName({ AI_PROVIDER: 'GEMINI' }), 'gemini')
})

test('resolveProviderName: surrounding whitespace is trimmed', () => {
  assert.equal(resolveProviderName({ AI_PROVIDER: '  gemini  ' }), 'gemini')
  assert.equal(resolveProviderName({ AI_PROVIDER: '\tgroq\n' }), 'groq')
})

test('resolveProviderName: unset AI_PROVIDER defaults to gemini', () => {
  assert.equal(resolveProviderName({}), 'gemini')
})

// --------------------------------------------------------------------------
// resolveProviderName - config errors
// --------------------------------------------------------------------------

test('resolveProviderName: unknown value throws config error naming all three providers', () => {
  const err = captureThrow(() => resolveProviderName({ AI_PROVIDER: 'openai' }))
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  for (const name of VALID_NAMES) {
    assert.ok(err.message.includes(name), `message should contain "${name}": ${err.message}`)
  }
})

test('resolveProviderName: empty string throws config error naming all three providers', () => {
  const err = captureThrow(() => resolveProviderName({ AI_PROVIDER: '' }))
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  for (const name of VALID_NAMES) {
    assert.ok(err.message.includes(name), `message should contain "${name}": ${err.message}`)
  }
})

test('resolveProviderName: whitespace-only string throws config error naming all three providers', () => {
  const err = captureThrow(() => resolveProviderName({ AI_PROVIDER: '   ' }))
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  for (const name of VALID_NAMES) {
    assert.ok(err.message.includes(name), `message should contain "${name}": ${err.message}`)
  }
})

test('resolveProviderName: non-string AI_PROVIDER throws config error', () => {
  for (const bad of [42, true, false, { x: 1 }, ['gemini'], null]) {
    const err = captureThrow(
      () => resolveProviderName({ AI_PROVIDER: bad }),
      undefined,
      `expected throw for AI_PROVIDER=${JSON.stringify(bad)}`,
    )
    assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  }
})

test('resolveProviderName: non-object env throws invalid-params', () => {
  for (const bad of [null, undefined, 42, [], ['gemini'], 'gemini', true]) {
    const err = captureThrow(
      () => resolveProviderName(bad),
      undefined,
      `expected throw for env=${JSON.stringify(bad)}`,
    )
    assertProviderError(err, PROVIDER_ERROR_KINDS.INVALID_PARAMS)
  }
})

test('resolveProviderName: pure - same input twice yields same output', () => {
  const env = { AI_PROVIDER: '  GROQ  ' }
  assert.equal(resolveProviderName(env), resolveProviderName(env))
  assert.deepEqual(env, { AI_PROVIDER: '  GROQ  ' }, 'env must not be mutated')
})

// --------------------------------------------------------------------------
// createAiProvider - guard clauses
// --------------------------------------------------------------------------

test('createAiProvider: null/invalid deps throw invalid-params', () => {
  for (const bad of [null, undefined, 42, [], 'x', true]) {
    const err = captureThrow(
      () => createAiProvider(bad),
      undefined,
      `expected throw for deps=${JSON.stringify(bad)}`,
    )
    assertProviderError(err, PROVIDER_ERROR_KINDS.INVALID_PARAMS)
  }
})

test('createAiProvider: missing/invalid env throws invalid-params', () => {
  for (const badEnv of [undefined, null, 42, [], 'x']) {
    const err = captureThrow(
      () => createAiProvider({ env: badEnv, fetch: makeCapturingFetch('gemini') }),
      undefined,
      `expected throw for env=${JSON.stringify(badEnv)}`,
    )
    assertProviderError(err, PROVIDER_ERROR_KINDS.INVALID_PARAMS)
  }
})

test('createAiProvider: returns object with generateJson function for each provider', () => {
  const cases = [
    { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' },
    { AI_PROVIDER: 'groq', GROQ_API_KEY: 'k' },
    { AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'm' },
  ]
  for (const env of cases) {
    const provider = createAiProvider({ env, fetch: makeCapturingFetch('gemini') })
    assert.equal(typeof provider, 'object')
    assert.equal(typeof provider.generateJson, 'function', `generateJson missing for ${env.AI_PROVIDER}`)
  }
})

// --------------------------------------------------------------------------
// createAiProvider - end-to-end routing through generateJson
// --------------------------------------------------------------------------

function headerValue(headers, name) {
  if (!headers) return undefined
  // headers is a plain object in these providers
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key]
  }
  return undefined
}

test('createAiProvider: routes groq to api.groq.com with Authorization Bearer', async () => {
  const fetch = makeCapturingFetch('groq')
  const provider = createAiProvider({ env: { AI_PROVIDER: 'groq', GROQ_API_KEY: 'secret-key' }, fetch })
  const out = await provider.generateJson(GEN_PARAMS)
  assert.equal(out, '{"ok":true}')
  assert.equal(fetch.calls.length, 1)
  const { url, init } = fetch.calls[0]
  assert.ok(String(url).includes('api.groq.com'), `expected api.groq.com URL, got ${String(url)}`)
  const auth = headerValue(init.headers, 'Authorization')
  assert.equal(auth, 'Bearer secret-key', `expected Bearer auth, got ${auth}`)
})

test('createAiProvider: routes ollama to localhost:11434/api/chat with no Authorization', async () => {
  const fetch = makeCapturingFetch('ollama')
  const provider = createAiProvider({ env: { AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'llama3' }, fetch })
  const out = await provider.generateJson(GEN_PARAMS)
  assert.equal(out, '{"ok":true}')
  assert.equal(fetch.calls.length, 1)
  const { url, init } = fetch.calls[0]
  assert.ok(String(url).includes('localhost:11434/api/chat'), `expected localhost:11434/api/chat, got ${String(url)}`)
  assert.equal(headerValue(init.headers, 'Authorization'), undefined, 'ollama must not send Authorization')
})

test('createAiProvider: routes gemini to generativelanguage.googleapis.com', async () => {
  const fetch = makeCapturingFetch('gemini')
  const provider = createAiProvider({ env: { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }, fetch })
  const out = await provider.generateJson(GEN_PARAMS)
  assert.equal(out, '{"ok":true}')
  assert.equal(fetch.calls.length, 1)
  const { url } = fetch.calls[0]
  assert.ok(
    String(url).includes('generativelanguage.googleapis.com'),
    `expected generativelanguage.googleapis.com, got ${String(url)}`,
  )
})

test('createAiProvider: stateless - two calls with different envs do not cross-contaminate', async () => {
  const groqFetch = makeCapturingFetch('groq')
  const ollamaFetch = makeCapturingFetch('ollama')
  const groqProvider = createAiProvider({ env: { AI_PROVIDER: 'groq', GROQ_API_KEY: 'gk' }, fetch: groqFetch })
  const ollamaProvider = createAiProvider({ env: { AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'm' }, fetch: ollamaFetch })

  await groqProvider.generateJson(GEN_PARAMS)
  await ollamaProvider.generateJson(GEN_PARAMS)

  assert.ok(String(groqFetch.calls[0].url).includes('api.groq.com'))
  assert.ok(String(ollamaFetch.calls[0].url).includes('localhost:11434/api/chat'))
  // each fetch was called exactly once - no leakage
  assert.equal(groqFetch.calls.length, 1)
  assert.equal(ollamaFetch.calls.length, 1)
})

test('createAiProvider: LAZY key check - creation succeeds without GROQ_API_KEY, generateJson throws config', async () => {
  const fetch = makeCapturingFetch('groq')
  // Creation must NOT throw even though GROQ_API_KEY is absent.
  const provider = createAiProvider({ env: { AI_PROVIDER: 'groq' }, fetch })
  assert.equal(typeof provider.generateJson, 'function')

  const err = await provider.generateJson(GEN_PARAMS).then(
    () => null,
    (e) => e,
  )
  assert.ok(err, 'expected generateJson to reject')
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  // fetch must not have been called since key check fails first
  assert.equal(fetch.calls.length, 0, 'fetch should not be called when config is invalid')
})

// --------------------------------------------------------------------------
// assertProviderConfigured
// --------------------------------------------------------------------------

test('assertProviderConfigured: returns undefined when required var present', () => {
  assert.equal(assertProviderConfigured({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }), undefined)
  assert.equal(assertProviderConfigured({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'k' }), undefined)
  assert.equal(assertProviderConfigured({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'm' }), undefined)
})

test('assertProviderConfigured: ollama passes with only OLLAMA_MODEL and no API keys anywhere', () => {
  assert.equal(assertProviderConfigured({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'm' }), undefined)
})

test('assertProviderConfigured: default provider (gemini) checks GEMINI_API_KEY', () => {
  const err = captureThrow(() => assertProviderConfigured({}))
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  assert.ok(err.message.includes('GEMINI_API_KEY'), `message: ${err.message}`)
  assert.equal(err.provider, 'gemini')
})

test('assertProviderConfigured: absent/empty/whitespace required var throws config with exact var name and provider field', () => {
  const cases = [
    { provider: 'gemini', varName: 'GEMINI_API_KEY' },
    { provider: 'groq', varName: 'GROQ_API_KEY' },
    { provider: 'ollama', varName: 'OLLAMA_MODEL' },
  ]
  for (const { provider, varName } of cases) {
    for (const val of [undefined, '', '   ', '\t\n']) {
      const env = { AI_PROVIDER: provider }
      if (val !== undefined) env[varName] = val
      const err = captureThrow(
        () => assertProviderConfigured(env),
        undefined,
        `expected throw for ${provider} ${varName}=${JSON.stringify(val)}`,
      )
      assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
      assert.ok(err.message.includes(varName), `message should contain ${varName}: ${err.message}`)
      assert.equal(err.provider, provider, `provider field should be ${provider}`)
    }
  }
})

test('assertProviderConfigured: unknown AI_PROVIDER propagates the config enumeration error', () => {
  const err = captureThrow(() => assertProviderConfigured({ AI_PROVIDER: 'openai' }))
  assertProviderError(err, PROVIDER_ERROR_KINDS.CONFIG)
  for (const name of VALID_NAMES) {
    assert.ok(err.message.includes(name), `message should contain "${name}": ${err.message}`)
  }
})

// --------------------------------------------------------------------------
// Zero process.env dependence
// --------------------------------------------------------------------------

test('zero process.env dependence: garbage process.env.AI_PROVIDER does not affect resolveProviderName({})', () => {
  const saved = process.env.AI_PROVIDER
  try {
    process.env.AI_PROVIDER = 'totally-bogus-provider'
    assert.equal(resolveProviderName({}), 'gemini')
    assert.equal(resolveProviderName({ AI_PROVIDER: 'groq' }), 'groq')
  } finally {
    if (saved === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = saved
  }
})
