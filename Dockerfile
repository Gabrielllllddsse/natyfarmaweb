# Imagen de la aplicación NatyfarmaWeb (Node.js + Express)
FROM node:20-alpine

WORKDIR /app

# Dependencias de producción (el CSS ya viene compilado desde Less)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Código del sistema
COPY database ./database
COPY server ./server
COPY public ./public
COPY panel ./panel
RUN mkdir -p public/uploads && chown -R node:node public/uploads

USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000

# Al iniciar: prepara la base de datos (no borra datos existentes) y arranca el servidor
CMD ["sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10; do node database/setup.js && break; echo \"Esperando a MySQL...\"; sleep 3; done; node server/index.js"]
