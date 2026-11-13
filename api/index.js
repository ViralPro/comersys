/**
 * ============================================================================
 * COMERSYS PLATFORM — VERCEL SERVERLESS FUNCTION ADAPTER
 * ============================================================================
 * Redirige todas las peticiones a la API del servidor multi-tenant ComerSys.
 * Compatible con la especificación Serverless de Vercel y AWS Lambda.
 * ============================================================================
 */

const serverlessHandler = require('../server.js');

module.exports = (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlOverride = parsed.searchParams.get('url') || req.headers['x-matched-path'] || req.headers['x-invoke-path'];
  if (urlOverride) {
    req.url = urlOverride;
  }
  return serverlessHandler(req, res);
};
