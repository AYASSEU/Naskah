FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
ENV DEBIAN_FRONTEND=noninteractive HOME=/tmp SAL_USE_VCLPLUGIN=svp
RUN apt-get update && apt-get install -y --no-install-recommends pandoc libreoffice-writer python3 python3-uno python3-docx poppler-utils fonts-liberation fontconfig && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=local-fonts . /usr/local/share/fonts/naskah/
RUN fc-cache -f
COPY . .
RUN python3 template.py && chown -R node:node /app
ARG SOURCE_HASH
ENV COMPILER_ID=$SOURCE_HASH
USER node
EXPOSE 8000
CMD ["node","--max-old-space-size=256","server.mjs"]
