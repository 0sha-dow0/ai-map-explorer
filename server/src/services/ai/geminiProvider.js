import { PROVIDER_ERROR_KINDS, PROVIDER_NAMES, ProviderError, assertGenerateJsonParams } from './providerContract.js'
import { requestProviderJson } from './providerHttp.js'

/**
 * @typedef {import('./providerContract.js').ProviderDeps} ProviderDeps
 * @typedef {import('./providerContract.js').AiProvider} AiProvider
 * @typedef {import('./providerContract.js').GenerateJsonParams} GenerateJsonParams
 * @typedef {import('./providerContract.js').FetchLike} FetchLike
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/'

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'

const RESPONSE_MIME_TYPE = 'application/json'

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {value is Function}
 */
function isFunction(value) {
  return typeof value === 'function'
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function resolveModel(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GEMINI_MODEL
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_GEMINI_MODEL
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * @param {unknown} deps
 * @returns {{ env: Record<string, string|undefined>, fetch: FetchLike }}
 */
function assertDeps(deps) {
  if (!isPlainObject(deps)) {
    throw new ProviderError('createGeminiProvider deps must be a non-null object', {
      provider: PROVIDER_NAMES.GEMINI,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  if (!isPlainObject(deps.env)) {
    throw new ProviderError('createGeminiProvider deps.env must be a plain object', {
      provider: PROVIDER_NAMES.GEMINI,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  if (!isFunction(deps.fetch)) {
    throw new ProviderError('createGeminiProvider deps.fetch must be a function', {
      provider: PROVIDER_NAMES.GEMINI,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  return { env: deps.env, fetch: deps.fetch }
}

/**
 * @param {unknown} data
 * @param {number} status
 * @returns {string}
 */
function extractErrorMessage(data, status) {
  const message = isPlainObject(data) && isPlainObject(data.error) ? data.error.message : undefined
  return isNonEmptyString(message) ? message : `Gemini request failed with status ${status}`
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function extractText(data) {
  const candidates = data.candidates
  if (!Array.isArray(candidates)) {
    throw new ProviderError('Gemini returned no text content', {
      provider: PROVIDER_NAMES.GEMINI,
      kind: PROVIDER_ERROR_KINDS.EMPTY,
    })
  }
  const text = candidates
    .flatMap((candidate) => (isPlainObject(candidate) && isPlainObject(candidate.content) && Array.isArray(candidate.content.parts) ? candidate.content.parts : []))
    .map((part) => (isPlainObject(part) && typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()
  if (text.length === 0) {
    throw new ProviderError('Gemini returned no text content', {
      provider: PROVIDER_NAMES.GEMINI,
      kind: PROVIDER_ERROR_KINDS.EMPTY,
    })
  }
  return text
}

/**
 * @param {ProviderDeps} deps
 * @returns {AiProvider}
 */
export function createGeminiProvider(deps) {
  const { env, fetch } = assertDeps(deps)

  /**
   * @param {GenerateJsonParams} params
   * @returns {Promise<string>}
   */
  async function generateJson(params) {
    const { systemPrompt, userPrompt, maxOutputTokens, temperature } = assertGenerateJsonParams(params)

    const apiKey = env.GEMINI_API_KEY
    if (!isNonEmptyString(apiKey)) {
      throw new ProviderError('Missing GEMINI_API_KEY', {
        provider: PROVIDER_NAMES.GEMINI,
        kind: PROVIDER_ERROR_KINDS.CONFIG,
      })
    }

    const model = resolveModel(env.GEMINI_MODEL)
    const url = new URL(`models/${model}:generateContent`, GEMINI_API_BASE)

    const data = await requestProviderJson({
      fetch,
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: RESPONSE_MIME_TYPE,
        },
      },
      provider: PROVIDER_NAMES.GEMINI,
      extractErrorMessage,
    })

    return extractText(data)
  }

  return { generateJson }
}
