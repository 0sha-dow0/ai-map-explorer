import { test, describe, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'

import { generateJson, assertProviderConfigured } from '../../src/services/ai/index.js'
import { assertProviderConfigured as assertFromSelector } from '../../src/services/ai/providerSelector.js'

// Env keys this facade (and its providers) reads. We manage exactly these.
const MANAGED_ENV_KEYS = [
  'AI_PROVIDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'OLLAMA_MODEL',
  'OLLAMA_BASE_URL',
]

// Pre-suite snapshot of the managed keys and the global fetch, so we can prove
// zero residue is left behind.
const PRE_SUITE_ENV = Object.fromEntries(MANAGED_ENV_KEYS.map((k) => [k, process.env[k]]))
const PRE_SUITE_FETCH = globalThis.fetch

/** Remove all managed keys so each test starts from a known-clean baseline. */
function clearManagedEnv() {
  for (const k of MANAGED_ENV_KEYS) {
    delete process.env[k]
  }
}

/** Restore managed keys to their pre-suite values (undefined => deleted). */
function restoreManagedEnv() {
  for (const k of MANAGED_ENV_KEYS) {
    if (PRE_SUITE_ENV[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = PRE_SUITE_ENV[k]
    }
  }
}

/**
 * Build a fetch stub that records every call and returns a canned response.
 * @param {string} bodyText - the text() payload the provider will parse
 * @param {{ ok?: boolean, status?: number }} [opts]
 */
function makeFetchStub(bodyText, opts = {}) {
  const calls = []
  const stub = async (url, init) => {
    calls.push({ url: String(url), init })
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      text: async () => bodyText,
    }
  }
  stub.calls = calls
  return stub
}

const GEMINI_BODY = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })
const GROQ_BODY = JSON.stringify({ choices: [{ message: { content: 'x' } }] })
const OLLAMA_BODY = JSON.stringify({ message: { content: 'y' } })

const VALID_PARAMS = { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 10 }

describe('ai facade (server/src/services/ai/index.js)', () => {
  beforeEach(() => {
    clearManagedEnv()
  })

  afterEach(() => {
    // Restore fetch and env after every test => zero residue.
    globalThis.fetch = PRE_SUITE_FETCH
    restoreManagedEnv()
  })

  after(() => {
    // Prove nothing leaked past the suite.
    for (const k of MANAGED_ENV_KEYS) {
      assert.equal(
        process.env[k],
        PRE_SUITE_ENV[k],
        `env residue detected for ${k}: expected ${String(PRE_SUITE_ENV[k])}, got ${String(process.env[k])}`,
      )
    }
    assert.equal(globalThis.fetch, PRE_SUITE_FETCH, 'globalThis.fetch was not restored')
  })

  // ---- 1. Default provider (gemini) ----
  test('defaults to gemini when AI_PROVIDER unset; returns text and hits gemini host', async () => {
    process.env.GEMINI_API_KEY = 'k'
    // AI_PROVIDER already deleted by beforeEach
    const stub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = stub

    const result = await generateJson({ ...VALID_PARAMS })

    assert.equal(result, '{"a":1}')
    assert.equal(stub.calls.length, 1)
    assert.match(stub.calls[0].url, /generativelanguage\.googleapis\.com/)
  })

  // ---- 2 & 7. Live rerouting in one process, no memoization ----
  test('reroutes groq -> ollama within one process using the same imported function', async () => {
    // groq leg
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_API_KEY = 'gk'
    const groqStub = makeFetchStub(GROQ_BODY)
    globalThis.fetch = groqStub

    const groqResult = await generateJson({ ...VALID_PARAMS })
    assert.equal(groqResult, 'x')
    assert.equal(groqStub.calls.length, 1)
    assert.match(groqStub.calls[0].url, /api\.groq\.com/)
    assert.equal(
      groqStub.calls[0].init.headers.Authorization,
      'Bearer gk',
      'groq call must carry the Bearer auth header',
    )

    // ollama leg — no restart, same imported generateJson
    process.env.AI_PROVIDER = 'ollama'
    delete process.env.GROQ_API_KEY
    process.env.OLLAMA_MODEL = 'm'
    const ollamaStub = makeFetchStub(OLLAMA_BODY)
    globalThis.fetch = ollamaStub

    const ollamaResult = await generateJson({ ...VALID_PARAMS })
    assert.equal(ollamaResult, 'y')
    assert.equal(ollamaStub.calls.length, 1)
    assert.match(ollamaStub.calls[0].url, /localhost:11434\/api\/chat/)

    // Explicit no-memoization proof: the two captured hosts differ.
    assert.notEqual(groqStub.calls[0].url, ollamaStub.calls[0].url)
    assert.match(groqStub.calls[0].url, /api\.groq\.com/)
    assert.match(ollamaStub.calls[0].url, /localhost:11434/)
  })

  // ---- 3. Late binding of globalThis.fetch (replaced AFTER import) ----
  test('uses a globalThis.fetch replacement installed after module import', async () => {
    process.env.GEMINI_API_KEY = 'k'
    // Install a fresh, unique stub now (well after the top-of-file import).
    const lateStub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = lateStub

    const result = await generateJson({ ...VALID_PARAMS })

    assert.equal(result, '{"a":1}')
    assert.equal(lateStub.calls.length, 1, 'the late-bound replacement must be the fetch actually used')
  })

  // ---- 4. Misconfiguration surfaces ----
  test('groq with missing GROQ_API_KEY rejects config error and never calls fetch', async () => {
    process.env.AI_PROVIDER = 'groq'
    // GROQ_API_KEY deliberately absent
    const stub = makeFetchStub(GROQ_BODY)
    globalThis.fetch = stub

    await assert.rejects(
      () => generateJson({ ...VALID_PARAMS }),
      (err) => {
        assert.equal(err.name, 'ProviderError')
        assert.equal(err.kind, 'config')
        return true
      },
    )
    assert.equal(stub.calls.length, 0, 'fetch must not be called on config failure')
  })

  test('unknown AI_PROVIDER rejects config error listing valid names and never calls fetch', async () => {
    process.env.AI_PROVIDER = 'nonsense'
    const stub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = stub

    // Contract: generateJson(params) -> Promise<string>. A misconfiguration must
    // surface as a REJECTED promise (per acceptance criterion "rejects kind 'config'"),
    // never as a synchronous throw. Capture whichever the unit actually does.
    let returned
    let syncThrow
    try {
      returned = generateJson({ ...VALID_PARAMS })
    } catch (err) {
      syncThrow = err
    }

    assert.equal(
      syncThrow,
      undefined,
      `CONTRACT VIOLATION: generateJson must return a Promise<string> and reject on ` +
        `config errors, but it threw synchronously ` +
        `(name=${syncThrow && syncThrow.name}, kind=${syncThrow && syncThrow.kind}). ` +
        `Expected: a rejected Promise. Actual: synchronous throw / no promise returned.`,
    )
    assert.ok(
      returned && typeof returned.then === 'function',
      'generateJson must return a thenable Promise',
    )

    await assert.rejects(
      () => returned,
      (err) => {
        assert.equal(err.name, 'ProviderError')
        assert.equal(err.kind, 'config')
        assert.match(err.message, /gemini/)
        assert.match(err.message, /groq/)
        assert.match(err.message, /ollama/)
        return true
      },
    )
    assert.equal(stub.calls.length, 0, 'fetch must not be called on config failure')
  })

  // ---- 5. Invalid params ----
  test('invalid params reject invalid-params and never call fetch', async () => {
    process.env.GEMINI_API_KEY = 'k'
    const stub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = stub

    // Missing/blank systemPrompt is invalid.
    await assert.rejects(
      () => generateJson({ systemPrompt: '', userPrompt: 'u', maxOutputTokens: 10 }),
      (err) => {
        assert.equal(err.name, 'ProviderError')
        assert.equal(err.kind, 'invalid-params')
        return true
      },
    )
    assert.equal(stub.calls.length, 0, 'fetch must not be called on invalid params')
  })

  test('out-of-range maxOutputTokens rejects invalid-params and never calls fetch', async () => {
    process.env.GEMINI_API_KEY = 'k'
    const stub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = stub

    await assert.rejects(
      () => generateJson({ systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 999999 }),
      (err) => {
        assert.equal(err.kind, 'invalid-params')
        return true
      },
    )
    assert.equal(stub.calls.length, 0)
  })

  test('non-object params reject invalid-params before touching env or fetch', async () => {
    const stub = makeFetchStub(GEMINI_BODY)
    globalThis.fetch = stub

    await assert.rejects(
      () => generateJson(null),
      (err) => {
        assert.equal(err.kind, 'invalid-params')
        return true
      },
    )
    assert.equal(stub.calls.length, 0)
  })

  // ---- 6. assertProviderConfigured re-export: identity + behavior ----
  test('assertProviderConfigured re-export is the same function reference', () => {
    assert.equal(
      assertProviderConfigured,
      assertFromSelector,
      'facade must re-export the exact providerSelector.assertProviderConfigured reference',
    )
  })

  test('assertProviderConfigured passes for a fully-configured ollama env', () => {
    assert.doesNotThrow(() =>
      assertProviderConfigured({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'm' }),
    )
  })

  test('assertProviderConfigured throws naming OLLAMA_MODEL when it is missing', () => {
    assert.throws(
      () => assertProviderConfigured({ AI_PROVIDER: 'ollama' }),
      (err) => {
        assert.equal(err.name, 'ProviderError')
        assert.equal(err.kind, 'config')
        assert.equal(err.provider, 'ollama')
        assert.match(err.message, /OLLAMA_MODEL/)
        return true
      },
    )
  })
})
