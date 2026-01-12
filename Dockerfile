# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Run tests
RUN npm test

# Build library and examples
RUN npm run build && npm run build:examples

# Production stage
FROM nginx:alpine

# Copy built examples to nginx (served under /maplibre-gl-usgs-lidar/ to match Vite base path)
COPY --from=builder /app/dist-examples /usr/share/nginx/html/maplibre-gl-usgs-lidar

# Copy custom nginx config
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location /maplibre-gl-usgs-lidar/ { \
        try_files $uri $uri/ /maplibre-gl-usgs-lidar/index.html; \
    } \
    \
    location = / { \
        return 302 /maplibre-gl-usgs-lidar/; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

# Startup script that prints URL and starts nginx
RUN printf '#!/bin/sh\n\
echo ""\n\
echo "======================================================"\n\
echo "  MapLibre GL USGS LiDAR Examples"\n\
echo "======================================================"\n\
echo ""\n\
echo "  Server running on port 80"\n\
echo ""\n\
echo "  If you ran: docker run -p 8080:80 ..."\n\
echo "  Open: http://localhost:8080/maplibre-gl-usgs-lidar/"\n\
echo ""\n\
echo "======================================================"\n\
echo ""\n\
exec nginx -g "daemon off;"\n' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
