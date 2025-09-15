# Deployment Strategies

Enterprise deployment patterns for PHP MCP SDK in production environments.

## Overview

This guide covers comprehensive deployment strategies for PHP MCP SDK servers and applications in production environments, including container orchestration, CI/CD pipelines, and scaling patterns.

## Container Deployment

### Docker Configuration

```dockerfile
FROM php:8.3-cli

# Install required extensions
RUN docker-php-ext-install pcntl sockets pdo_mysql

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy application
WORKDIR /app
COPY . .
RUN composer install --no-dev --optimize-autoloader

# Run server
CMD ["php", "server.php"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_ENVIRONMENT=production
      - MCP_LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Kubernetes Deployment

### Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
        - name: mcp-server
          image: your-registry/mcp-server:latest
          ports:
            - containerPort: 3000
          env:
            - name: MCP_ENVIRONMENT
              value: "production"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

## CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy MCP Server

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: "8.3"

      - name: Install dependencies
        run: composer install --no-dev

      - name: Run tests
        run: composer test

      - name: Build Docker image
        run: docker build -t mcp-server .

      - name: Deploy to production
        run: |
          docker tag mcp-server your-registry/mcp-server:${{ github.sha }}
          docker push your-registry/mcp-server:${{ github.sha }}
```

## Load Balancing

### Nginx Configuration

```nginx
upstream mcp_servers {
    server mcp-server-1:3000;
    server mcp-server-2:3000;
    server mcp-server-3:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://mcp_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Blue-Green Deployment

### Strategy

1. **Prepare Green Environment**: Deploy new version to green environment
2. **Health Checks**: Verify green environment health
3. **Switch Traffic**: Route traffic from blue to green
4. **Monitor**: Watch metrics and error rates
5. **Rollback**: Switch back to blue if issues occur

### Implementation

```bash
#!/bin/bash
# blue-green-deploy.sh

GREEN_VERSION=$1
CURRENT_VERSION=$(kubectl get deployment mcp-server -o jsonpath='{.spec.template.spec.containers[0].image}')

# Deploy green version
kubectl set image deployment/mcp-server-green mcp-server=your-registry/mcp-server:$GREEN_VERSION

# Wait for rollout
kubectl rollout status deployment/mcp-server-green

# Health check
if curl -f http://green.your-domain.com/health; then
    # Switch traffic
    kubectl patch service mcp-server -p '{"spec":{"selector":{"version":"green"}}}'
    echo "Deployment successful"
else
    echo "Health check failed, keeping current version"
    exit 1
fi
```

## Rolling Updates

### Kubernetes Rolling Update

```bash
# Update deployment with zero downtime
kubectl set image deployment/mcp-server mcp-server=your-registry/mcp-server:v2.0.0

# Monitor rollout
kubectl rollout status deployment/mcp-server

# Rollback if needed
kubectl rollout undo deployment/mcp-server
```

## Auto-Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Database Migration

### Migration Strategy

```php
<?php
// migrations/deploy-migration.php

class DeployMigration
{
    public function up(): void
    {
        // Run before deployment
        $this->createNewTables();
        $this->addNewColumns();
    }

    public function down(): void
    {
        // Rollback changes
        $this->dropNewColumns();
        $this->dropNewTables();
    }
}
```

## Configuration Management

### Environment-Specific Config

```php
<?php
// config/production.php

return [
    'mcp' => [
        'environment' => 'production',
        'debug' => false,
        'log_level' => 'info',
        'cache' => [
            'driver' => 'redis',
            'host' => env('REDIS_HOST', 'redis'),
        ],
        'database' => [
            'host' => env('DB_HOST'),
            'username' => env('DB_USERNAME'),
            'password' => env('DB_PASSWORD'),
        ],
    ],
];
```

### Secret Management

```yaml
# kubernetes-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
type: Opaque
stringData:
  db-password: your-secure-password
  api-key: your-api-key
```

## Health Checks

### Application Health Endpoint

```php
<?php
// health-check.php

class HealthCheck
{
    public function check(): array
    {
        $checks = [];

        // Database connectivity
        $checks['database'] = $this->checkDatabase();

        // External API availability
        $checks['external_api'] = $this->checkExternalApi();

        // Memory usage
        $checks['memory'] = $this->checkMemory();

        $overall = array_reduce($checks, fn($carry, $check) => $carry && $check['healthy'], true);

        return [
            'healthy' => $overall,
            'checks' => $checks,
            'timestamp' => time(),
        ];
    }
}
```

## Monitoring Integration

### Prometheus Metrics

```php
<?php
// metrics.php

use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;

$registry = new CollectorRegistry();

// Request counter
$requestCounter = $registry->registerCounter(
    'mcp_requests_total',
    'Total number of MCP requests',
    ['method', 'status']
);

// Response time histogram
$responseTime = $registry->registerHistogram(
    'mcp_request_duration_seconds',
    'MCP request duration',
    ['method']
);
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mcp_backup_$DATE.sql"

# Create backup
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://your-backup-bucket/database/

# Clean up old backups (keep last 7 days)
find . -name "mcp_backup_*.sql" -mtime +7 -delete
```

## Security Hardening

### Production Security

```php
<?php
// security-config.php

return [
    'security' => [
        'ssl_required' => true,
        'rate_limiting' => [
            'enabled' => true,
            'requests_per_minute' => 60,
        ],
        'authentication' => [
            'required' => true,
            'token_expiry' => 3600,
        ],
        'input_validation' => [
            'strict_mode' => true,
            'sanitize_input' => true,
        ],
    ],
];
```

## Troubleshooting

### Common Deployment Issues

**Container fails to start:**

```bash
# Check logs
docker logs container-id

# Check resource limits
kubectl describe pod pod-name

# Verify configuration
kubectl get configmap mcp-config -o yaml
```

**Service unavailable:**

```bash
# Check service endpoints
kubectl get endpoints mcp-server

# Verify pod health
kubectl get pods -l app=mcp-server

# Check ingress configuration
kubectl describe ingress mcp-ingress
```

## Best Practices

1. **Use immutable deployments** - Never modify running containers
2. **Implement proper health checks** - Application and infrastructure level
3. **Monitor everything** - Metrics, logs, traces
4. **Test deployments** - Staging environment identical to production
5. **Plan rollback strategy** - Quick recovery from failures
6. **Secure secrets** - Never store secrets in code or images
7. **Document processes** - Runbooks for common operations

## Next Steps

- [Monitoring & Logging](monitoring) - Set up comprehensive observability
- [Security & Compliance](security) - Implement security best practices
- [Scaling & Performance](scaling) - Optimize for high load

Ready to deploy your PHP MCP SDK application to production! 🚀
