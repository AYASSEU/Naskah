FROM node:24.15.0-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
USER node
EXPOSE 4010
CMD ["node", "server.mjs"]
