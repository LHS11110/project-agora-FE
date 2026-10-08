FROM node:22-alpine AS development

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite embeds these public configuration values into the browser bundle.
ARG VITE_API_BASE_URL=
ARG VITE_WS_BASE_URL=
ARG VITE_WEBRTC_ICE_SERVERS=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}
ENV VITE_WEBRTC_ICE_SERVERS=${VITE_WEBRTC_ICE_SERVERS}
RUN npm run build

# Export only the built SPA; the backend repository owns Nginx.
FROM build AS production
CMD ["sh", "-c", "find /output -mindepth 1 -maxdepth 1 -exec rm -rf {} + && cp -a /app/dist/. /output/"]
