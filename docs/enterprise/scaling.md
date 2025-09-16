# Scaling & Performance

High-performance deployment strategies and optimization techniques for PHP MCP SDK applications.

## Overview

This guide covers scaling PHP MCP SDK applications from single-server deployments to high-availability, multi-region architectures capable of handling millions of requests.

## Performance Fundamentals

### Benchmarking & Profiling

```php
<?php
// src/Performance/Benchmark.php

class Benchmark
{
    private array $metrics = [];
    private float $startTime;
    private int $startMemory;

    public function start(): void
    {
        $this->startTime = microtime(true);
        $this->startMemory = memory_get_usage(true);
    }

    public function end(string $operation): array
    {
        $endTime = microtime(true);
        $endMemory = memory_get_usage(true);

        $metrics = [
            'operation' => $operation,
            'duration' => $endTime - $this->startTime,
            'memory_used' => $endMemory - $this->startMemory,
            'peak_memory' => memory_get_peak_usage(true),
            'timestamp' => time(),
        ];

        $this->metrics[] = $metrics;
        return $metrics;
    }

    public function benchmarkFunction(string $name, callable $function, int $iterations = 1000): array
    {
        $results = [];

        for ($i = 0; $i < $iterations; $i++) {
            $this->start();
            $function();
            $results[] = $this->end($name);
        }

        return $this->calculateStatistics($results);
    }

    private function calculateStatistics(array $results): array
    {
        $durations = array_column($results, 'duration');
        $memories = array_column($results, 'memory_used');

        return [
            'iterations' => count($results),
            'duration' => [
                'min' => min($durations),
                'max' => max($durations),
                'avg' => array_sum($durations) / count($durations),
                'median' => $this->median($durations),
            ],
            'memory' => [
                'min' => min($memories),
                'max' => max($memories),
                'avg' => array_sum($memories) / count($memories),
            ],
        ];
    }

    private function median(array $values): float
    {
        sort($values);
        $count = count($values);
        $middle = floor($count / 2);

        if ($count % 2 === 0) {
            return ($values[$middle - 1] + $values[$middle]) / 2;
        }

        return $values[$middle];
    }
}
```

### Performance Profiler

```php
<?php
// src/Performance/Profiler.php

class Profiler
{
    private array $profiles = [];
    private bool $enabled = true;

    public function profile(string $name, callable $callback)
    {
        if (!$this->enabled) {
            return $callback();
        }

        $startTime = microtime(true);
        $startMemory = memory_get_usage();

        try {
            $result = $callback();
        } finally {
            $endTime = microtime(true);
            $endMemory = memory_get_usage();

            $this->profiles[] = [
                'name' => $name,
                'duration' => $endTime - $startTime,
                'memory' => $endMemory - $startMemory,
                'timestamp' => time(),
            ];
        }

        return $result;
    }

    public function getProfiles(): array
    {
        return $this->profiles;
    }

    public function reset(): void
    {
        $this->profiles = [];
    }

    public function generateReport(): array
    {
        $grouped = [];

        foreach ($this->profiles as $profile) {
            $name = $profile['name'];

            if (!isset($grouped[$name])) {
                $grouped[$name] = [
                    'count' => 0,
                    'total_duration' => 0,
                    'total_memory' => 0,
                    'durations' => [],
                ];
            }

            $grouped[$name]['count']++;
            $grouped[$name]['total_duration'] += $profile['duration'];
            $grouped[$name]['total_memory'] += $profile['memory'];
            $grouped[$name]['durations'][] = $profile['duration'];
        }

        foreach ($grouped as $name => &$data) {
            $data['avg_duration'] = $data['total_duration'] / $data['count'];
            $data['avg_memory'] = $data['total_memory'] / $data['count'];

            sort($data['durations']);
            $count = count($data['durations']);
            $data['median_duration'] = $count % 2 === 0
                ? ($data['durations'][$count / 2 - 1] + $data['durations'][$count / 2]) / 2
                : $data['durations'][floor($count / 2)];
        }

        return $grouped;
    }
}
```

## Caching Strategies

### Multi-Layer Caching

```php
<?php
// src/Cache/CacheManager.php

class CacheManager
{
    private array $layers = [];
    private array $stats = [];

    public function addLayer(string $name, CacheInterface $cache, int $ttl = 3600): void
    {
        $this->layers[$name] = [
            'cache' => $cache,
            'ttl' => $ttl,
        ];

        $this->stats[$name] = [
            'hits' => 0,
            'misses' => 0,
            'sets' => 0,
        ];
    }

    public function get(string $key): mixed
    {
        foreach ($this->layers as $name => $layer) {
            $value = $layer['cache']->get($key);

            if ($value !== null) {
                $this->stats[$name]['hits']++;

                // Populate higher-priority layers
                $this->populateUpstream($key, $value, $name);

                return $value;
            }

            $this->stats[$name]['misses']++;
        }

        return null;
    }

    public function set(string $key, mixed $value): bool
    {
        $success = true;

        foreach ($this->layers as $name => $layer) {
            $result = $layer['cache']->set($key, $value, $layer['ttl']);
            $success = $success && $result;

            if ($result) {
                $this->stats[$name]['sets']++;
            }
        }

        return $success;
    }

    public function remember(string $key, callable $callback): mixed
    {
        $value = $this->get($key);

        if ($value === null) {
            $value = $callback();
            $this->set($key, $value);
        }

        return $value;
    }

    private function populateUpstream(string $key, mixed $value, string $currentLayer): void
    {
        $found = false;

        foreach ($this->layers as $name => $layer) {
            if ($name === $currentLayer) {
                $found = true;
                continue;
            }

            if (!$found) {
                $layer['cache']->set($key, $value, $layer['ttl']);
            }
        }
    }

    public function getStats(): array
    {
        $totalStats = [];

        foreach ($this->stats as $name => $stats) {
            $total = $stats['hits'] + $stats['misses'];
            $hitRate = $total > 0 ? ($stats['hits'] / $total) * 100 : 0;

            $totalStats[$name] = array_merge($stats, [
                'hit_rate' => $hitRate,
                'total_requests' => $total,
            ]);
        }

        return $totalStats;
    }
}
```

### Redis Cache Implementation

```php
<?php
// src/Cache/RedisCache.php

class RedisCache implements CacheInterface
{
    private Redis $redis;
    private string $prefix;

    public function __construct(Redis $redis, string $prefix = 'mcp:')
    {
        $this->redis = $redis;
        $this->prefix = $prefix;
    }

    public function get(string $key): mixed
    {
        $value = $this->redis->get($this->prefix . $key);

        if ($value === false) {
            return null;
        }

        return unserialize($value);
    }

    public function set(string $key, mixed $value, int $ttl = 3600): bool
    {
        return $this->redis->setex(
            $this->prefix . $key,
            $ttl,
            serialize($value)
        );
    }

    public function delete(string $key): bool
    {
        return $this->redis->del($this->prefix . $key) > 0;
    }

    public function flush(): bool
    {
        $keys = $this->redis->keys($this->prefix . '*');

        if (empty($keys)) {
            return true;
        }

        return $this->redis->del($keys) > 0;
    }

    public function increment(string $key, int $value = 1): int
    {
        return $this->redis->incrBy($this->prefix . $key, $value);
    }

    public function decrement(string $key, int $value = 1): int
    {
        return $this->redis->decrBy($this->prefix . $key, $value);
    }
}
```

## Connection Pooling

### Database Connection Pool

```php
<?php
// src/Database/ConnectionPool.php

class ConnectionPool
{
    private array $connections = [];
    private array $config;
    private int $maxConnections;
    private int $currentConnections = 0;

    public function __construct(array $config, int $maxConnections = 10)
    {
        $this->config = $config;
        $this->maxConnections = $maxConnections;
    }

    public function getConnection(): PDO
    {
        // Try to get an available connection
        foreach ($this->connections as $id => $connection) {
            if (!$connection['in_use']) {
                $this->connections[$id]['in_use'] = true;
                $this->connections[$id]['last_used'] = time();
                return $connection['pdo'];
            }
        }

        // Create new connection if under limit
        if ($this->currentConnections < $this->maxConnections) {
            return $this->createConnection();
        }

        // Wait for available connection
        return $this->waitForConnection();
    }

    public function releaseConnection(PDO $pdo): void
    {
        foreach ($this->connections as $id => &$connection) {
            if ($connection['pdo'] === $pdo) {
                $connection['in_use'] = false;
                $connection['last_used'] = time();
                break;
            }
        }
    }

    private function createConnection(): PDO
    {
        $dsn = "mysql:host={$this->config['host']};dbname={$this->config['database']};charset=utf8mb4";

        $pdo = new PDO(
            $dsn,
            $this->config['username'],
            $this->config['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_PERSISTENT => false,
            ]
        );

        $id = uniqid();
        $this->connections[$id] = [
            'pdo' => $pdo,
            'in_use' => true,
            'created_at' => time(),
            'last_used' => time(),
        ];

        $this->currentConnections++;

        return $pdo;
    }

    private function waitForConnection(): PDO
    {
        $maxWait = 30; // 30 seconds
        $startTime = time();

        while ((time() - $startTime) < $maxWait) {
            foreach ($this->connections as $id => $connection) {
                if (!$connection['in_use']) {
                    $this->connections[$id]['in_use'] = true;
                    $this->connections[$id]['last_used'] = time();
                    return $connection['pdo'];
                }
            }

            usleep(100000); // Wait 100ms
        }

        throw new RuntimeException('Timeout waiting for database connection');
    }

    public function closeIdleConnections(int $maxIdleTime = 300): void
    {
        $now = time();

        foreach ($this->connections as $id => $connection) {
            if (!$connection['in_use'] && ($now - $connection['last_used']) > $maxIdleTime) {
                unset($this->connections[$id]);
                $this->currentConnections--;
            }
        }
    }

    public function getStats(): array
    {
        return [
            'total_connections' => $this->currentConnections,
            'max_connections' => $this->maxConnections,
            'active_connections' => count(array_filter($this->connections, fn($c) => $c['in_use'])),
            'idle_connections' => count(array_filter($this->connections, fn($c) => !$c['in_use'])),
        ];
    }
}
```

## Load Balancing

### Application Load Balancer

```php
<?php
// src/LoadBalancer/LoadBalancer.php

class LoadBalancer
{
    private array $servers = [];
    private string $algorithm;
    private array $stats = [];

    public function __construct(string $algorithm = 'round_robin')
    {
        $this->algorithm = $algorithm;
    }

    public function addServer(string $id, string $host, int $port, int $weight = 1): void
    {
        $this->servers[$id] = [
            'host' => $host,
            'port' => $port,
            'weight' => $weight,
            'healthy' => true,
            'connections' => 0,
            'response_time' => 0,
            'last_check' => time(),
        ];

        $this->stats[$id] = [
            'requests' => 0,
            'errors' => 0,
            'total_response_time' => 0,
        ];
    }

    public function getServer(): array
    {
        $healthyServers = array_filter($this->servers, fn($server) => $server['healthy']);

        if (empty($healthyServers)) {
            throw new RuntimeException('No healthy servers available');
        }

        switch ($this->algorithm) {
            case 'round_robin':
                return $this->roundRobin($healthyServers);
            case 'weighted':
                return $this->weighted($healthyServers);
            case 'least_connections':
                return $this->leastConnections($healthyServers);
            case 'fastest_response':
                return $this->fastestResponse($healthyServers);
            default:
                throw new InvalidArgumentException("Unknown algorithm: {$this->algorithm}");
        }
    }

    private function roundRobin(array $servers): array
    {
        static $current = 0;

        $serverIds = array_keys($servers);
        $serverId = $serverIds[$current % count($serverIds)];
        $current++;

        return ['id' => $serverId] + $servers[$serverId];
    }

    private function weighted(array $servers): array
    {
        $totalWeight = array_sum(array_column($servers, 'weight'));
        $random = mt_rand(1, $totalWeight);

        $currentWeight = 0;
        foreach ($servers as $id => $server) {
            $currentWeight += $server['weight'];
            if ($random <= $currentWeight) {
                return ['id' => $id] + $server;
            }
        }

        // Fallback to first server
        $firstId = array_key_first($servers);
        return ['id' => $firstId] + $servers[$firstId];
    }

    private function leastConnections(array $servers): array
    {
        $minConnections = min(array_column($servers, 'connections'));

        $candidates = array_filter($servers, fn($server) => $server['connections'] === $minConnections);

        $serverId = array_rand($candidates);
        return ['id' => $serverId] + $candidates[$serverId];
    }

    private function fastestResponse(array $servers): array
    {
        $minResponseTime = min(array_column($servers, 'response_time'));

        $candidates = array_filter($servers, fn($server) => $server['response_time'] === $minResponseTime);

        $serverId = array_rand($candidates);
        return ['id' => $serverId] + $candidates[$serverId];
    }

    public function recordRequest(string $serverId, float $responseTime, bool $success = true): void
    {
        if (isset($this->stats[$serverId])) {
            $this->stats[$serverId]['requests']++;
            $this->stats[$serverId]['total_response_time'] += $responseTime;

            if (!$success) {
                $this->stats[$serverId]['errors']++;
            }
        }

        if (isset($this->servers[$serverId])) {
            $this->servers[$serverId]['response_time'] = $responseTime;
        }
    }

    public function healthCheck(): void
    {
        foreach ($this->servers as $id => &$server) {
            $healthy = $this->checkServerHealth($server['host'], $server['port']);
            $server['healthy'] = $healthy;
            $server['last_check'] = time();
        }
    }

    private function checkServerHealth(string $host, int $port): bool
    {
        $connection = @fsockopen($host, $port, $errno, $errstr, 5);

        if ($connection) {
            fclose($connection);
            return true;
        }

        return false;
    }

    public function getStats(): array
    {
        $stats = [];

        foreach ($this->stats as $id => $serverStats) {
            $avgResponseTime = $serverStats['requests'] > 0
                ? $serverStats['total_response_time'] / $serverStats['requests']
                : 0;

            $errorRate = $serverStats['requests'] > 0
                ? ($serverStats['errors'] / $serverStats['requests']) * 100
                : 0;

            $stats[$id] = array_merge($serverStats, [
                'avg_response_time' => $avgResponseTime,
                'error_rate' => $errorRate,
                'healthy' => $this->servers[$id]['healthy'],
            ]);
        }

        return $stats;
    }
}
```

## Auto-Scaling

### Kubernetes HPA Configuration

```yaml
# kubernetes/hpa.yaml
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
  maxReplicas: 50
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
    - type: Pods
      pods:
        metric:
          name: mcp_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### Custom Metrics Auto-Scaler

```php
<?php
// src/Scaling/AutoScaler.php

class AutoScaler
{
    private array $metrics = [];
    private array $rules = [];
    private callable $scaleCallback;

    public function __construct(callable $scaleCallback)
    {
        $this->scaleCallback = $scaleCallback;
    }

    public function addRule(string $name, array $rule): void
    {
        $this->rules[$name] = $rule;
    }

    public function recordMetric(string $name, float $value): void
    {
        if (!isset($this->metrics[$name])) {
            $this->metrics[$name] = [];
        }

        $this->metrics[$name][] = [
            'value' => $value,
            'timestamp' => time(),
        ];

        // Keep only last 100 measurements
        if (count($this->metrics[$name]) > 100) {
            array_shift($this->metrics[$name]);
        }
    }

    public function evaluate(): array
    {
        $decisions = [];

        foreach ($this->rules as $name => $rule) {
            $decision = $this->evaluateRule($name, $rule);
            if ($decision['action'] !== 'none') {
                $decisions[] = $decision;
            }
        }

        return $decisions;
    }

    private function evaluateRule(string $name, array $rule): array
    {
        $metric = $rule['metric'];
        $threshold = $rule['threshold'];
        $action = $rule['action'];
        $cooldown = $rule['cooldown'] ?? 300; // 5 minutes

        if (!isset($this->metrics[$metric])) {
            return ['rule' => $name, 'action' => 'none', 'reason' => 'No metric data'];
        }

        // Check cooldown
        if (isset($rule['last_action']) && (time() - $rule['last_action']) < $cooldown) {
            return ['rule' => $name, 'action' => 'none', 'reason' => 'Cooldown period'];
        }

        $recentMetrics = array_filter(
            $this->metrics[$metric],
            fn($m) => (time() - $m['timestamp']) <= ($rule['window'] ?? 300)
        );

        if (empty($recentMetrics)) {
            return ['rule' => $name, 'action' => 'none', 'reason' => 'No recent data'];
        }

        $average = array_sum(array_column($recentMetrics, 'value')) / count($recentMetrics);

        $shouldScale = match ($rule['operator'] ?? '>') {
            '>' => $average > $threshold,
            '<' => $average < $threshold,
            '>=' => $average >= $threshold,
            '<=' => $average <= $threshold,
            default => false,
        };

        if ($shouldScale) {
            $this->rules[$name]['last_action'] = time();

            // Execute scaling action
            ($this->scaleCallback)($action, [
                'rule' => $name,
                'metric' => $metric,
                'current_value' => $average,
                'threshold' => $threshold,
            ]);

            return [
                'rule' => $name,
                'action' => $action,
                'metric' => $metric,
                'current_value' => $average,
                'threshold' => $threshold,
                'reason' => 'Threshold exceeded',
            ];
        }

        return ['rule' => $name, 'action' => 'none', 'reason' => 'Threshold not met'];
    }
}
```

## Database Optimization

### Query Optimization

```php
<?php
// src/Database/QueryOptimizer.php

class QueryOptimizer
{
    private PDO $pdo;
    private array $queryCache = [];
    private array $indexHints = [];

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function optimizeQuery(string $sql, array $params = []): array
    {
        $queryHash = md5($sql . serialize($params));

        if (isset($this->queryCache[$queryHash])) {
            return $this->queryCache[$queryHash];
        }

        // Analyze query plan
        $explainSql = "EXPLAIN " . $sql;
        $stmt = $this->pdo->prepare($explainSql);
        $stmt->execute($params);
        $plan = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Suggest optimizations
        $suggestions = $this->analyzePlan($plan);

        $result = [
            'original_sql' => $sql,
            'plan' => $plan,
            'suggestions' => $suggestions,
            'optimized_sql' => $this->applyOptimizations($sql, $suggestions),
        ];

        $this->queryCache[$queryHash] = $result;

        return $result;
    }

    private function analyzePlan(array $plan): array
    {
        $suggestions = [];

        foreach ($plan as $row) {
            // Check for full table scans
            if ($row['type'] === 'ALL' && $row['rows'] > 1000) {
                $suggestions[] = [
                    'type' => 'index',
                    'message' => "Consider adding an index on {$row['table']}.{$row['key']}",
                    'severity' => 'high',
                ];
            }

            // Check for filesort
            if (str_contains($row['Extra'] ?? '', 'Using filesort')) {
                $suggestions[] = [
                    'type' => 'index',
                    'message' => "Consider adding an index to avoid filesort on {$row['table']}",
                    'severity' => 'medium',
                ];
            }

            // Check for temporary tables
            if (str_contains($row['Extra'] ?? '', 'Using temporary')) {
                $suggestions[] = [
                    'type' => 'query',
                    'message' => "Query creates temporary table, consider optimization",
                    'severity' => 'medium',
                ];
            }
        }

        return $suggestions;
    }

    private function applyOptimizations(string $sql, array $suggestions): string
    {
        $optimizedSql = $sql;

        foreach ($suggestions as $suggestion) {
            switch ($suggestion['type']) {
                case 'index_hint':
                    $optimizedSql = $this->addIndexHint($optimizedSql, $suggestion['hint']);
                    break;
                case 'limit':
                    $optimizedSql = $this->addLimit($optimizedSql, $suggestion['limit']);
                    break;
            }
        }

        return $optimizedSql;
    }

    public function createIndex(string $table, array $columns, string $type = 'INDEX'): bool
    {
        $indexName = $table . '_' . implode('_', $columns) . '_idx';
        $columnList = implode(', ', array_map(fn($col) => "`{$col}`", $columns));

        $sql = "CREATE {$type} `{$indexName}` ON `{$table}` ({$columnList})";

        try {
            $this->pdo->exec($sql);
            return true;
        } catch (PDOException $e) {
            error_log("Failed to create index: " . $e->getMessage());
            return false;
        }
    }

    public function analyzeTable(string $table): array
    {
        $sql = "ANALYZE TABLE `{$table}`";
        $stmt = $this->pdo->query($sql);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSlowQueries(int $limit = 10): array
    {
        $sql = "
            SELECT query_time, lock_time, rows_sent, rows_examined, sql_text
            FROM mysql.slow_log
            ORDER BY query_time DESC
            LIMIT {$limit}
        ";

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
```

## Memory Management

### Memory Pool

```php
<?php
// src/Memory/MemoryPool.php

class MemoryPool
{
    private array $pools = [];
    private array $stats = [];

    public function createPool(string $name, int $blockSize, int $blockCount): void
    {
        $this->pools[$name] = [
            'block_size' => $blockSize,
            'block_count' => $blockCount,
            'available' => range(0, $blockCount - 1),
            'allocated' => [],
            'memory' => str_repeat("\0", $blockSize * $blockCount),
        ];

        $this->stats[$name] = [
            'allocations' => 0,
            'deallocations' => 0,
            'peak_usage' => 0,
            'current_usage' => 0,
        ];
    }

    public function allocate(string $poolName): ?int
    {
        if (!isset($this->pools[$poolName])) {
            throw new InvalidArgumentException("Pool '{$poolName}' does not exist");
        }

        $pool = &$this->pools[$poolName];

        if (empty($pool['available'])) {
            return null; // Pool exhausted
        }

        $blockId = array_shift($pool['available']);
        $pool['allocated'][$blockId] = time();

        $this->stats[$poolName]['allocations']++;
        $this->stats[$poolName]['current_usage']++;
        $this->stats[$poolName]['peak_usage'] = max(
            $this->stats[$poolName]['peak_usage'],
            $this->stats[$poolName]['current_usage']
        );

        return $blockId;
    }

    public function deallocate(string $poolName, int $blockId): bool
    {
        if (!isset($this->pools[$poolName])) {
            return false;
        }

        $pool = &$this->pools[$poolName];

        if (!isset($pool['allocated'][$blockId])) {
            return false;
        }

        unset($pool['allocated'][$blockId]);
        $pool['available'][] = $blockId;

        $this->stats[$poolName]['deallocations']++;
        $this->stats[$poolName]['current_usage']--;

        return true;
    }

    public function getMemoryAddress(string $poolName, int $blockId): int
    {
        if (!isset($this->pools[$poolName])) {
            throw new InvalidArgumentException("Pool '{$poolName}' does not exist");
        }

        $pool = $this->pools[$poolName];

        return $blockId * $pool['block_size'];
    }

    public function writeToBlock(string $poolName, int $blockId, string $data): bool
    {
        if (!isset($this->pools[$poolName])) {
            return false;
        }

        $pool = &$this->pools[$poolName];

        if (!isset($pool['allocated'][$blockId])) {
            return false;
        }

        if (strlen($data) > $pool['block_size']) {
            return false;
        }

        $offset = $blockId * $pool['block_size'];

        for ($i = 0; $i < strlen($data); $i++) {
            $pool['memory'][$offset + $i] = $data[$i];
        }

        return true;
    }

    public function readFromBlock(string $poolName, int $blockId, int $length = null): string
    {
        if (!isset($this->pools[$poolName])) {
            return '';
        }

        $pool = $this->pools[$poolName];

        if (!isset($pool['allocated'][$blockId])) {
            return '';
        }

        $offset = $blockId * $pool['block_size'];
        $length = $length ?? $pool['block_size'];

        return substr($pool['memory'], $offset, $length);
    }

    public function getPoolStats(string $poolName): array
    {
        if (!isset($this->pools[$poolName])) {
            return [];
        }

        $pool = $this->pools[$poolName];
        $stats = $this->stats[$poolName];

        return [
            'block_size' => $pool['block_size'],
            'block_count' => $pool['block_count'],
            'available_blocks' => count($pool['available']),
            'allocated_blocks' => count($pool['allocated']),
            'utilization' => (count($pool['allocated']) / $pool['block_count']) * 100,
            'stats' => $stats,
        ];
    }
}
```

## CDN Integration

### CDN Manager

```php
<?php
// src/CDN/CdnManager.php

class CdnManager
{
    private array $providers = [];
    private string $defaultProvider;

    public function addProvider(string $name, CdnProviderInterface $provider): void
    {
        $this->providers[$name] = $provider;

        if (!isset($this->defaultProvider)) {
            $this->defaultProvider = $name;
        }
    }

    public function upload(string $file, string $path, string $provider = null): string
    {
        $provider = $provider ?? $this->defaultProvider;

        if (!isset($this->providers[$provider])) {
            throw new InvalidArgumentException("Provider '{$provider}' not found");
        }

        return $this->providers[$provider]->upload($file, $path);
    }

    public function getUrl(string $path, string $provider = null): string
    {
        $provider = $provider ?? $this->defaultProvider;

        if (!isset($this->providers[$provider])) {
            throw new InvalidArgumentException("Provider '{$provider}' not found");
        }

        return $this->providers[$provider]->getUrl($path);
    }

    public function invalidate(array $paths, string $provider = null): bool
    {
        $provider = $provider ?? $this->defaultProvider;

        if (!isset($this->providers[$provider])) {
            return false;
        }

        return $this->providers[$provider]->invalidate($paths);
    }

    public function getStats(string $provider = null): array
    {
        $provider = $provider ?? $this->defaultProvider;

        if (!isset($this->providers[$provider])) {
            return [];
        }

        return $this->providers[$provider]->getStats();
    }
}

interface CdnProviderInterface
{
    public function upload(string $file, string $path): string;
    public function getUrl(string $path): string;
    public function invalidate(array $paths): bool;
    public function getStats(): array;
}
```

## Performance Monitoring

### Real-time Metrics

```php
<?php
// src/Monitoring/RealTimeMetrics.php

class RealTimeMetrics
{
    private Redis $redis;
    private string $prefix;

    public function __construct(Redis $redis, string $prefix = 'metrics:')
    {
        $this->redis = $redis;
        $this->prefix = $prefix;
    }

    public function recordMetric(string $name, float $value, array $tags = []): void
    {
        $timestamp = time();
        $key = $this->prefix . $name;

        // Store time series data
        $this->redis->zadd($key, $timestamp, json_encode([
            'value' => $value,
            'tags' => $tags,
            'timestamp' => $timestamp,
        ]));

        // Keep only last hour of data
        $this->redis->zremrangebyscore($key, 0, $timestamp - 3600);

        // Update aggregated metrics
        $this->updateAggregates($name, $value, $tags);
    }

    public function getMetrics(string $name, int $startTime, int $endTime): array
    {
        $key = $this->prefix . $name;

        $data = $this->redis->zrangebyscore($key, $startTime, $endTime);

        return array_map(fn($item) => json_decode($item, true), $data);
    }

    public function getAggregates(string $name, int $window = 300): array
    {
        $now = time();
        $startTime = $now - $window;

        $metrics = $this->getMetrics($name, $startTime, $now);

        if (empty($metrics)) {
            return ['count' => 0, 'avg' => 0, 'min' => 0, 'max' => 0];
        }

        $values = array_column($metrics, 'value');

        return [
            'count' => count($values),
            'avg' => array_sum($values) / count($values),
            'min' => min($values),
            'max' => max($values),
            'sum' => array_sum($values),
        ];
    }

    private function updateAggregates(string $name, float $value, array $tags): void
    {
        $minute = floor(time() / 60) * 60;

        // Update per-minute aggregates
        $aggregateKey = $this->prefix . 'agg:' . $name . ':' . $minute;

        $this->redis->multi();
        $this->redis->hincrby($aggregateKey, 'count', 1);
        $this->redis->hincrbyfloat($aggregateKey, 'sum', $value);
        $this->redis->expire($aggregateKey, 86400); // Keep for 24 hours
        $this->redis->exec();

        // Update min/max
        $current = $this->redis->hgetall($aggregateKey);

        if (!isset($current['min']) || $value < (float)$current['min']) {
            $this->redis->hset($aggregateKey, 'min', $value);
        }

        if (!isset($current['max']) || $value > (float)$current['max']) {
            $this->redis->hset($aggregateKey, 'max', $value);
        }
    }

    public function getTopMetrics(int $limit = 10): array
    {
        $pattern = $this->prefix . '*';
        $keys = $this->redis->keys($pattern);

        $metrics = [];

        foreach ($keys as $key) {
            if (strpos($key, ':agg:') !== false) {
                continue;
            }

            $name = str_replace($this->prefix, '', $key);
            $count = $this->redis->zcard($key);

            if ($count > 0) {
                $metrics[$name] = $count;
            }
        }

        arsort($metrics);

        return array_slice($metrics, 0, $limit, true);
    }
}
```

## Best Practices

### 1. Performance Optimization

- Profile before optimizing
- Use appropriate caching strategies
- Optimize database queries
- Implement connection pooling

### 2. Scaling Strategies

- Plan for horizontal scaling
- Use load balancers effectively
- Implement auto-scaling
- Monitor resource utilization

### 3. Resource Management

- Manage memory efficiently
- Use connection pools
- Implement proper cleanup
- Monitor resource leaks

## Next Steps

- [Deployment Strategies](deployment) - Production deployment patterns
- [Monitoring & Observability](monitoring) - Performance monitoring
- [Security & Compliance](security) - Security considerations for scaling

Scale your PHP MCP SDK applications to handle millions of requests! 🚀

