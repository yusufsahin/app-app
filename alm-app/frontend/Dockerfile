# Stage 1: Build MPC Studio
FROM node:22-alpine AS studio-builder
WORKDIR /studio
# Context is root (../.. from alm-app/frontend)
COPY manifest-platform-core-suite/tooling/mpc-studio/package*.json ./
RUN npm install --legacy-peer-deps
COPY manifest-platform-core-suite/tooling/mpc-studio ./
COPY manifest-platform-core-suite/src/mpc /manifest-platform-core-suite/src/mpc
# Ensure sync script finds mpc
RUN sed -i 's|../../src/mpc|/manifest-platform-core-suite/src/mpc|g' scripts/sync-mpc.js
RUN npm run build

# Stage 2: Build ALM App Frontend
FROM node:22-alpine AS app-builder
WORKDIR /app
COPY alm-manifest-app/alm-app/frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY alm-manifest-app/alm-app/frontend ./
RUN npm run build

# Stage 3: Runtime
FROM nginx:alpine AS runtime
# Main app at root
COPY --from=app-builder /app/dist /usr/share/nginx/html
# Studio at /studio
COPY --from=studio-builder /studio/dist /usr/share/nginx/html/studio
COPY alm-manifest-app/alm-app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
