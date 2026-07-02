import { PROVIDER_ERROR_KINDS, ProviderError } from './providerContract.js'

/**
 * @typedef {import('./providerContract.js').FetchLike} FetchLike
 */

/**
 * @typedef {object} RequestProviderJsonArgs
 * @property {FetchLike} fetch
 * @property {string|URL} url
 * @property {string} [method]
 * @property {Record<string, string>} headers
 * @property {Record<string, unknown>} body
 * @property {string} provider
 * @property {(data: unknown, status: number) => string} extractErrorMessage
 */

const DEFAULT_METHOD = 'POST'

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
 * @param {string} provider
 * @returns {ProviderError}
 */
function invalidParams(message, provider) {
  return new ProviderError(message, { provider, kind: PROVIDER_ERROR_KINDS.INVALID_PARAMS })
}

/**
 * @param {RequestProviderJsonArgs} args
 * @returns {RequestProviderJsonArgs}
 */
function assertRequestArgs(args) {
  if (!isPlainObject(args)) {
    throw invalidParams('requestProviderJson args must be a non-null object', undefined)
  }
  const provider = typeof args.provider === 'string' && args.provider.length > 0 ? args.provider : undefined
  if (provider === undefined) {
    throw invalidParams('provider must be a non-empty string', undefined)
  }
  if (!isFunction(args.fetch)) {
    throw invalidParams('fetch must be a function', provider)
  }
  if (typeof args.url !== 'string' && !(args.url instanceof URL)) {
    throw invalidParams('url must be a string or URL', provider)
  }
  if (typeof args.url === 'string' && args.url.length === 0) {
    throw invalidParams('url must be a non-empty string', provider)
  }
  const method = args.method === undefined ? DEFAULT_METHOD : args.method
  if (typeof method !== 'string' || method.length === 0) {
    throw invalidParams('method must be a non-empty string', provider)
  }
  if (!isPlainObject(args.headers)) {
    throw invalidParams('headers must be a plain object', provider)
  }
  if (!isPlainObject(args.body)) {
    throw invalidParams('body must be a plain object', provider)
  }
  if (!isFunction(args.extractErrorMessage)) {
    throw invalidParams('extractErrorMessage must be a function', provider)
  }
  return {
    fetch: args.fetch,
    url: args.url,
    method,
    headers: args.headers,
    body: args.body,
    provider,
    extractErrorMessage: args.extractErrorMessage,
  }
}

/**
 * @param {Response} res
 * @param {string} provider
 * @returns {Promise<unknown>}
 */
async function readJsonBody(res, provider) {
  let text
  try {
    text = await res.text()
  } catch (cause) {
    throw new ProviderError(`${provider} response body could not be read`, {
      provider,
      kind: PROVIDER_ERROR_KINDS.REQUEST,
      cause,
    })
  }
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new ProviderError(`${provider} response body was not valid JSON`, {
      provider,
      kind: PROVIDER_ERROR_KINDS.REQUEST,
      cause,
    })
  }
}

/**
 * @param {Response} res
 * @param {string} provider
 * @param {(data: unknown, status: number) => string} extractErrorMessage
 * @returns {Promise<never>}
 */
async function throwNonOk(res, provider, extractErrorMessage) {
  const status = res.status
  let text
  try {
    text = await res.text()
  } catch (cause) {
    throw new ProviderError(`${provider} request failed with status ${status}`, {
      provider,
      kind: PROVIDER_ERROR_KINDS.REQUEST,
      cause,
    })
  }
  let data
  let parsed = false
  try {
    data = JSON.parse(text)
    parsed = true
  } catch {
    parsed = false
  }
  if (parsed) {
    let message
    try {
      message = extractErrorMessage(data, status)
    } catch (cause) {
      throw new ProviderError(`${provider} request failed with status ${status}`, {
        provider,
        kind: PROVIDER_ERROR_KINDS.REQUEST,
        cause,
      })
    }
    const safeMessage = typeof message === 'string' && message.length > 0
      ? message
      : `${provider} request failed with status ${status}`
    throw new ProviderError(safeMessage, { provider, kind: PROVIDER_ERROR_KINDS.REQUEST })
  }
  throw new ProviderError(`${provider} request failed with status ${status}`, {
    provider,
    kind: PROVIDER_ERROR_KINDS.REQUEST,
  })
}

/**
 * @param {FetchLike} [injected]
 * @returns {FetchLike}
 */
export function resolveFetch(injected) {
  if (isFunction(injected)) {
    return injected
  }
  if (!isFunction(globalThis.fetch)) {
    throw new ProviderError('fetch is not available; provide a fetch implementation', {
      kind: PROVIDER_ERROR_KINDS.CONFIG,
    })
  }
  return (u, i) => globalThis.fetch(u, i)
}

/**
 * @param {RequestProviderJsonArgs} args
 * @returns {Promise<Record<string, unknown>>}
 */
export async function requestProviderJson(args) {
  const { fetch, url, method, headers, body, provider, extractErrorMessage } = assertRequestArgs(args)
  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw new ProviderError(`${provider} request could not be completed`, {
      provider,
      kind: PROVIDER_ERROR_KINDS.REQUEST,
      cause,
    })
  }
  if (!res.ok) {
    await throwNonOk(res, provider, extractErrorMessage)
  }
  const data = await readJsonBody(res, provider)
  if (!isPlainObject(data)) {
    throw new ProviderError(`${provider} response JSON root was not a plain object`, {
      provider,
      kind: PROVIDER_ERROR_KINDS.REQUEST,
    })
  }
  return data
}
