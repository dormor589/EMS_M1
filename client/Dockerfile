# ---------------------------------------------------------------------------
# EMS client — production image
#
# Vite compiles to static files, so the runtime image is nginx serving a
# directory. Node is only needed for the build and does not ship.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The API URL is baked in at build time — Vite inlines VITE_* variables into
# the bundle, so it cannot be changed by setting an env var on the container.
ARG VITE_API_URL=http://localhost:5050/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------------------------------------------------------------------------

FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
