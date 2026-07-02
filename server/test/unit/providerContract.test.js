import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVIDER_NAMES,
  PROVIDER_ERROR_KINDS,
  DEFAULT_TEMPERATURE,
  MAX_OUTPUT_TOKENS_LIMIT,
  ProviderError,
  assertGenerateJsonParams,
} from '../../src/services/ai/providerContract.js'

const validBase = () => ({
  systemPrompt: 'sys',
  userPrompt: 'usr',
  maxOutputTokens: 100,
  temperature: 0.5,
})

const KIND_VALUES = new Set(Object.values(PROVIDER_ERROR_KINDS))

const expectInvalidParams = (fn) => {
  let thrown
  try {
    fn()
  } catch (e) {
    thrown = e
  }
  assert.ok(thrown, 'expected a throw')
  assert.ok(thrown instanceof ProviderError, `expected ProviderError, got ${thrown && thrown.constructor && thrown.constructor.name}`)
  assert.equal(thrown.kind, PROVIDER_ERROR_KINDS.INVALID_PARAMS)
  return thrown
}

test('constant values match spec exactly', () => {
  assert.deepEqual({ ...PROVIDER_NAMES }, { GEMINI: 'gemini', GROQ: 'groq', OLLAMA: 'ollama' })
  assert.deepEqual({ ...PROVIDER_ERROR_KINDS }, { CONFIG: 'config', REQUEST: 'request', EMPTY: 'empty', INVALID_PARAMS: 'invalid-params' })
  assert.equal(DEFAULT_TEMPERATURE, 0.7)
  assert.equal(MAX_OUTPUT_TOKENS_LIMIT, 8192)
})

test('PROVIDER_NAMES is frozen', () => {
  assert.equal(Object.isFrozen(PROVIDER_NAMES), true)
})

test('PROVIDER_ERROR_KINDS is frozen', () => {
  assert.equal(Object.isFrozen(PROVIDER_ERROR_KINDS), true)
})

test('ProviderError is instanceof Error', () => {
  assert.ok(new ProviderError('m', { kind: 'config' }) instanceof Error)
})

test('ProviderError name is ProviderError', () => {
  assert.equal(new ProviderError('m', { kind: 'config' }).name, 'ProviderError')
})

test('ProviderError exposes message kind and provider', () => {
  const e = new ProviderError('boom', { provider: PROVIDER_NAMES.GROQ, kind: PROVIDER_ERROR_KINDS.REQUEST })
  assert.equal(e.message, 'boom')
  assert.equal(e.kind, 'request')
  assert.equal(e.provider, 'groq')
})

test('ProviderError preserves cause when given', () => {
  const cause = new Error('root')
  const e = new ProviderError('m', { kind: 'request', cause })
  assert.equal(e.cause, cause)
})

test('ProviderError provider is undefined when omitted', () => {
  const e = new ProviderError('m', { kind: 'empty' })
  assert.equal(e.provider, undefined)
  assert.equal(e.cause, undefined)
})

const paramShapeRejects = [
  ['null', null],
  ['undefined', undefined],
  ['number 42', 42],
  ['string str', 'str'],
  ['boolean true', true],
  ['array', []],
  ['function', () => {}],
]
for (const [label, value] of paramShapeRejects) {
  test(`rejects params shape: ${label}`, () => {
    expectInvalidParams(() => assertGenerateJsonParams(value))
  })
}

const promptRejects = [
  ['missing', undefined],
  ['number', 5],
  ['null', null],
  ['object', {}],
  ['empty string', ''],
  ['whitespace only', '   '],
]
for (const [label, bad] of promptRejects) {
  test(`rejects systemPrompt: ${label}`, () => {
    expectInvalidParams(() => assertGenerateJsonParams({ ...validBase(), systemPrompt: bad }))
  })
  test(`rejects userPrompt: ${label}`, () => {
    expectInvalidParams(() => assertGenerateJsonParams({ ...validBase(), userPrompt: bad }))
  })
}

const maxTokRejects = [
  ['missing', undefined],
  ['0', 0],
  ['-1', -1],
  ['1.5', 1.5],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['8193', 8193],
  ['numeric string', '100'],
  ['true', true],
  ['null', null],
]
for (const [label, bad] of maxTokRejects) {
  test(`rejects maxOutputTokens: ${label}`, () => {
    expectInvalidParams(() => assertGenerateJsonParams({ ...validBase(), maxOutputTokens: bad }))
  })
}

const tempRejects = [
  ['-0.1', -0.1],
  ['2.1', 2.1],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['numeric string', '1'],
  ['true', true],
  ['null', null],
]
for (const [label, bad] of tempRejects) {
  test(`rejects temperature: ${label}`, () => {
    expectInvalidParams(() => assertGenerateJsonParams({ ...validBase(), temperature: bad }))
  })
}

test('accepts maxOutputTokens boundary 1', () => {
  assert.equal(assertGenerateJsonParams({ ...validBase(), maxOutputTokens: 1 }).maxOutputTokens, 1)
})

test('accepts maxOutputTokens boundary 8192', () => {
  assert.equal(assertGenerateJsonParams({ ...validBase(), maxOutputTokens: 8192 }).maxOutputTokens, 8192)
})

test('accepts temperature boundary 0', () => {
  assert.equal(assertGenerateJsonParams({ ...validBase(), temperature: 0 }).temperature, 0)
})

test('accepts temperature boundary 2', () => {
  assert.equal(assertGenerateJsonParams({ ...validBase(), temperature: 2 }).temperature, 2)
})

test('absent temperature defaults to 0.7', () => {
  const input = { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 10 }
  assert.equal(assertGenerateJsonParams(input).temperature, DEFAULT_TEMPERATURE)
})

test('explicit undefined temperature defaults to 0.7', () => {
  assert.equal(
    assertGenerateJsonParams({ ...validBase(), temperature: undefined }).temperature,
    DEFAULT_TEMPERATURE
  )
})

test('returns a NEW object distinct from input', () => {
  const input = validBase()
  const out = assertGenerateJsonParams(input)
  assert.notEqual(out, input)
})

test('result has exactly the four contract keys', () => {
  const out = assertGenerateJsonParams(validBase())
  assert.deepEqual(Object.keys(out).sort(), ['maxOutputTokens', 'systemPrompt', 'temperature', 'userPrompt'])
})

test('result preserves provided values', () => {
  const input = { systemPrompt: 'S', userPrompt: 'U', maxOutputTokens: 4321, temperature: 1.25 }
  assert.deepEqual(assertGenerateJsonParams(input), input)
})

test('purity: two calls with same input are deeply equal', () => {
  const input = validBase()
  assert.deepEqual(assertGenerateJsonParams(input), assertGenerateJsonParams(input))
})

test('purity: input object is not mutated', () => {
  const input = validBase()
  const snapshot = { ...input }
  assertGenerateJsonParams(input)
  assert.deepEqual(input, snapshot)
})

test('extra unknown keys are dropped from result', () => {
  const input = { ...validBase(), extra: 'x', another: 99 }
  const out = assertGenerateJsonParams(input)
  assert.deepEqual(Object.keys(out).sort(), ['maxOutputTokens', 'systemPrompt', 'temperature', 'userPrompt'])
  assert.equal('extra' in out, false)
  assert.equal('another' in out, false)
})

test('whitespace-padded prompts preserved verbatim (not trimmed)', () => {
  const out = assertGenerateJsonParams({ ...validBase(), systemPrompt: '  hi  ', userPrompt: ' yo ' })
  assert.equal(out.systemPrompt, '  hi  ')
  assert.equal(out.userPrompt, ' yo ')
})

const safeLabel = (v) => {
  try {
    if (typeof v === 'bigint') return `${v}n`
    if (typeof v === 'symbol') return v.toString()
    return `${JSON.stringify(v)}|${typeof v}`
  } catch {
    return `<unserializable ${typeof v}>`
  }
}

test('invariant: garbage data battery only ever throws ProviderError with a known kind', () => {
  const garbage = [
    null, undefined, 0, 1, -1, NaN, Infinity, -Infinity, '', 'x', true, false,
    [], [1, 2], {}, () => {}, Symbol('s'), 42n, new Date(),
    Object.create(null),
    { systemPrompt: 's' },
    { systemPrompt: 's', userPrompt: 'u' },
    { systemPrompt: 1, userPrompt: 2, maxOutputTokens: 3 },
    { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: Number.MAX_SAFE_INTEGER },
    { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: -0 },
    { systemPrompt: 's', userPrompt: 'u', maxOutputTokens: 5, temperature: {} },
    { systemPrompt: {}, userPrompt: [], maxOutputTokens: 'n', temperature: 'x' },
  ]
  for (const input of garbage) {
    let thrown
    try {
      const r = assertGenerateJsonParams(input)
      assert.deepEqual(Object.keys(r).sort(), ['maxOutputTokens', 'systemPrompt', 'temperature', 'userPrompt'])
      continue
    } catch (e) {
      thrown = e
    }
    assert.ok(thrown instanceof ProviderError, `non-ProviderError for input ${safeLabel(input)}: ${thrown}`)
    assert.ok(KIND_VALUES.has(thrown.kind), `unknown kind ${thrown.kind} for input ${safeLabel(input)}`)
  }
})

test('observation: a throwing property getter escapes as non-ProviderError', () => {
  const input = { get systemPrompt() { throw new RangeError('trap') }, userPrompt: 'u', maxOutputTokens: 1 }
  let thrown
  try {
    assertGenerateJsonParams(input)
  } catch (e) {
    thrown = e
  }
  assert.ok(thrown instanceof RangeError)
  assert.equal(thrown instanceof ProviderError, false)
})

test('-0 maxOutputTokens is rejected as below minimum', () => {
  expectInvalidParams(() => assertGenerateJsonParams({ ...validBase(), maxOutputTokens: -0 }))
})
