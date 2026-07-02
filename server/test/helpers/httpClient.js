import http from 'node:http';

/**
 * @param {string} baseUrl
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 * @returns {Promise<{status: number, headers: Record<string, string>, body: unknown}>}
 */
export async function httpJson(baseUrl, method, path, body) {
  if (typeof baseUrl !== 'string') {
    throw new TypeError(`httpJson: baseUrl must be a string, received ${typeof baseUrl}`);
  }
  if (typeof method !== 'string') {
    throw new TypeError(`httpJson: method must be a string, received ${typeof method}`);
  }
  if (typeof path !== 'string') {
    throw new TypeError(`httpJson: path must be a string, received ${typeof path}`);
  }

  const target = new URL(path, baseUrl);
  const hasBody = body !== undefined;
  const payload = hasBody ? Buffer.from(JSON.stringify(body), 'utf8') : null;

  const headers = {};
  if (hasBody) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(payload.length);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', (err) => {
          reject(new Error(`httpJson: response stream error for ${method} ${target.href}`, { cause: err }));
        });
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const responseHeaders = {};
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
          }
          const contentType = res.headers['content-type'] ?? '';
          let parsed;
          if (raw.length === 0) {
            parsed = '';
          } else if (contentType.includes('application/json')) {
            try {
              parsed = JSON.parse(raw);
            } catch (err) {
              reject(new Error(`httpJson: failed to parse JSON body for ${method} ${target.href}`, { cause: err }));
              return;
            }
          } else {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: responseHeaders, body: parsed });
        });
      },
    );

    req.on('error', (err) => {
      reject(new Error(`httpJson: socket error for ${method} ${target.href}`, { cause: err }));
    });

    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}
