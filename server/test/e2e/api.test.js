import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../src/app.js';
import { bucketKey } from '../../src/services/cacheService.js';
import { installFetchRouter, restoreFetch } from '../helpers/fetchRouter.js';
import { httpJson } from '../helpers/httpClient.js';

// ---------------------------------------------------------------------------
// Shared server + env lifecycle
// ---------------------------------------------------------------------------

let server;
let baseUrl;
const savedEnv = {};
const ENV_KEYS = [
  'AI_PROVIDER',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'OLLAMA_MODEL',
  'OLLAMA_BASE_URL',
  'CLIENT_ORIGIN',
];

before(async () => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.AI_PROVIDER = 'groq';
  process.env.GROQ_API_KEY = 'test-key';
  delete process.env.GROQ_MODEL;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_BASE_URL;

  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  // Ensure any stray router is torn down (no-op if not installed).
  restoreFetch();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// Router helpers
// ---------------------------------------------------------------------------

/**
 * Install a fetch router, run fn, always restore (even on throw / double-install).
 */
async function withRouter(routes, fn) {
  installFetchRouter(routes);
  try {
    return await fn();
  } finally {
    restoreFetch();
  }
}

function reverseRoute(overrides = {}, counter) {
  return {
    match: (url) => url.includes('nominatim') && url.includes('/reverse'),
    respond: () => {
      if (counter) counter.reverse += 1;
      return {
        ok: true,
        status: 200,
        jsonBody: {
          lat: '40.00',
          lon: '-74.00',
          address: {
            city: 'Testville',
            state: 'Test State',
            country: 'Testland',
            ...overrides.address,
          },
          ...overrides,
        },
      };
    },
  };
}

function searchRoute(counter) {
  return {
    match: (url) => url.includes('nominatim') && url.includes('/search'),
    respond: (url) => {
      if (counter) counter.search += 1;
      // Query is embedded; return a distinct-ish coordinate deterministically.
      return {
        ok: true,
        status: 200,
        jsonBody: [
          {
            lat: '41.23',
            lon: '-75.45',
            display_name: `Resolved place for ${url}`,
            address: { city: 'Testville', country: 'Testland' },
          },
        ],
      };
    },
  };
}

function groqRoute(content, counter) {
  return {
    match: (url) => url.includes('api.groq.com'),
    respond: () => {
      if (counter) counter.groq += 1;
      return {
        ok: true,
        status: 200,
        jsonBody: { choices: [{ message: { content } }] },
      };
    },
  };
}

function groqErrorRoute(status, message, counter) {
  return {
    match: (url) => url.includes('api.groq.com'),
    respond: () => {
      if (counter) counter.groq += 1;
      return {
        ok: false,
        status,
        jsonBody: { error: { message } },
      };
    },
  };
}

function ollamaRoute(content, counter) {
  return {
    match: (url) => url.includes('11434') || url.includes('/api/chat'),
    respond: () => {
      if (counter) counter.ollama += 1;
      return {
        ok: true,
        status: 200,
        jsonBody: { message: { content } },
      };
    },
  };
}

function makePlaces() {
  const cats = ['museum', 'park', 'landmark', 'food', 'culture'];
  return cats.map((c, i) => ({
    name: `Place ${i} ${c}`,
    category: c,
    whyVisit: `Specific reason to visit place ${i}.`,
    lat: 10 + i,
    lng: 20 + i,
    free: i % 2 === 0,
    familyFriendly: true,
    setting: 'both',
  }));
}

const HAPPY_SUMMARY = JSON.stringify({
  history: 'A concise history paragraph.',
  funFacts: 'A concise fun facts paragraph.',
  placesIntro: 'Here are some places.',
  places: makePlaces(),
});

const HAPPY_TELLMORE = JSON.stringify({
  deeperHistory: 'A deeper history paragraph.',
  localVibes: 'Local vibe description.',
  hiddenGems: 'A couple of hidden gems.',
  bestTimeToVisit: 'Spring is best.',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E API', () => {
  // Criterion 1
  it('GET /api/health -> 200 with expected shape', async () => {
    // No external calls should happen; empty router makes any fetch throw loudly.
    await withRouter([], async () => {
      const res = await httpJson(baseUrl, 'GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(typeof res.body.uptime, 'number');
      assert.ok(res.body.uptime >= 0);
      assert.equal(typeof res.body.timestamp, 'string');
      assert.ok(!Number.isNaN(Date.parse(res.body.timestamp)));
      assert.ok(res.body.cache && typeof res.body.cache === 'object');
      for (const k of ['geocode', 'placeGeocode', 'reverseGeocode', 'summary', 'tellMore']) {
        assert.ok(res.body.cache[k], `cache.${k} present`);
        assert.equal(typeof res.body.cache[k].keys, 'number');
      }
    });
  });

  // Criterion 2
  it('POST /api/area-summary happy path -> 200, MISS then HIT, 5 geocoded places', async () => {
    const counter = { reverse: 0, search: 0, groq: 0 };
    const coords = { centerLat: 40.0, centerLng: -74.0, zoom: 12 };

    await withRouter(
      [reverseRoute({}, counter), searchRoute(counter), groqRoute(HAPPY_SUMMARY, counter)],
      async () => {
        // First call -> MISS
        const res1 = await httpJson(baseUrl, 'POST', '/api/area-summary', coords);
        assert.equal(res1.status, 200);
        assert.equal(res1.headers['x-cache'], 'MISS');
        assert.equal(res1.body.city, 'Testville');
        assert.equal(res1.body.history, 'A concise history paragraph.');
        assert.equal(res1.body.funFacts, 'A concise fun facts paragraph.');
        assert.equal(res1.body.placesIntro, 'Here are some places.');
        assert.ok(Array.isArray(res1.body.places));
        assert.equal(res1.body.places.length, 5);
        for (const p of res1.body.places) {
          assert.equal(typeof p.name, 'string');
          assert.equal(typeof p.whyVisit, 'string');
          assert.ok(Number.isFinite(p.lat));
          assert.ok(Number.isFinite(p.lng));
          // geocodePlace resolved coordinates (41.23 / -75.45) win over AI-provided.
          assert.equal(p.lat, 41.23);
          assert.equal(p.lng, -75.45);
        }
        // geocodePlace called once per place.
        assert.equal(counter.search, 5);
        assert.equal(counter.groq, 1);

        // Second identical call (no currentAreaKey) -> HIT, no new AI/geocode work.
        const res2 = await httpJson(baseUrl, 'POST', '/api/area-summary', coords);
        assert.equal(res2.status, 200);
        assert.equal(res2.headers['x-cache'], 'HIT');
        assert.equal(res2.body.history, res1.body.history);
        assert.equal(res2.body.places.length, 5);
        // No additional AI or place-geocode calls on cache hit.
        assert.equal(counter.groq, 1);
        assert.equal(counter.search, 5);
      },
    );
  });

  // Criterion 3a
  it('POST /api/area-summary non-finite center -> 400', async () => {
    await withRouter([], async () => {
      const cases = [
        { centerLat: 'abc', centerLng: 10, zoom: 12 },
        { centerLng: 10, zoom: 12 }, // missing centerLat
        { centerLat: 10, zoom: 12 }, // missing centerLng
        { centerLat: 'NaN', centerLng: 'NaN', zoom: 12 },
      ];
      for (const body of cases) {
        const res = await httpJson(baseUrl, 'POST', '/api/area-summary', body);
        assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
        assert.equal(typeof res.body.error, 'string');
      }
    });
  });

  // Criterion 3b
  it('POST /api/area-summary zoom < 9 -> 200 zoomTooLow', async () => {
    await withRouter([], async () => {
      const res = await httpJson(baseUrl, 'POST', '/api/area-summary', {
        centerLat: 12.0,
        centerLng: 22.0,
        zoom: 5,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.zoomTooLow, true);
      assert.equal(typeof res.body.hint, 'string');
    });
  });

  // Criterion 3c
  it('POST /api/area-summary currentAreaKey === bucketKey -> 200 sameArea', async () => {
    await withRouter([], async () => {
      const lat = 51.5;
      const lng = 0.1;
      const key = bucketKey(lat, lng);
      const res = await httpJson(baseUrl, 'POST', '/api/area-summary', {
        centerLat: lat,
        centerLng: lng,
        zoom: 12,
        currentAreaKey: key,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.sameArea, true);
      assert.equal(res.body.areaKey, key);
    });
  });

  // Criterion 4
  it('POST /api/area-summary malformed AI JSON -> 200 fallback, places []', async () => {
    const counter = { reverse: 0, search: 0, groq: 0 };
    await withRouter(
      [
        reverseRoute({ address: { city: 'Malburg', country: 'Testland' } }, counter),
        searchRoute(counter),
        groqRoute('not json {{{', counter),
      ],
      async () => {
        const res = await httpJson(baseUrl, 'POST', '/api/area-summary', {
          centerLat: -33.8,
          centerLng: 151.2,
          zoom: 12,
        });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.places, []);
        // Fallback history references the resolved city name.
        assert.ok(
          res.body.history.includes('Malburg'),
          `expected fallback history to mention city, got: ${res.body.history}`,
        );
        // No place geocoding when parse fails before mapping.
        assert.equal(counter.search, 0);
      },
    );
  });

  // Criterion 5a
  it('POST /api/tell-more happy path -> 200 with all fields', async () => {
    const counter = { groq: 0 };
    await withRouter([groqRoute(HAPPY_TELLMORE, counter)], async () => {
      const res = await httpJson(baseUrl, 'POST', '/api/tell-more', {
        areaKey: 'tm-happy-1',
        city: 'Kyoto',
        admin: 'Kansai',
        country: 'Japan',
        focus: 'food',
        existingSummary: { history: 'h', funFacts: 'f', places: [{ name: 'A' }] },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers['x-cache'], 'MISS');
      assert.equal(res.body.deeperHistory, 'A deeper history paragraph.');
      assert.equal(res.body.localVibes, 'Local vibe description.');
      assert.equal(res.body.hiddenGems, 'A couple of hidden gems.');
      assert.equal(res.body.bestTimeToVisit, 'Spring is best.');
    });
  });

  // Criterion 5b
  it('POST /api/tell-more missing required fields -> 400', async () => {
    await withRouter([], async () => {
      const cases = [
        { city: 'Kyoto' }, // missing areaKey
        { areaKey: 'k1' }, // missing city
        {}, // missing both
        { areaKey: '', city: 'Kyoto' }, // empty areaKey is falsy
      ];
      for (const body of cases) {
        const res = await httpJson(baseUrl, 'POST', '/api/tell-more', body);
        assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
        assert.equal(typeof res.body.error, 'string');
      }
    });
  });

  // Criterion 5c
  it('POST /api/tell-more malformed AI JSON -> 200 fallback object', async () => {
    await withRouter([groqRoute('totally not json <<<')], async () => {
      const res = await httpJson(baseUrl, 'POST', '/api/tell-more', {
        areaKey: 'tm-fallback-2',
        city: 'Osaka',
        focus: 'nightlife',
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.deeperHistory, 'More details coming soon.');
      assert.equal(res.body.localVibes, '');
      assert.equal(res.body.hiddenGems, '');
      assert.equal(res.body.bestTimeToVisit, '');
    });
  });

  // Criterion 6
  it('POST /api/area-summary concurrent requests for same fresh area -> consistent bodies', async () => {
    const coords = { centerLat: 35.6, centerLng: 139.6, zoom: 12 };
    await withRouter(
      [reverseRoute({ address: { city: 'Tokyoish', country: 'Testland' } }), searchRoute(), groqRoute(HAPPY_SUMMARY)],
      async () => {
        const [a, b] = await Promise.all([
          httpJson(baseUrl, 'POST', '/api/area-summary', coords),
          httpJson(baseUrl, 'POST', '/api/area-summary', coords),
        ]);
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.equal(a.body.city, 'Tokyoish');
        assert.equal(b.body.city, 'Tokyoish');
        assert.equal(a.body.history, b.body.history);
        assert.equal(a.body.places.length, 5);
        assert.equal(b.body.places.length, 5);
        assert.equal(a.body.areaKey, b.body.areaKey);
      },
    );
  });

  // Criterion 7
  it('POST /api/area-summary AI hard failure (groq 500) -> 500 error', async () => {
    await withRouter(
      [reverseRoute({ address: { city: 'Failtown', country: 'Testland' } }), groqErrorRoute(500, 'boom')],
      async () => {
        const res = await httpJson(baseUrl, 'POST', '/api/area-summary', {
          centerLat: 48.85,
          centerLng: 2.35,
          zoom: 12,
        });
        assert.equal(res.status, 500);
        assert.equal(typeof res.body.error, 'string');
      },
    );
  });

  // Criterion 8
  it('provider switch to ollama via env at runtime -> 200', async () => {
    const prevProvider = process.env.AI_PROVIDER;
    const prevModel = process.env.OLLAMA_MODEL;
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'm';
    const counter = { ollama: 0 };
    try {
      await withRouter(
        [
          reverseRoute({ address: { city: 'Ollamagrad', country: 'Testland' } }),
          searchRoute(),
          ollamaRoute(HAPPY_SUMMARY, counter),
        ],
        async () => {
          const res = await httpJson(baseUrl, 'POST', '/api/area-summary', {
            centerLat: 55.75,
            centerLng: 37.6,
            zoom: 12,
          });
          assert.equal(res.status, 200);
          assert.equal(res.body.city, 'Ollamagrad');
          assert.equal(res.body.places.length, 5);
          assert.ok(counter.ollama >= 1, 'ollama endpoint was hit');
        },
      );
    } finally {
      if (prevProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = prevProvider;
      if (prevModel === undefined) delete process.env.OLLAMA_MODEL;
      else process.env.OLLAMA_MODEL = prevModel;
    }
  });
});
