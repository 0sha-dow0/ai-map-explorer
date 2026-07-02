import { createAiProvider } from './providerSelector.js'

/**
 * @typedef {import('./providerContract.js').GenerateJsonParams} GenerateJsonParams
 */

/**
 * @param {GenerateJsonParams} params
 * @returns {Promise<string>}
 */
export async function generateJson(params) {
  return createAiProvider({ env: process.env }).generateJson(params)
}

export { assertProviderConfigured } from './providerSelector.js'
