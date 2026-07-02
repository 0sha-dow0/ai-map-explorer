import {
  PROVIDER_ERROR_KINDS,
  PROVIDER_NAMES,
  ProviderError,
  assertGenerateJsonParams,
} from './providerContract.js'
import { requestProviderJson } from './providerHttp.js'

/**
 * @typedef {import('./providerContract.js').GenerateJsonParams} GenerateJsonParams
 * @typedef {import('./providerContract.js').AiProvider} AiProvider
 * @typedef {import('./providerContract.js').FetchLike} FetchLike
 * @typedef {import('./providerContract.js').ProviderDeps} ProviderDeps
 */

const PROVIDER = PROVIDER_NAMES.OLLAMA

const DEFAULT_BASE_URL = 'http://localhost:11434'

const CHAT_PATH = '/api/chat'

const MODEL_ENV_KEY = 'OLLAMA_MODEL'

const BASE_URL_ENV_KEY = 'OLLAMA_BASE_URL'

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
function configError(message) {
  return new ProviderError(message, { provider: PROVIDER, kind: PROVIDER_ERROR_KINDS.CONFIG })
}

/**
 * @param {unknown} deps
 * @returns {{ env: Record<string, string|undefined>, fetch: FetchLike }}
 */
function assertDeps(deps) {
  if (!isPlainObject(deps)) {
    throw new ProviderError('deps must be a non-null object', {
      provider: PROVIDER,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  if (!isPlainObject(deps.env)) {
    throw new ProviderError('deps.env must be a non-null object', {
      provider: PROVIDER,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  if (!isFunction(deps.fetch)) {
    throw new ProviderError('deps.fetch must be a function', {
      provider: PROVIDER,
      kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS,
    })
  }
  return { env: /** @type {Record<string, string|undefined>} */ (deps.env), fetch: /** @type {FetchLike} */ (deps.fetch) }
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {string}
 */
function resolveModel(env) {
  const raw = env[MODEL_ENV_KEY]
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw configError(`${MODEL_ENV_KEY} is required and must be a non-empty string`)
  }
  return raw.trim()
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {string}
 */
function resolveEndpoint(env) {
  const raw = env[BASE_URL_ENV_KEY]
  const base = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : DEFAULT_BASE_URL
  return base.replace(/\/+$/, '') + CHAT_PATH
}

/**
 * @param {unknown} data
 * @param {number} status
 * @returns {string}
 */
function extractErrorMessage(data, status) {
  if (isPlainObject(data) && typeof data.error === 'string' && data.error.length > 0) {
    return data.error
  }
  return `Ollama request failed with status ${status}`
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function extractContent(data) {
  const message = data.message
  const content = isPlainObject(message) ? message.content : undefined
  if (typeof content !== 'string') {
    throw new ProviderError('Ollama response message.content was missing or not a string', {
      provider: PROVIDER,
      kind: PROVIDER_ERROR_KINDS.EMPTY,
    })
  }
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    throw new ProviderError('Ollama response message.content was empty', {
      provider: PROVIDER,
      kind: PROVIDER_ERROR_KINDS.EMPTY,
    })
  }
  return trimmed
}

/**
 * @param {ProviderDeps} deps
 * @returns {AiProvider}
 */
export function createOllamaProvider(deps) {
  const { env, fetch } = assertDeps(deps)

  /**
   * @param {GenerateJsonParams} params
   * @returns {Promise<string>}
   */
  async function generateJson(params) {
    const { systemPrompt, userPrompt, maxOutputTokens, temperature } = assertGenerateJsonParams(params)
    const model = resolveModel(env)
    const url = resolveEndpoint(env)
    const data = await requestProviderJson({
      fetch,
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        format: 'json',
        options: { temperature, num_predict: maxOutputTokens },
      },
      provider: PROVIDER,
      extractErrorMessage,
    })
    return extractContent(data)
  }

  return { generateJson }
}
