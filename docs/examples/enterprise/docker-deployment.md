# Docker Deployment Example

Complete containerization setup with multi-stage builds, Docker Compose orchestration, and production deployment patterns.

## Overview

- Multi-stage Docker builds for optimized images
- Docker Compose orchestration for full stack
- Health checks and monitoring integration
- Scaling and load balancing configuration
- Production-ready deployment patterns

## Features

- **Containerization**: Optimized Docker images
- **Orchestration**: Docker Compose with multiple services
- **Monitoring**: Health checks, logging, metrics
- **Scaling**: Horizontal scaling with load balancers
- **Security**: Container security best practices

## Quick Start

```dockerfile
# Multi-stage Dockerfile
FROM php:8.1-cli AS builder
COPY . /app
WORKDIR /app
RUN composer install --no-dev --optimize-autoloader

FROM php:8.1-cli
COPY --from=builder /app /app
WORKDIR /app
CMD ["php", "server.php"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT=http
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

See the [complete implementation](https://github.com/dalehurley/php-mcp-sdk/tree/main/examples/enterprise/docker-deployment) for full source code.
