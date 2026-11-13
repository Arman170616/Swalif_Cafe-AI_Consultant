# Build stage — compiles the Vite/React SPA
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Relative path: nginx (below) proxies /api on the same origin, so the built bundle
# never has to know the droplet's IP/domain — no rebuild needed if that ever changes.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Runtime stage — just nginx serving the static build + reverse-proxying the API
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
