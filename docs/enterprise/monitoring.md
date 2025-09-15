# Monitoring & Observability

Comprehensive monitoring and observability setup for PHP MCP SDK applications in production.

## Overview

This guide covers implementing monitoring, logging, alerting, and observability for PHP MCP SDK applications to ensure reliability and performance in production environments.

## Metrics Collection

### Prometheus Integration

```php
<?php
// src/Monitoring/PrometheusMetrics.php

use Prometheus\CollectorRegistry;
use Prometheus\Storage\Redis;

class PrometheusMetrics
{
    private CollectorRegistry $registry;

    public function __construct()
    {
        $redis = new Redis(['host' => 'redis']);
        $this->registry = new CollectorRegistry($redis);
        $this->registerMetrics();
    }

    private function registerMetrics(): void
    {
        // Request counter
        $this->registry->registerCounter(
            'mcp_requests_total',
            'Total number of MCP requests',
            ['method', 'status', 'server']
        );

        // Request duration
        $this->registry->registerHistogram(
            'mcp_request_duration_seconds',
            'MCP request duration in seconds',
            ['method', 'server'],
            [0.1, 0.25, 0.5, 1, 2.5, 5, 10]
        );

        // Active connections
        $this->registry->registerGauge(
            'mcp_active_connections',
            'Number of active MCP connections',
            ['server']
        );

        // Memory usage
        $this->registry->registerGauge(
            'mcp_memory_usage_bytes',
            'Memory usage in bytes',
            ['server']
        );
    }

    public function incrementRequests(string $method, string $status, string $server): void
    {
        $counter = $this->registry->getCounter('mcp_requests_total');
        $counter->incBy(1, [$method, $status, $server]);
    }

    public function recordRequestDuration(float $duration, string $method, string $server): void
    {
        $histogram = $this->registry->getHistogram('mcp_request_duration_seconds');
        $histogram->observe($duration, [$method, $server]);
    }
}
```

### Custom Metrics Middleware

```php
<?php
// src/Middleware/MetricsMiddleware.php

class MetricsMiddleware
{
    private PrometheusMetrics $metrics;

    public function __construct(PrometheusMetrics $metrics)
    {
        $this->metrics = $metrics;
    }

    public function process(array $request, callable $next): array
    {
        $startTime = microtime(true);
        $method = $request['method'] ?? 'unknown';
        $server = gethostname();

        try {
            $response = $next($request);
            $status = 'success';
        } catch (Exception $e) {
            $status = 'error';
            throw $e;
        } finally {
            $duration = microtime(true) - $startTime;

            $this->metrics->incrementRequests($method, $status, $server);
            $this->metrics->recordRequestDuration($duration, $method, $server);
        }

        return $response;
    }
}
```

## Distributed Logging

### Structured Logging

```php
<?php
// src/Logging/StructuredLogger.php

use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Monolog\Formatter\JsonFormatter;

class StructuredLogger
{
    private Logger $logger;

    public function __construct(string $name = 'mcp-server')
    {
        $this->logger = new Logger($name);

        $handler = new StreamHandler('php://stdout', Logger::INFO);
        $handler->setFormatter(new JsonFormatter());

        $this->logger->pushHandler($handler);
    }

    public function logRequest(array $request, array $context = []): void
    {
        $this->logger->info('MCP Request', [
            'request_id' => $context['request_id'] ?? uniqid(),
            'method' => $request['method'] ?? null,
            'params' => $request['params'] ?? null,
            'timestamp' => time(),
            'memory_usage' => memory_get_usage(true),
            'server' => gethostname(),
        ]);
    }

    public function logResponse(array $response, float $duration, array $context = []): void
    {
        $this->logger->info('MCP Response', [
            'request_id' => $context['request_id'] ?? uniqid(),
            'duration' => $duration,
            'success' => !isset($response['error']),
            'error' => $response['error'] ?? null,
            'timestamp' => time(),
            'server' => gethostname(),
        ]);
    }

    public function logError(Exception $e, array $context = []): void
    {
        $this->logger->error('MCP Error', [
            'request_id' => $context['request_id'] ?? uniqid(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'timestamp' => time(),
            'server' => gethostname(),
        ]);
    }
}
```

### ELK Stack Integration

```yaml
# docker-compose.logging.yml
version: "3.8"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5000:5000"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
```

## Distributed Tracing

### Jaeger Integration

```php
<?php
// src/Tracing/JaegerTracing.php

use Jaeger\Config;
use OpenTracing\GlobalTracer;

class JaegerTracing
{
    public function __construct()
    {
        $config = new Config(
            [
                'sampler' => [
                    'type' => 'const',
                    'param' => true,
                ],
                'logging' => true,
                'dispatch_mode' => 'jaeger_over_binary_udp',
            ],
            'mcp-server'
        );

        $tracer = $config->initializeTracer();
        GlobalTracer::set($tracer);
    }

    public function traceRequest(string $method, callable $handler, array $request): array
    {
        $tracer = GlobalTracer::get();
        $span = $tracer->startSpan("mcp.{$method}");

        $span->setTag('mcp.method', $method);
        $span->setTag('mcp.server', gethostname());

        try {
            $response = $handler($request);
            $span->setTag('mcp.success', true);
            return $response;
        } catch (Exception $e) {
            $span->setTag('mcp.success', false);
            $span->setTag('error', true);
            $span->log(['error' => $e->getMessage()]);
            throw $e;
        } finally {
            $span->finish();
        }
    }
}
```

## Health Checks

### Comprehensive Health Monitoring

```php
<?php
// src/Health/HealthChecker.php

class HealthChecker
{
    private array $checks = [];

    public function addCheck(string $name, callable $check): void
    {
        $this->checks[$name] = $check;
    }

    public function checkHealth(): array
    {
        $results = [];
        $overall = true;

        foreach ($this->checks as $name => $check) {
            $startTime = microtime(true);

            try {
                $result = $check();
                $duration = microtime(true) - $startTime;

                $results[$name] = [
                    'healthy' => true,
                    'duration' => $duration,
                    'details' => $result,
                ];
            } catch (Exception $e) {
                $duration = microtime(true) - $startTime;
                $overall = false;

                $results[$name] = [
                    'healthy' => false,
                    'duration' => $duration,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return [
            'healthy' => $overall,
            'timestamp' => time(),
            'server' => gethostname(),
            'checks' => $results,
        ];
    }
}

// Usage
$healthChecker = new HealthChecker();

$healthChecker->addCheck('database', function () {
    $pdo = new PDO($dsn, $username, $password);
    $stmt = $pdo->query('SELECT 1');
    return ['connection' => 'ok'];
});

$healthChecker->addCheck('redis', function () {
    $redis = new Redis();
    $redis->connect('redis', 6379);
    $redis->ping();
    return ['connection' => 'ok'];
});

$healthChecker->addCheck('memory', function () {
    $usage = memory_get_usage(true);
    $limit = ini_get('memory_limit');

    if ($limit === '-1') {
        return ['usage' => $usage, 'limit' => 'unlimited'];
    }

    $limitBytes = $this->parseBytes($limit);
    $percentage = ($usage / $limitBytes) * 100;

    if ($percentage > 90) {
        throw new Exception("Memory usage too high: {$percentage}%");
    }

    return ['usage' => $usage, 'limit' => $limitBytes, 'percentage' => $percentage];
});
```

## Alerting System

### Alert Manager Configuration

```yaml
# alertmanager.yml
global:
  smtp_smarthost: "localhost:587"
  smtp_from: "alerts@your-company.com"

route:
  group_by: ["alertname"]
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: "web.hook"

receivers:
  - name: "web.hook"
    email_configs:
      - to: "admin@your-company.com"
        subject: "MCP Alert: {{ .GroupLabels.alertname }}"
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    slack_configs:
      - api_url: "YOUR_SLACK_WEBHOOK_URL"
        channel: "#alerts"
        title: "MCP Alert: {{ .GroupLabels.alertname }}"
        text: "{{ range .Alerts }}{{ .Annotations.description }}{{ end }}"
```

### Prometheus Alert Rules

```yaml
# alert-rules.yml
groups:
  - name: mcp-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(mcp_requests_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(mcp_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "95th percentile latency is {{ $value }} seconds"

      - alert: ServiceDown
        expr: up{job="mcp-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MCP service is down"
          description: "MCP server {{ $labels.instance }} is down"

      - alert: HighMemoryUsage
        expr: mcp_memory_usage_bytes / (1024*1024*1024) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}GB"
```

## Dashboard Configuration

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "MCP Server Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(mcp_requests_total[5m])",
            "legendFormat": "{{ method }} - {{ status }}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(mcp_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(mcp_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "mcp_active_connections",
            "legendFormat": "Connections"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "mcp_memory_usage_bytes / (1024*1024)",
            "legendFormat": "Memory (MB)"
          }
        ]
      }
    ]
  }
}
```

## Application Performance Monitoring

### Performance Profiling

```php
<?php
// src/Profiling/PerformanceProfiler.php

class PerformanceProfiler
{
    private array $profiles = [];

    public function startProfile(string $name): void
    {
        $this->profiles[$name] = [
            'start_time' => microtime(true),
            'start_memory' => memory_get_usage(true),
        ];
    }

    public function endProfile(string $name): array
    {
        if (!isset($this->profiles[$name])) {
            throw new InvalidArgumentException("Profile '{$name}' not started");
        }

        $profile = $this->profiles[$name];
        $endTime = microtime(true);
        $endMemory = memory_get_usage(true);

        $result = [
            'name' => $name,
            'duration' => $endTime - $profile['start_time'],
            'memory_used' => $endMemory - $profile['start_memory'],
            'peak_memory' => memory_get_peak_usage(true),
        ];

        unset($this->profiles[$name]);

        return $result;
    }

    public function profileFunction(string $name, callable $function): mixed
    {
        $this->startProfile($name);

        try {
            $result = $function();
            return $result;
        } finally {
            $profile = $this->endProfile($name);
            $this->logProfile($profile);
        }
    }

    private function logProfile(array $profile): void
    {
        error_log(sprintf(
            "Profile: %s - Duration: %.4fs, Memory: %d bytes",
            $profile['name'],
            $profile['duration'],
            $profile['memory_used']
        ));
    }
}
```

## Error Tracking

### Sentry Integration

```php
<?php
// src/ErrorTracking/SentryIntegration.php

use Sentry\ClientBuilder;
use Sentry\State\Scope;

class SentryIntegration
{
    public function __construct(string $dsn)
    {
        $client = ClientBuilder::create(['dsn' => $dsn])->getClient();
        \Sentry\init(['client' => $client]);
    }

    public function captureException(Exception $exception, array $context = []): void
    {
        \Sentry\withScope(function (Scope $scope) use ($exception, $context) {
            $scope->setContext('mcp', $context);
            $scope->setTag('component', 'mcp-server');

            \Sentry\captureException($exception);
        });
    }

    public function captureMessage(string $message, string $level = 'info', array $context = []): void
    {
        \Sentry\withScope(function (Scope $scope) use ($message, $level, $context) {
            $scope->setContext('mcp', $context);
            $scope->setLevel($level);

            \Sentry\captureMessage($message);
        });
    }
}
```

## Log Analysis

### Log Aggregation

```php
<?php
// src/Logging/LogAggregator.php

class LogAggregator
{
    private array $buffer = [];
    private int $bufferSize;
    private string $indexPattern;

    public function __construct(int $bufferSize = 100, string $indexPattern = 'mcp-logs-Y.m.d')
    {
        $this->bufferSize = $bufferSize;
        $this->indexPattern = $indexPattern;
    }

    public function aggregate(array $logEntry): void
    {
        $this->buffer[] = $this->enrichLogEntry($logEntry);

        if (count($this->buffer) >= $this->bufferSize) {
            $this->flush();
        }
    }

    private function enrichLogEntry(array $entry): array
    {
        return array_merge($entry, [
            'timestamp' => time(),
            'server' => gethostname(),
            'process_id' => getmypid(),
            'memory_usage' => memory_get_usage(true),
        ]);
    }

    private function flush(): void
    {
        if (empty($this->buffer)) {
            return;
        }

        $index = date($this->indexPattern);

        // Send to Elasticsearch
        $this->sendToElasticsearch($index, $this->buffer);

        $this->buffer = [];
    }

    private function sendToElasticsearch(string $index, array $logs): void
    {
        // Implementation for sending logs to Elasticsearch
        $client = new \Elasticsearch\Client();

        $body = [];
        foreach ($logs as $log) {
            $body[] = ['index' => ['_index' => $index]];
            $body[] = $log;
        }

        $client->bulk(['body' => $body]);
    }
}
```

## Monitoring Best Practices

### 1. Golden Signals

Monitor the four golden signals:

- **Latency**: Request response times
- **Traffic**: Request rate
- **Errors**: Error rate
- **Saturation**: Resource utilization

### 2. SLA/SLI Definition

```php
<?php
// Define Service Level Indicators (SLIs)
$slis = [
    'availability' => [
        'target' => 99.9, // 99.9% uptime
        'measurement' => 'successful_requests / total_requests * 100'
    ],
    'latency' => [
        'target' => 200, // 200ms for 95th percentile
        'measurement' => 'histogram_quantile(0.95, request_duration)'
    ],
    'error_rate' => [
        'target' => 0.1, // 0.1% error rate
        'measurement' => 'error_requests / total_requests * 100'
    ]
];
```

### 3. Alert Fatigue Prevention

- Use appropriate thresholds
- Implement alert suppression during maintenance
- Group related alerts
- Provide actionable alert descriptions

## Troubleshooting

### Common Monitoring Issues

**High memory usage:**

```bash
# Check for memory leaks
valgrind --tool=memcheck --leak-check=full php server.php

# Monitor memory over time
while true; do
    ps aux | grep php | awk '{print $6}' | head -1
    sleep 1
done
```

**Missing metrics:**

```bash
# Verify Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Check metric endpoint
curl http://localhost:8080/metrics
```

## Next Steps

- [Security & Compliance](security) - Implement security monitoring
- [Scaling & Performance](scaling) - Performance optimization strategies
- [Deployment Strategies](deployment) - Production deployment patterns

Transform your monitoring capabilities with comprehensive observability! 📊
