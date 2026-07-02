import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createGeminiProvider } from '../../src/services/ai/geminiProvider.js'
import { createGroqProvider } from '../../src/services/ai/groqProvider.js'
import { createOllamaProvider } from '../../src/services/ai/ollamaProvider.js'

// ---------------------------------------------------------------------------
// Shared cross-provider error contract battery.
//
// All three providers expose createXProvider({ env, fetch }) -> { generateJson }.
// Every failure must surface a ProviderError (name 'ProviderError') carrying:
//   - .provider in {'gemini','groq','ollama'}
//   - .kind    in {'config','request','empty','invalid-params'}
// Providers consume fetch responses via { ok, status, text: async () => string }.
// No secret value may ever appear in an error message.
// ---------------------------------------------------------------------------

const SECRET = 'sekret-key-value'

const KNOWN_KINDS = new Set(['config', 'request', 'empty', 'invalid-params'])

/** A canonical valid params object accepted by assertGenerateJsonParams. */
const VALID_PARAMS = Object.freeze({
  systemPrompt: 'system',
  userPrompt: 'user',
  maxOutputTokens: 128,
  temperature: 0.5,
})

/**
 * fetch spy that records every call. `impl` produces the resolved/rejected value.
 * @param {(...args: unknown[]) => unknown} impl
 */
function makeFetchSpy(impl) {
  /** @param {...unknown} args */
  const spy = async (...args) => {
    spy.calls.push(args)
    return impl(...args)
  }
  spy.calls = []
  return spy
}

/** A fetch spy that MUST NOT be invoked; throws loudly if it is. */
function neverFetch() {
  return makeFetchSpy(() => {
    throw new Error('fetch must not be called for this case')
  })
}

/**
 * Build a Response-like object matching what providers consume.
 * @param {{ ok: boolean, status: number, body: string }} opts
 */
function makeResponse({ ok, status, body }) {
  return {
    ok,
    status,
    text: async () => body,
  }
}

/**
 * Invoke `fn`, assert it rejects, return the thrown error.
 * @param {() => Promise<unknown>} fn
 */
async function captureRejection(fn) {
  try {
    const value = await fn()
    throw new assert.AssertionError({
      message: `expected rejection but resolved with ${JSON.stringify(value)}`,
    })
  } catch (err) {
    if (err instanceof assert.AssertionError) throw err
    return err
  }
}

/** Collected across every battery case for the final uniformity sweep. */
const battery = []

/**
 * Every rejection observed by the battery flows through here. Enforces the
 * shared invariants and records the error for the final aggregate assertion.
 * @param {unknown} err
 * @param {{ provider?: string, kind?: string }} [expected]
 */
function assertUniform(err, expected = {}) {
  assert.ok(err instanceof Error, 'error must be instanceof Error')
  assert.equal(err.name, 'ProviderError', 'error.name must be ProviderError')
  assert.ok(KNOWN_KINDS.has(err.kind), `unknown kind: ${String(err.kind)}`)
  assert.equal(typeof err.message, 'string')
  assert.ok(err.message.length > 0, 'message must be non-empty')
  assert.ok(!err.message.includes(SECRET), `message leaked secret: ${err.message}`)
  if (expected.provider !== undefined) {
    assert.equal(err.provider, expected.provider, 'provider mismatch')
  }
  if (expected.kind !== undefined) {
    assert.equal(err.kind, expected.kind, 'kind mismatch')
  }
  battery.push(err)
  return err
}

/**
 * @typedef {object} ProviderCase
 * @property {string} name
 * @property {(deps: object) => { generateJson: (p: object) => Promise<string> }} create
 * @property {string} requiredVar
 * @property {() => Record<string,string>} validEnv
 * @property {(content: string) => object} okShape
 */

/** @type {ProviderCase[]} */
const PROVIDERS = [
  {
    name: 'gemini',
    create: createGeminiProvider,
    requiredVar: 'GEMINI_API_KEY',
    validEnv: () => ({ GEMINI_API_KEY: SECRET }),
    okShape: (content) => ({ candidates: [{ content: { parts: [{ text: content }] } }] }),
  },
  {
    name: 'groq',
    create: createGroqProvider,
    requiredVar: 'GROQ_API_KEY',
    validEnv: () => ({ GROQ_API_KEY: SECRET }),
    okShape: (content) => ({ choices: [{ message: { content } }] }),
  },
  {
    name: 'ollama',
    create: createOllamaProvider,
    requiredVar: 'OLLAMA_MODEL',
    // OLLAMA_MODEL is not a secret, but keep the sentinel present so the
    // no-leak sweep is meaningful for this provider too.
    validEnv: () => ({ OLLAMA_MODEL: `model-${SECRET}` }),
    okShape: (content) => ({ message: { content } }),
  },
]

for (const p of PROVIDERS) {
  // -- Case 1: missing required config var ---------------------------------
  test(`[${p.name}] missing required config var rejects config error and does not fetch`, async () => {
    const fetch = neverFetch()
    const provider = p.create({ env: {}, fetch })
    const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
    assertUniform(err, { provider: p.name, kind: 'config' })
    assert.equal(fetch.calls.length, 0, 'fetch must not be called on config failure')
    assert.ok(
      err.message.includes(p.requiredVar),
      `message must name ${p.requiredVar}, got: ${err.message}`,
    )
  })

  // -- Case 2: empty-string and whitespace-only required var ---------------
  for (const bad of ['', '   ']) {
    test(`[${p.name}] required var = ${JSON.stringify(bad)} rejects config error and does not fetch`, async () => {
      const fetch = neverFetch()
      const provider = p.create({ env: { [p.requiredVar]: bad }, fetch })
      const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
      assertUniform(err, { provider: p.name, kind: 'config' })
      assert.equal(fetch.calls.length, 0, 'fetch must not be called on config failure')
      assert.ok(
        err.message.includes(p.requiredVar),
        `message must name ${p.requiredVar}, got: ${err.message}`,
      )
    })
  }

  // -- Case 3: fetch rejection preserves cause identity --------------------
  test(`[${p.name}] fetch rejection rejects request error with cause identity`, async () => {
    const original = new Error('ECONNREFUSED 127.0.0.1:443')
    const fetch = makeFetchSpy(() => Promise.reject(original))
    const provider = p.create({ env: p.validEnv(), fetch })
    const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
    assertUniform(err, { provider: p.name, kind: 'request' })
    assert.equal(fetch.calls.length, 1, 'fetch should have been attempted once')
    assert.strictEqual(err.cause, original, 'cause must be the original error by identity')
  })

  // -- Case 4: empty model output ------------------------------------------
  for (const content of ['', '   ']) {
    test(`[${p.name}] empty model output ${JSON.stringify(content)} rejects empty error`, async () => {
      const fetch = makeFetchSpy(() =>
        makeResponse({ ok: true, status: 200, body: JSON.stringify(p.okShape(content)) }),
      )
      const provider = p.create({ env: p.validEnv(), fetch })
      const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
      assertUniform(err, { provider: p.name, kind: 'empty' })
    })
  }

  // -- Case 5: invalid params (fetch never called) -------------------------
  const invalidParamCases = [
    { systemPrompt: '', userPrompt: 'u', maxOutputTokens: 10 },
    { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 0 },
  ]
  for (const params of invalidParamCases) {
    test(`[${p.name}] invalid params ${JSON.stringify(params)} rejects invalid-params and does not fetch`, async () => {
      const fetch = neverFetch()
      const provider = p.create({ env: p.validEnv(), fetch })
      const err = await captureRejection(() => provider.generateJson(params))
      assertUniform(err, { kind: 'invalid-params' })
      assert.equal(fetch.calls.length, 0, 'fetch must not be called on invalid params')
    })
  }

  // -- Case 6: malformed JSON body on ok response --------------------------
  test(`[${p.name}] malformed JSON body on ok response rejects request error with cause`, async () => {
    const fetch = makeFetchSpy(() => makeResponse({ ok: true, status: 200, body: 'garbage{' }))
    const provider = p.create({ env: p.validEnv(), fetch })
    const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
    assertUniform(err, { provider: p.name, kind: 'request' })
    assert.ok(err.cause instanceof Error, 'malformed JSON parse failure must carry a cause')
  })

  // -- Case 7: non-ok 500 with unparseable body ----------------------------
  test(`[${p.name}] non-ok 500 with unparseable body rejects request error naming status`, async () => {
    const fetch = makeFetchSpy(() =>
      makeResponse({ ok: false, status: 500, body: '<<< not json 500 >>>' }),
    )
    const provider = p.create({ env: p.validEnv(), fetch })
    const err = await captureRejection(() => provider.generateJson({ ...VALID_PARAMS }))
    assertUniform(err, { provider: p.name, kind: 'request' })
    assert.ok(err.message.includes('500'), `message must contain status 500, got: ${err.message}`)
  })
}

// -- Case 8: aggregate uniformity sweep across the whole battery -----------
test('battery-wide uniformity: every rejection is a well-formed ProviderError with no leaked secret', () => {
  // 3 providers * (1 missing + 2 blank + 1 fetch + 2 empty + 2 invalid + 1 malformed + 1 non-ok) = 30
  assert.equal(battery.length, 30, `expected 30 collected rejections, got ${battery.length}`)
  for (const err of battery) {
    assert.ok(err instanceof Error)
    assert.equal(err.name, 'ProviderError')
    assert.ok(KNOWN_KINDS.has(err.kind), `unknown kind: ${String(err.kind)}`)
    assert.ok(!err.message.includes(SECRET), `leaked secret in: ${err.message}`)
  }
  const providersSeen = new Set(
    battery.map((e) => e.provider).filter((v) => v !== undefined),
  )
  assert.deepEqual([...providersSeen].sort(), ['gemini', 'groq', 'ollama'])
})
