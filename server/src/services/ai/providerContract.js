export const PROVIDER_NAMES = Object.freeze({ GEMINI: 'gemini', GROQ: 'groq', OLLAMA: 'ollama' })

export const PROVIDER_ERROR_KINDS = Object.freeze({ CONFIG: 'config', REQUEST: 'request', EMPTY: 'empty', INVALID_PARAMS: 'invalid-params' })

export const DEFAULT_TEMPERATURE = 0.7

export const MAX_OUTPUT_TOKENS_LIMIT = 8192

const TEMPERATURE_MIN = 0

const TEMPERATURE_MAX = 2

const MAX_OUTPUT_TOKENS_MIN = 1

/**
 * @typedef {{ systemPrompt:string, userPrompt:string, maxOutputTokens:number, temperature?:number }} GenerateJsonParams
 * @typedef {(params: GenerateJsonParams) => Promise<string>} GenerateJson
 * @typedef {{ generateJson: GenerateJson }} AiProvider
 * @typedef {(url:string|URL, init?:object) => Promise<Response>} FetchLike
 * @typedef {{ env: Record<string,string|undefined>, fetch?: FetchLike }} ProviderDeps
 */

export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {{ provider?: string, kind: string, cause?: unknown }} opts
   */
  constructor(message, opts) {
    super(message)
    this.name = 'ProviderError'
    this.provider = opts.provider
    this.kind = opts.kind
    this.cause = opts.cause
  }
}

/**
 * @param {string} message
 * @returns {ProviderError}
 */
function invalidParams(message) {
  return new ProviderError(message, { kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS })
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isRealNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function assertNonEmptyString(value, field) {
  if (typeof value !== 'string') {
    throw invalidParams(`${field} must be a string`)
  }
  if (value.trim().length === 0) {
    throw invalidParams(`${field} must be a non-empty string`)
  }
  return value
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function assertMaxOutputTokens(value) {
  if (typeof value !== 'number') {
    throw invalidParams('maxOutputTokens must be a number')
  }
  if (!Number.isInteger(value)) {
    throw invalidParams('maxOutputTokens must be an integer')
  }
  if (value < MAX_OUTPUT_TOKENS_MIN || value > MAX_OUTPUT_TOKENS_LIMIT) {
    throw invalidParams(`maxOutputTokens must be within [${MAX_OUTPUT_TOKENS_MIN}, ${MAX_OUTPUT_TOKENS_LIMIT}]`)
  }
  return value
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function assertTemperature(value) {
  if (value === undefined) {
    return DEFAULT_TEMPERATURE
  }
  if (!isRealNumber(value)) {
    throw invalidParams('temperature must be a finite number')
  }
  if (value < TEMPERATURE_MIN || value > TEMPERATURE_MAX) {
    throw invalidParams(`temperature must be within [${TEMPERATURE_MIN}, ${TEMPERATURE_MAX}]`)
  }
  return value
}

/**
 * @param {unknown} params
 * @returns {GenerateJsonParams}
 */
export function assertGenerateJsonParams(params) {
  if (!isPlainObject(params)) {
    throw invalidParams('params must be a non-null object')
  }
  const systemPrompt = assertNonEmptyString(params.systemPrompt, 'systemPrompt')
  const userPrompt = assertNonEmptyString(params.userPrompt, 'userPrompt')
  const maxOutputTokens = assertMaxOutputTokens(params.maxOutputTokens)
  const temperature = assertTemperature(params.temperature)
  return { systemPrompt, userPrompt, maxOutputTokens, temperature }
}
