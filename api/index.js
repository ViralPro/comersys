/**
 * ============================================================================
 * COMERSYS PLATFORM — VERCEL SERVERLESS FUNCTION ADAPTER
 * ============================================================================
 * Redirige todas las peticiones a la API del servidor multi-tenant ComerSys.
 * Compatible con la especificación Serverless de Vercel y AWS Lambda.
 * ============================================================================
 */

const serverlessHandler = require('../server.js');

module.exports = async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const urlOverride = parsed.searchParams.get('url') || req.headers['x-matched-path'] || req.headers['x-invoke-path'];
    if (urlOverride) {
      req.url = urlOverride;
    }
    await serverlessHandler(req, res);
  } catch (err) {
    console.error('[ComerSys.Adapter] Error en adaptador serverless:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: '500 Error en Adaptador Serverless', message: err.message }));
    }
  }
};
