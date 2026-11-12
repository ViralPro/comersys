# ============================================================================
# COMERSYS — DOCKERFILE PARA PRODUCCIÓN
# ============================================================================
FROM node:20-alpine

# Metadatos del contenedor
LABEL maintainer="ComerSys Platform <admin@comersys.local>"
LABEL description="ComerSys Multi-Tenant Commercial System & Central Administration"

# Directorio de trabajo
WORKDIR /app

# Copiar manifiestos y código fuente
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY js/ ./js/
COPY css/ ./css/
COPY assets/ ./assets/
COPY admin-central/ ./admin-central/
COPY backend-php-mysql/ ./backend-php-mysql/
COPY data/ ./data/

# Variables de entorno predeterminadas
ENV NODE_ENV=production
ENV PORT=8000
ENV ADMIN_PORT=8001
ENV DATA_PATH=/app/data/comersys_platform.json

# Permisos para persistencia
RUN chown -R node:node /app

# Cambiar a usuario no-root por seguridad
USER node

# Exponer puertos (8000 Sistema Comercial / 8001 Administración Central)
EXPOSE 8000 8001

# Comprobación de salud nativa (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8000) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Comando de inicio del servidor
CMD ["node", "server.js"]
