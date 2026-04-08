# Build context: parent of alm-manifest-app (see alm-app/docker-compose.yml).
# MPC Studio (/studio) is not built here: mpc-studio requires a full toolchain and
# optional lib sources; the main ALM UI does not depend on it for core workflows.
FROM node:22-alpine AS app-builder
WORKDIR /app
COPY alm-manifest-app/alm-app/frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY alm-manifest-app/alm-app/frontend ./
COPY alm-manifest-app/alm-app/docs /docs
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=app-builder /app/dist /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/html/studio && \
  printf '%s\n' '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>MPC Studio</title></head><body><p>MPC Studio is not bundled in this Docker image.</p></body></html>' \
  > /usr/share/nginx/html/studio/index.html
COPY alm-manifest-app/alm-app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
