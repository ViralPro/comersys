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
  return serverlessHandler(req, res);
};
