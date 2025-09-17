# Laravel MCP Client Implementation

Complete guide to implementing MCP clients in Laravel with multiple server connections, caching, and production-ready patterns.

## Multiple Client Configuration

Configure multiple named clients in `config/mcp.php`:

```php
'default_client' => 'main',

'clients' => [
    'main' => [
        'name' => 'Laravel Main Client',
        'version' => '1.0.0',
        'capabilities' => ['roots', 'sampling'],
        'timeout' => 30,
        'retry_attempts' => 3,
    ],

    'external_api' => [
        'name' => 'External API Client',
        'version' => '1.0.0',
        'capabilities' => ['tools', 'resources'],
        'timeout' => 60,
        'retry_attempts' => 5,
        'auth' => [
            'type' => 'bearer',
            'token' => env('EXTERNAL_API_TOKEN'),
        ],
    ],

    'openai_integration' => [
        'name' => 'OpenAI Integration Client',
        'version' => '1.0.0',
        'capabilities' => ['tools', 'resources', 'prompts'],
        'timeout' => 120,
        'auth' => [
            'type' => 'oauth',
            'client_id' => env('OPENAI_CLIENT_ID'),
            'client_secret' => env('OPENAI_CLIENT_SECRET'),
        ],
    ],
],
```

## Using Multiple Clients

### Basic Client Operations

```php
use MCP\Laravel\Facades\McpClient;

// Connect to multiple servers
McpClient::connect('main', 'stdio://./local-server.php');
McpClient::connect('external_api', 'http://api.example.com:3000');
McpClient::connect('openai_integration', 'http://localhost:3001');

// Call tools on different servers
$localResult = McpClient::callTool('main', 'calculate', ['a' => 5, 'b' => 3]);
$apiResult = McpClient::callTool('external_api', 'weather', ['city' => 'London']);
$aiResult = McpClient::callTool('openai_integration', 'analyze_text', ['text' => 'Hello world']);

// List tools from specific client
$tools = McpClient::listTools('external_api');

// Read resources
$configResource = McpClient::readResource('main', 'config://app.name');
$apiResource = McpClient::readResource('external_api', 'data://users/123');

// Get prompts
$prompt = McpClient::getPrompt('openai_integration', 'code_review', [
    'code' => $code,
    'language' => 'php',
]);
```

### Advanced Client Service

```php
<?php

namespace App\Services;

use MCP\Laravel\Facades\McpClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AdvancedMcpClientService
{
    private array $connectionPool = [];
    private array $healthStatus = [];

    /**
     * Initialize client connections with health monitoring
     */
    public function initializeConnections(): void
    {
        $clients = config('mcp.clients', []);

        foreach ($clients as $name => $config) {
            try {
                $this->connectWithRetry($name, $config);
                $this->healthStatus[$name] = 'healthy';
                Log::info("MCP Client connected", ['client' => $name]);
            } catch (\Exception $e) {
                $this->healthStatus[$name] = 'failed';
                Log::error("MCP Client connection failed", [
                    'client' => $name,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Connect with retry logic
     */
    private function connectWithRetry(string $clientName, array $config): void
    {
        $maxRetries = $config['retry_attempts'] ?? 3;
        $retryDelay = 1; // seconds

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $serverUrl = $this->resolveServerUrl($clientName, $config);
                McpClient::connect($clientName, $serverUrl, null, $config['auth'] ?? []);
                return;
            } catch (\Exception $e) {
                if ($attempt === $maxRetries) {
                    throw $e;
                }

                Log::warning("MCP Client connection attempt {$attempt} failed", [
                    'client' => $clientName,
                    'error' => $e->getMessage(),
                ]);

                sleep($retryDelay);
                $retryDelay *= 2; // Exponential backoff
            }
        }
    }

    /**
     * Execute tool with fallback and caching
     */
    public function executeToolWithFallback(string $toolName, array $params, array $clientPriority = null): array
    {
        $clients = $clientPriority ?: $this->getHealthyClients();
        $cacheKey = $this->buildToolCacheKey($toolName, $params);

        // Check cache first
        if ($cached = Cache::get($cacheKey)) {
            return array_merge($cached, ['_cache_hit' => true]);
        }

        $lastException = null;

        foreach ($clients as $clientName) {
            try {
                if (!$this->isClientHealthy($clientName)) {
                    continue;
                }

                $result = McpClient::callTool($clientName, $toolName, $params);

                // Cache successful results
                $ttl = $this->getToolCacheTtl($toolName);
                if ($ttl > 0) {
                    Cache::put($cacheKey, $result, $ttl);
                }

                Log::info("Tool executed successfully", [
                    'tool' => $toolName,
                    'client' => $clientName,
                ]);

                return array_merge($result, [
                    '_client_used' => $clientName,
                    '_cache_hit' => false,
                ]);

            } catch (\Exception $e) {
                $lastException = $e;
                $this->markClientUnhealthy($clientName);

                Log::warning("Tool execution failed, trying next client", [
                    'tool' => $toolName,
                    'client' => $clientName,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        throw new \Exception('All clients failed to execute tool: ' . $lastException?->getMessage());
    }

    /**
     * Batch execute multiple operations
     */
    public function batchExecute(array $operations): array
    {
        $results = [];
        $futures = [];

        foreach ($operations as $id => $operation) {
            $futures[$id] = $this->executeAsync($operation);
        }

        // Wait for all operations to complete
        foreach ($futures as $id => $future) {
            try {
                $results[$id] = $future->await();
            } catch (\Exception $e) {
                $results[$id] = [
                    'error' => $e->getMessage(),
                    'operation' => $operations[$id],
                ];
            }
        }

        return $results;
    }

    /**
     * Execute operation asynchronously
     */
    private function executeAsync(array $operation)
    {
        return \Amp\async(function () use ($operation) {
            switch ($operation['type']) {
                case 'tool':
                    return $this->executeToolWithFallback(
                        $operation['name'],
                        $operation['params'] ?? [],
                        $operation['clients'] ?? null
                    );

                case 'resource':
                    return $this->readResourceWithFallback(
                        $operation['uri'],
                        $operation['clients'] ?? null
                    );

                case 'prompt':
                    return $this->getPromptWithFallback(
                        $operation['name'],
                        $operation['args'] ?? [],
                        $operation['clients'] ?? null
                    );

                default:
                    throw new \InvalidArgumentException("Unknown operation type: {$operation['type']}");
            }
        });
    }

    /**
     * Read resource with fallback
     */
    public function readResourceWithFallback(string $uri, array $clientPriority = null): array
    {
        $clients = $clientPriority ?: $this->getHealthyClients();
        $cacheKey = "resource:" . md5($uri);

        // Check cache first
        if ($cached = Cache::get($cacheKey)) {
            return array_merge($cached, ['_cache_hit' => true]);
        }

        foreach ($clients as $clientName) {
            try {
                if (!$this->isClientHealthy($clientName)) {
                    continue;
                }

                $result = McpClient::readResource($clientName, $uri);

                // Cache successful results
                Cache::put($cacheKey, $result, 900); // 15 minutes

                return array_merge($result, [
                    '_client_used' => $clientName,
                    '_cache_hit' => false,
                ]);

            } catch (\Exception $e) {
                Log::warning("Resource read failed, trying next client", [
                    'uri' => $uri,
                    'client' => $clientName,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        throw new \Exception("All clients failed to read resource: {$uri}");
    }

    /**
     * Stream large resources with progress tracking
     */
    public function streamResource(string $clientName, string $uri, callable $progressCallback = null): \Generator
    {
        if (!$this->isClientHealthy($clientName)) {
            throw new \Exception("Client {$clientName} is not healthy");
        }

        $client = McpClient::get($clientName);

        // For large resources, we might need to implement streaming
        // This is a conceptual implementation
        $totalSize = $this->getResourceSize($clientName, $uri);
        $chunkSize = 8192;
        $downloaded = 0;

        while ($downloaded < $totalSize) {
            $chunk = $this->readResourceChunk($clientName, $uri, $downloaded, $chunkSize);
            $downloaded += strlen($chunk);

            if ($progressCallback) {
                $progressCallback($downloaded, $totalSize);
            }

            yield $chunk;
        }
    }

    /**
     * Health monitoring and recovery
     */
    public function performHealthCheck(): array
    {
        $results = [];
        $clients = array_keys(config('mcp.clients', []));

        foreach ($clients as $clientName) {
            try {
                $startTime = microtime(true);
                McpClient::ping($clientName);
                $responseTime = (microtime(true) - $startTime) * 1000;

                $this->healthStatus[$clientName] = 'healthy';
                $results[$clientName] = [
                    'status' => 'healthy',
                    'response_time_ms' => round($responseTime, 2),
                    'last_check' => now(),
                ];

            } catch (\Exception $e) {
                $this->healthStatus[$clientName] = 'unhealthy';
                $results[$clientName] = [
                    'status' => 'unhealthy',
                    'error' => $e->getMessage(),
                    'last_check' => now(),
                ];
            }
        }

        // Cache health status
        Cache::put('mcp_client_health', $results, 60);

        return $results;
    }

    /**
     * Auto-reconnect unhealthy clients
     */
    public function attemptReconnection(): array
    {
        $results = [];
        $unhealthyClients = array_filter($this->healthStatus, fn($status) => $status !== 'healthy');

        foreach (array_keys($unhealthyClients) as $clientName) {
            try {
                $config = config("mcp.clients.{$clientName}");
                if ($config) {
                    $this->connectWithRetry($clientName, $config);
                    $this->healthStatus[$clientName] = 'healthy';
                    $results[$clientName] = 'reconnected';
                }
            } catch (\Exception $e) {
                $results[$clientName] = 'failed: ' . $e->getMessage();
            }
        }

        return $results;
    }

    /**
     * Get metrics for monitoring
     */
    public function getMetrics(): array
    {
        $clients = array_keys(config('mcp.clients', []));
        $metrics = [
            'total_clients' => count($clients),
            'healthy_clients' => 0,
            'unhealthy_clients' => 0,
            'clients' => [],
        ];

        foreach ($clients as $clientName) {
            $client = McpClient::get($clientName);
            $status = $client->getStatus();

            $clientMetrics = [
                'name' => $clientName,
                'connected' => $status['connected'],
                'requests' => $status['request_count'],
                'errors' => $status['error_count'],
                'last_response_time' => $status['last_response_time'],
                'uptime' => $status['uptime'],
            ];

            $metrics['clients'][$clientName] = $clientMetrics;

            if ($status['connected']) {
                $metrics['healthy_clients']++;
            } else {
                $metrics['unhealthy_clients']++;
            }
        }

        return $metrics;
    }

    // Helper methods
    private function getHealthyClients(): array
    {
        return array_keys(array_filter($this->healthStatus, fn($status) => $status === 'healthy'));
    }

    private function isClientHealthy(string $clientName): bool
    {
        return ($this->healthStatus[$clientName] ?? 'unknown') === 'healthy';
    }

    private function markClientUnhealthy(string $clientName): void
    {
        $this->healthStatus[$clientName] = 'unhealthy';
    }

    private function buildToolCacheKey(string $toolName, array $params): string
    {
        return "tool:{$toolName}:" . md5(serialize($params));
    }

    private function getToolCacheTtl(string $toolName): int
    {
        // Different TTL for different tools
        return match ($toolName) {
            'weather' => 1800,      // 30 minutes
            'database_query' => 300, // 5 minutes
            'file_analysis' => 3600, // 1 hour
            default => 600,          // 10 minutes
        };
    }

    private function resolveServerUrl(string $clientName, array $config): string
    {
        // Resolve server URL from config or service discovery
        return $config['server_url'] ?? env("MCP_{$clientName}_URL", 'http://localhost:3000');
    }
}
```

## Client Middleware and Interceptors

### Request/Response Interceptor

```php
<?php

namespace App\Services\Mcp;

class ClientInterceptor
{
    /**
     * Intercept and modify requests before sending
     */
    public function beforeRequest(string $clientName, string $method, array $params): array
    {
        // Add authentication headers
        if ($auth = $this->getAuthHeaders($clientName)) {
            $params['_headers'] = array_merge($params['_headers'] ?? [], $auth);
        }

        // Add request tracking
        $params['_request_id'] = uniqid('req_');
        $params['_timestamp'] = microtime(true);

        Log::info("MCP Request", [
            'client' => $clientName,
            'method' => $method,
            'request_id' => $params['_request_id'],
        ]);

        return $params;
    }

    /**
     * Intercept and process responses
     */
    public function afterResponse(string $clientName, string $method, array $params, array $response): array
    {
        $requestId = $params['_request_id'] ?? 'unknown';
        $startTime = $params['_timestamp'] ?? microtime(true);
        $duration = microtime(true) - $startTime;

        Log::info("MCP Response", [
            'client' => $clientName,
            'method' => $method,
            'request_id' => $requestId,
            'duration_ms' => round($duration * 1000, 2),
            'response_size' => strlen(json_encode($response)),
        ]);

        // Transform response if needed
        $response['_metadata'] = [
            'client' => $clientName,
            'request_id' => $requestId,
            'duration_ms' => round($duration * 1000, 2),
        ];

        return $response;
    }

    /**
     * Handle request errors
     */
    public function onError(string $clientName, string $method, array $params, \Exception $error): void
    {
        $requestId = $params['_request_id'] ?? 'unknown';

        Log::error("MCP Request Error", [
            'client' => $clientName,
            'method' => $method,
            'request_id' => $requestId,
            'error' => $error->getMessage(),
            'trace' => $error->getTraceAsString(),
        ]);

        // Could trigger alerts, circuit breakers, etc.
        $this->handleErrorRecovery($clientName, $error);
    }

    private function getAuthHeaders(string $clientName): array
    {
        $config = config("mcp.clients.{$clientName}.auth");

        if (!$config) {
            return [];
        }

        return match ($config['type']) {
            'bearer' => ['Authorization' => 'Bearer ' . $config['token']],
            'api_key' => ['X-API-Key' => $config['key']],
            'oauth' => $this->getOAuthHeaders($config),
            default => [],
        };
    }

    private function getOAuthHeaders(array $config): array
    {
        // Implement OAuth token retrieval logic
        $token = Cache::remember("oauth_token_{$config['client_id']}", 3600, function () use ($config) {
            // Get OAuth token
            return $this->getOAuthToken($config);
        });

        return ['Authorization' => 'Bearer ' . $token];
    }

    private function handleErrorRecovery(string $clientName, \Exception $error): void
    {
        // Implement circuit breaker pattern
        $errorCount = Cache::increment("mcp_errors_{$clientName}");

        if ($errorCount > 5) {
            Cache::put("mcp_circuit_breaker_{$clientName}", true, 300); // 5 minutes
            Log::warning("Circuit breaker activated for client", ['client' => $clientName]);
        }
    }
}
```

## Connection Pooling and Load Balancing

### Connection Pool Manager

```php
<?php

namespace App\Services\Mcp;

use Illuminate\Support\Facades\Cache;

class ConnectionPoolManager
{
    private array $pools = [];
    private array $loadBalancers = [];

    /**
     * Initialize connection pools for high-traffic scenarios
     */
    public function initializePools(): void
    {
        $poolConfigs = config('mcp.connection_pools', []);

        foreach ($poolConfigs as $poolName => $config) {
            $this->pools[$poolName] = new ConnectionPool($poolName, $config);
            $this->loadBalancers[$poolName] = new LoadBalancer($config['strategy'] ?? 'round_robin');
        }
    }

    /**
     * Get a connection from the pool
     */
    public function getConnection(string $poolName): ?string
    {
        if (!isset($this->pools[$poolName])) {
            throw new \InvalidArgumentException("Pool {$poolName} not found");
        }

        $pool = $this->pools[$poolName];
        $loadBalancer = $this->loadBalancers[$poolName];

        // Get next client using load balancing strategy
        $clientName = $loadBalancer->getNextClient($pool->getAvailableClients());

        if (!$clientName) {
            Log::warning("No available clients in pool", ['pool' => $poolName]);
            return null;
        }

        // Mark client as in use
        $pool->markClientInUse($clientName);

        return $clientName;
    }

    /**
     * Release connection back to pool
     */
    public function releaseConnection(string $poolName, string $clientName): void
    {
        if (isset($this->pools[$poolName])) {
            $this->pools[$poolName]->releaseClient($clientName);
        }
    }
}

class ConnectionPool
{
    private string $name;
    private array $config;
    private array $clients = [];
    private array $inUse = [];

    public function __construct(string $name, array $config)
    {
        $this->name = $name;
        $this->config = $config;
        $this->initializeClients();
    }

    private function initializeClients(): void
    {
        $clientConfigs = $this->config['clients'] ?? [];

        foreach ($clientConfigs as $clientName => $config) {
            $this->clients[$clientName] = [
                'config' => $config,
                'healthy' => true,
                'last_used' => null,
                'request_count' => 0,
            ];
        }
    }

    public function getAvailableClients(): array
    {
        return array_keys(array_filter($this->clients, function ($client, $name) {
            return $client['healthy'] && !isset($this->inUse[$name]);
        }, ARRAY_FILTER_USE_BOTH));
    }

    public function markClientInUse(string $clientName): void
    {
        $this->inUse[$clientName] = microtime(true);
        $this->clients[$clientName]['last_used'] = microtime(true);
        $this->clients[$clientName]['request_count']++;
    }

    public function releaseClient(string $clientName): void
    {
        unset($this->inUse[$clientName]);
    }
}

class LoadBalancer
{
    private string $strategy;
    private int $roundRobinIndex = 0;

    public function __construct(string $strategy)
    {
        $this->strategy = $strategy;
    }

    public function getNextClient(array $availableClients): ?string
    {
        if (empty($availableClients)) {
            return null;
        }

        return match ($this->strategy) {
            'round_robin' => $this->roundRobin($availableClients),
            'least_connections' => $this->leastConnections($availableClients),
            'random' => $this->random($availableClients),
            'weighted' => $this->weighted($availableClients),
            default => $this->roundRobin($availableClients),
        };
    }

    private function roundRobin(array $clients): string
    {
        $client = $clients[$this->roundRobinIndex % count($clients)];
        $this->roundRobinIndex++;
        return $client;
    }

    private function leastConnections(array $clients): string
    {
        // Implementation would check current connection counts
        return $clients[0]; // Simplified
    }

    private function random(array $clients): string
    {
        return $clients[array_rand($clients)];
    }

    private function weighted(array $clients): string
    {
        // Implementation would use weighted selection
        return $clients[0]; // Simplified
    }
}
```

## Testing Client Implementation

### Unit Tests

```php
<?php

namespace Tests\Unit;

use Tests\TestCase;
use MCP\Laravel\Facades\McpClient;
use MCP\Laravel\Exceptions\ClientNotConnectedException;

class McpClientTest extends TestCase
{
    public function test_client_can_connect_to_server(): void
    {
        McpClient::connect('test', 'stdio://test-server.php');

        $this->assertTrue(McpClient::isConnected('test'));
    }

    public function test_client_throws_exception_when_not_connected(): void
    {
        $this->expectException(ClientNotConnectedException::class);

        McpClient::callTool('nonexistent', 'test_tool', []);
    }

    public function test_client_can_list_server_capabilities(): void
    {
        McpClient::connect('test', 'stdio://test-server.php');

        $capabilities = McpClient::getCapabilities('test');

        $this->assertIsArray($capabilities);
    }

    public function test_client_handles_tool_errors_gracefully(): void
    {
        McpClient::connect('test', 'stdio://test-server.php');

        $result = McpClient::callTool('test', 'nonexistent_tool', []);

        // Should return error instead of throwing exception
        $this->assertArrayHasKey('error', $result);
    }
}
```

### Integration Tests

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Services\AdvancedMcpClientService;

class McpClientIntegrationTest extends TestCase
{
    private AdvancedMcpClientService $clientService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->clientService = app(AdvancedMcpClientService::class);
    }

    public function test_client_service_handles_failover(): void
    {
        // Setup multiple clients with one failing
        $result = $this->clientService->executeToolWithFallback('echo', ['message' => 'test']);

        $this->assertArrayHasKey('_client_used', $result);
        $this->assertNotEmpty($result['content']);
    }

    public function test_batch_execution_works(): void
    {
        $operations = [
            'op1' => ['type' => 'tool', 'name' => 'echo', 'params' => ['message' => 'test1']],
            'op2' => ['type' => 'tool', 'name' => 'echo', 'params' => ['message' => 'test2']],
        ];

        $results = $this->clientService->batchExecute($operations);

        $this->assertCount(2, $results);
        $this->assertArrayHasKey('op1', $results);
        $this->assertArrayHasKey('op2', $results);
    }

    public function test_health_check_monitors_all_clients(): void
    {
        $health = $this->clientService->performHealthCheck();

        $this->assertIsArray($health);

        foreach ($health as $clientName => $status) {
            $this->assertArrayHasKey('status', $status);
            $this->assertContains($status['status'], ['healthy', 'unhealthy']);
        }
    }
}
```

### Performance Tests

```php
<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Services\AdvancedMcpClientService;

class ClientPerformanceTest extends TestCase
{
    public function test_concurrent_client_requests(): void
    {
        $clientService = app(AdvancedMcpClientService::class);

        $start = microtime(true);

        $operations = [];
        for ($i = 0; $i < 50; $i++) {
            $operations["req_{$i}"] = [
                'type' => 'tool',
                'name' => 'echo',
                'params' => ['message' => "test_{$i}"],
            ];
        }

        $results = $clientService->batchExecute($operations);
        $duration = microtime(true) - $start;

        $this->assertCount(50, $results);
        $this->assertLessThan(10.0, $duration, 'Should handle 50 concurrent requests in under 10 seconds');
    }

    public function test_caching_improves_performance(): void
    {
        $clientService = app(AdvancedMcpClientService::class);

        // First call (cache miss)
        $start1 = microtime(true);
        $result1 = $clientService->executeToolWithFallback('weather', ['location' => 'NYC']);
        $time1 = microtime(true) - $start1;

        // Second call (cache hit)
        $start2 = microtime(true);
        $result2 = $clientService->executeToolWithFallback('weather', ['location' => 'NYC']);
        $time2 = microtime(true) - $start2;

        $this->assertLessThan($time1, $time2, 'Cached call should be faster');
        $this->assertTrue($result2['_cache_hit'] ?? false);
    }
}
```

## Monitoring and Observability

### Client Metrics Dashboard

```php
<?php

namespace App\Http\Controllers;

use App\Services\AdvancedMcpClientService;
use Illuminate\Http\Request;

class McpClientDashboardController extends Controller
{
    private AdvancedMcpClientService $clientService;

    public function __construct(AdvancedMcpClientService $clientService)
    {
        $this->clientService = $clientService;
    }

    public function dashboard()
    {
        $metrics = $this->clientService->getMetrics();
        $health = $this->clientService->performHealthCheck();

        return view('mcp.dashboard', compact('metrics', 'health'));
    }

    public function metricsApi(): array
    {
        return [
            'metrics' => $this->clientService->getMetrics(),
            'health' => $this->clientService->performHealthCheck(),
            'timestamp' => now(),
        ];
    }

    public function reconnectUnhealthy()
    {
        $results = $this->clientService->attemptReconnection();

        return response()->json([
            'message' => 'Reconnection attempted',
            'results' => $results,
        ]);
    }
}
```

### Blade Dashboard Template

```php
<!-- resources/views/mcp/dashboard.blade.php -->
@extends('layouts.app')

@section('content')
<div class="container">
    <h1>MCP Client Dashboard</h1>

    <!-- Health Overview -->
    <div class="row mb-4">
        <div class="col-md-3">
            <div class="card bg-success text-white">
                <div class="card-body">
                    <h5>Healthy Clients</h5>
                    <h2>{{ $metrics['healthy_clients'] }}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-danger text-white">
                <div class="card-body">
                    <h5>Unhealthy Clients</h5>
                    <h2>{{ $metrics['unhealthy_clients'] }}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-info text-white">
                <div class="card-body">
                    <h5>Total Requests</h5>
                    <h2>{{ collect($metrics['clients'])->sum('requests') }}</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-warning text-white">
                <div class="card-body">
                    <h5>Total Errors</h5>
                    <h2>{{ collect($metrics['clients'])->sum('errors') }}</h2>
                </div>
            </div>
        </div>
    </div>

    <!-- Client Details -->
    <div class="card">
        <div class="card-header">
            <h5>Client Details</h5>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Status</th>
                            <th>Requests</th>
                            <th>Errors</th>
                            <th>Error Rate</th>
                            <th>Avg Response Time</th>
                            <th>Uptime</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($metrics['clients'] as $name => $client)
                        <tr>
                            <td>{{ $name }}</td>
                            <td>
                                @if($client['connected'])
                                    <span class="badge bg-success">Connected</span>
                                @else
                                    <span class="badge bg-danger">Disconnected</span>
                                @endif
                            </td>
                            <td>{{ number_format($client['requests']) }}</td>
                            <td>{{ number_format($client['errors']) }}</td>
                            <td>
                                @php
                                    $errorRate = $client['requests'] > 0 ? ($client['errors'] / $client['requests']) * 100 : 0;
                                @endphp
                                {{ number_format($errorRate, 2) }}%
                            </td>
                            <td>{{ number_format($client['last_response_time'] * 1000, 2) }}ms</td>
                            <td>
                                @if($client['uptime'])
                                    {{ gmdate('H:i:s', $client['uptime']) }}
                                @else
                                    N/A
                                @endif
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="reconnectClient('{{ $name }}')">
                                    Reconnect
                                </button>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
function reconnectClient(clientName) {
    fetch('/mcp/clients/reconnect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ client: clientName })
    })
    .then(response => response.json())
    .then(data => {
        alert(`Reconnection result: ${data.results[clientName]}`);
        location.reload();
    });
}

// Auto-refresh every 30 seconds
setInterval(() => {
    location.reload();
}, 30000);
</script>
@endsection
```

## See Also

- [Server Implementation](server-implementation.md)
- [OpenAI Integration](openai-integration.md)
- [Caching Best Practices](caching-best-practices.md)
- [API Reference](../api/client.md)
