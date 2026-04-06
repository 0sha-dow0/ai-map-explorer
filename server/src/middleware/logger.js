export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const cacheHit = res.getHeader('x-cache') || '—';
    console.log(`  ${method} ${url} → ${status} (${duration}ms) [cache: ${cacheHit}]`);
  });

  next();
}
