import { PROVIDER_ERROR_KINDS, PROVIDER_NAMES, ProviderError } from './providerContract.js'
import { resolveFetch } from './providerHttp.js'
import { createGeminiProvider } from './geminiProvider.js'
import { createGroqProvider } from './groqProvider.js'
import { createOllamaProvider } from './ollamaProvider.js'

/**
 * @typedef {import('./providerContract.js').AiProvider} AiProvider
 * @typedef {import('./providerContract.js').ProviderDeps} ProviderDeps
 * @typedef {(deps: ProviderDeps) => AiProvider} ProviderFactory
 */

const DEFAULT_PROVIDER_NAME = PROVIDER_NAMES.GEMINI

const PROVIDER_ENV_VAR = 'AI_PROVIDER'

/** @type {Readonly<Record<string, ProviderFactory>>} */
const FACTORIES = Object.freeze({
  [PROVIDER_NAMES.GEMINI]: createGeminiProvider,
  [PROVIDER_NAMES.GROQ]: createGroqProvider,
  [PROVIDER_NAMES.OLLAMA]: createOllamaProvider,
})

/** @type {Readonly<Record<string, string>>} */
const REQUIRED_ENV_VAR = Object.freeze({
  [PROVIDER_NAMES.GEMINI]: 'GEMINI_API_KEY',
  [PROVIDER_NAMES.GROQ]: 'GROQ_API_KEY',
  [PROVIDER_NAMES.OLLAMA]: 'OLLAMA_MODEL',
})

/** @type {readonly string[]} */
const VALID_PROVIDER_NAMES = Object.freeze(Object.values(PROVIDER_NAMES))

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {string} message
 * @returns {ProviderError}
 */
function invalidParams(message) {
  return new ProviderError(message, { kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS })
}

/**
 * @param {string} message
 * @param {string} [provider]
 * @returns {ProviderError}
 */
function config(message, provider) {
  return new ProviderError(message, { provider, kind: PROVIDER_ERROR_KINDS.CONFIG })
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {'gemini'|'groq'|'ollama'}
 */
export function resolveProviderName(env) {
  if (!isPlainObject(env)) {
    throw invalidParams('env must be a non-null object')
  }
  const raw = env[PROVIDER_ENV_VAR]
  if (raw === undefined) {
    return DEFAULT_PROVIDER_NAME
  }
  if (typeof raw !== 'string') {
    throw config(`${PROVIDER_ENV_VAR} must be a string when provided`)
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized.length === 0) {
    throw config(`${PROVIDER_ENV_VAR} must not be empty; valid values are ${VALID_PROVIDER_NAMES.join(', ')}`)
  }
  if (!Object.prototype.hasOwnProperty.call(FACTORIES, normalized)) {
    throw config(`${PROVIDER_ENV_VAR} "${normalized}" is not supported; valid values are ${VALID_PROVIDER_NAMES.join(', ')}`)
  }
  return /** @type {'gemini'|'groq'|'ollama'} */ (normalized)
}

/**
 * @param {ProviderDeps} deps
 * @returns {AiProvider}
 */
export function createAiProvider(deps) {
  if (!isPlainObject(deps)) {
    throw invalidParams('deps must be a non-null object')
  }
  if (!isPlainObject(deps.env)) {
    throw invalidParams('deps.env must be a non-null object')
  }
  const name = resolveProviderName(deps.env)
  const fetch = resolveFetch(deps.fetch)
  const factory = FACTORIES[name]
  return factory({ env: deps.env, fetch })
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {void}
 */
export function assertProviderConfigured(env) {
  const name = resolveProviderName(env)
  const requiredVar = REQUIRED_ENV_VAR[name]
  if (!isNonEmptyString(env[requiredVar])) {
    throw config(`${requiredVar} is required and must be non-empty for provider "${name}"`, name)
  }
}
