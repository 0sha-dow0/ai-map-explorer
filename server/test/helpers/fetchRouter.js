/**
 * @typedef {Object} FetchResponseSpec
 * @property {boolean} ok
 * @property {number} status
 * @property {unknown} [jsonBody]
 * @property {string} [textBody]
 */

/**
 * @typedef {Object} FetchRoute
 * @property {(url: string) => boolean} match
 * @property {(url: string, init: object) => FetchResponseSpec} respond
 */

let savedFetch = null;
let installed = false;

/**
 * @param {FetchResponseSpec} spec
 * @returns {{ok: boolean, status: number, text: () => Promise<string>, json: () => Promise<unknown>}}
 */
export function makeResponse({ ok, status, jsonBody, textBody }) {
  if (typeof ok !== 'boolean') {
    throw new TypeError(`makeResponse: ok must be a boolean, received ${typeof ok}`);
  }
  if (!Number.isInteger(status)) {
    throw new TypeError(`makeResponse: status must be an integer, received ${String(status)}`);
  }
  return {
    ok,
    status,
    text: async () => (textBody !== undefined ? textBody : JSON.stringify(jsonBody)),
    json: async () => (jsonBody !== undefined ? jsonBody : JSON.parse(textBody)),
  };
}

/**
 * @param {FetchRoute[]} routes
 * @returns {void}
 */
export function installFetchRouter(routes) {
  if (!Array.isArray(routes)) {
    throw new TypeError(`installFetchRouter: routes must be an array, received ${typeof routes}`);
  }
  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    if (route === null || typeof route !== 'object') {
      throw new TypeError(`installFetchRouter: routes[${i}] must be an object, received ${route === null ? 'null' : typeof route}`);
    }
    if (typeof route.match !== 'function') {
      throw new TypeError(`installFetchRouter: routes[${i}].match must be a function, received ${typeof route.match}`);
    }
    if (typeof route.respond !== 'function') {
      throw new TypeError(`installFetchRouter: routes[${i}].respond must be a function, received ${typeof route.respond}`);
    }
  }
  if (installed) {
    throw new Error('fetch router already installed');
  }
  savedFetch = globalThis.fetch;
  installed = true;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const route = routes.find((r) => r.match(u));
    if (!route) {
      throw new Error(`fetch router: no route matches ${u}`);
    }
    return makeResponse(route.respond(u, init ?? {}));
  };
}

/**
 * @returns {void}
 */
export function restoreFetch() {
  if (!installed) {
    return;
  }
  globalThis.fetch = savedFetch;
  savedFetch = null;
  installed = false;
}
