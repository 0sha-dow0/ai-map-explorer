import { PROVIDER_ERROR_KINDS, PROVIDER_NAMES, ProviderError, assertGenerateJsonParams } from './providerContract.js'
import { requestProviderJson } from './providerHttp.js'

/**
 * @typedef {import('./providerContract.js').GenerateJsonParams} GenerateJsonParams
 * @typedef {import('./providerContract.js').AiProvider} AiProvider
 * @typedef {import('./providerContract.js').FetchLike} FetchLike
 * @typedef {import('./providerContract.js').ProviderDeps} ProviderDeps
 */

const PROVIDER = PROVIDER_NAMES.GROQ

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const API_KEY_ENV = 'GROQ_API_KEY'

const MODEL_ENV = 'GROQ_MODEL'

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
 * @param {string} message
 * @returns {ProviderError}
 */
function invalidParams(message) {
  return new ProviderError(message, { provider: PROVIDER, kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS })
}

/**
 * @param {string} message
 * @returns {ProviderError}
 */
function configError(message) {
  return new ProviderError(message, { provider: PROVIDER, kind: PROVIDER_ERROR_KINDS.CONFIG })
}

/**
 * @param {string} message
 * @returns {ProviderError}
 */
function emptyError(message) {
  return new ProviderError(message, { provider: PROVIDER, kind: PROVIDER_ERROR_KINDS.EMPTY })
}

/**
 * @param {unknown} deps
 * @returns {{ env: Record<string, string|undefined>, fetch: FetchLike }}
 */
function assertDeps(deps) {
  if (!isPlainObject(deps)) {
    throw invalidParams('deps must be a non-null object')
  }
  if (!isPlainObject(deps.env)) {
    throw invalidParams('deps.env must be a non-null object')
  }
  if (!isFunction(deps.fetch)) {
    throw invalidParams('deps.fetch must be a function')
  }
  return { env: /** @type {Record<string, string|undefined>} */ (deps.env), fetch: /** @type {FetchLike} */ (deps.fetch) }
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {string}
 */
function resolveApiKey(env) {
  const raw = env[API_KEY_ENV]
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw configError(`${API_KEY_ENV} is not configured`)
  }
  return raw.trim()
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {string}
 */
function resolveModel(env) {
  const raw = env[MODEL_ENV]
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim()
  }
  return DEFAULT_MODEL
}

/**
 * @param {unknown} data
 * @param {number} status
 * @returns {string}
 */
function extractErrorMessage(data, status) {
  if (isPlainObject(data) && isPlainObject(data.error)) {
    const message = data.error.message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }
  return `Groq request failed with status ${status}`
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function extractContent(data) {
  const choices = data.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw emptyError('Groq response contained no choices')
  }
  const first = choices[0]
  if (!isPlainObject(first) || !isPlainObject(first.message)) {
    throw emptyError('Groq response choice was missing a message')
  }
  const content = first.message.content
  if (typeof content !== 'string') {
    throw emptyError('Groq response content was not a string')
  }
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    throw emptyError('Groq response content was empty')
  }
  return trimmed
}

/**
 * @param {ProviderDeps} deps
 * @returns {AiProvider}
 */
export function createGroqProvider(deps) {
  const { env, fetch } = assertDeps(deps)

  /**
   * @param {GenerateJsonParams} params
   * @returns {Promise<string>}
   */
  async function generateJson(params) {
    const { systemPrompt, userPrompt, maxOutputTokens, temperature } = assertGenerateJsonParams(params)
    const apiKey = resolveApiKey(env)
    const model = resolveModel(env)
    const data = await requestProviderJson({
      fetch,
      url: GROQ_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
      },
      provider: PROVIDER,
      extractErrorMessage,
    })
    return extractContent(data)
  }

  return { generateJson }
}
