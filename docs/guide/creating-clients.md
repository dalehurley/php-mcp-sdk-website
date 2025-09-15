# Creating MCP Clients

Learn how to build robust MCP clients that can connect to multiple servers, handle errors gracefully, and provide excellent user experiences.

## Overview

MCP clients are applications that connect to MCP servers to use their tools, resources, and prompts. This guide covers everything from basic client creation to advanced patterns for production applications.

## Basic Client Structure

```php
<?php

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

class MyMcpClient
{
    private Client $client;
    private array $config;

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->client = new Client(
            new Implementation(
                $config['name'] ?? 'my-client',
                $config['version'] ?? '1.0.0',
                $config['description'] ?? 'My MCP Client'
            )
        );
    }

    public function connect(string $serverCommand, array $serverArgs = []): void
    {
        async(function () use ($serverCommand, $serverArgs) {
            $transport = new StdioClientTransport([
                'command' => $serverCommand,
                'args' => $serverArgs
            ]);

            $this->client->connect($transport)->await();
        })->await();
    }

    public function disconnect(): void
    {
        async(function () {
            $this->client->close()->await();
        })->await();
    }
}
```

## Advanced Client Patterns

### Multi-Server Client

```php
class MultiServerClient
{
    private array $clients = [];
    private array $serverConfigs;

    public function __construct(array $serverConfigs)
    {
        $this->serverConfigs = $serverConfigs;
    }

    public function connectAll(): void
    {
        async(function () {
            $promises = [];

            foreach ($this->serverConfigs as $serverId => $config) {
                $promises[$serverId] = $this->connectToServer($serverId, $config);
            }

            $results = Promise::all($promises)->await();

            foreach ($results as $serverId => $client) {
                $this->clients[$serverId] = $client;
                echo "✅ Connected to {$serverId}\n";
            }
        })->await();
    }

    private function connectToServer(string $serverId, array $config): Promise
    {
        return async(function () use ($serverId, $config) {
            $client = new Client(new Implementation('multi-client', '1.0.0'));

            $transport = new StdioClientTransport([
                'command' => $config['command'],
                'args' => $config['args']
            ]);

            $client->connect($transport)->await();
            return $client;
        });
    }

    public function callTool(string $serverId, string $toolName, array $params = []): array
    {
        if (!isset($this->clients[$serverId])) {
            throw new \InvalidArgumentException("Server '{$serverId}' not connected");
        }

        return async(function () use ($serverId, $toolName, $params) {
            return $this->clients[$serverId]->callTool($toolName, $params)->await();
        })->await();
    }
}
```

### Connection Pool Client

```php
class PooledClient
{
    private array $pool = [];
    private int $maxConnections = 10;
    private array $serverConfigs;

    public function __construct(array $serverConfigs, int $maxConnections = 10)
    {
        $this->serverConfigs = $serverConfigs;
        $this->maxConnections = $maxConnections;
    }

    public function getClient(string $serverId): Client
    {
        // Return existing client if available
        if (isset($this->pool[$serverId]) && !empty($this->pool[$serverId])) {
            return array_pop($this->pool[$serverId]);
        }

        // Create new client if under limit
        if ($this->getTotalConnections() < $this->maxConnections) {
            return $this->createClient($serverId);
        }

        throw new \RuntimeException('Connection pool exhausted');
    }

    public function releaseClient(string $serverId, Client $client): void
    {
        if (!isset($this->pool[$serverId])) {
            $this->pool[$serverId] = [];
        }

        $this->pool[$serverId][] = $client;
    }

    private function createClient(string $serverId): Client
    {
        $config = $this->serverConfigs[$serverId];
        $client = new Client(new Implementation('pooled-client', '1.0.0'));

        $transport = new StdioClientTransport([
            'command' => $config['command'],
            'args' => $config['args']
        ]);

        $client->connect($transport)->await();
        return $client;
    }

    private function getTotalConnections(): int
    {
        return array_sum(array_map('count', $this->pool));
    }
}
```

## Error Handling & Resilience

### Retry Logic

```php
class ResilientClient
{
    private Client $client;
    private int $maxRetries;
    private int $baseDelay;

    public function __construct(Client $client, int $maxRetries = 3, int $baseDelay = 1000)
    {
        $this->client = $client;
        $this->maxRetries = $maxRetries;
        $this->baseDelay = $baseDelay;
    }

    public function callToolWithRetry(string $name, array $params = []): Promise
    {
        return async(function () use ($name, $params) {
            $attempt = 0;

            while ($attempt < $this->maxRetries) {
                try {
                    return $this->client->callTool($name, $params)->await();
                } catch (McpError $e) {
                    $attempt++;

                    // Don't retry certain errors
                    if (in_array($e->getCode(), [
                        ErrorCode::MethodNotFound,
                        ErrorCode::InvalidParams,
                        ErrorCode::Forbidden
                    ])) {
                        throw $e;
                    }

                    if ($attempt >= $this->maxRetries) {
                        throw $e;
                    }

                    // Exponential backoff with jitter
                    $delay = $this->baseDelay * pow(2, $attempt - 1);
                    $jitter = rand(0, $delay / 2);
                    delay($delay + $jitter)->await();

                    echo "Retrying tool call (attempt {$attempt}/{$this->maxRetries})\n";
                }
            }
        });
    }
}
```

### Circuit Breaker

```php
class CircuitBreakerClient
{
    private Client $client;
    private array $circuitState = [];
    private int $failureThreshold = 5;
    private int $recoveryTimeout = 60;

    public function callTool(string $name, array $params = []): Promise
    {
        return async(function () use ($name, $params) {
            $circuitKey = "tool:{$name}";

            if ($this->isCircuitOpen($circuitKey)) {
                throw new McpError(
                    ErrorCode::ServiceUnavailable,
                    "Circuit breaker open for tool '{$name}'"
                );
            }

            try {
                $result = $this->client->callTool($name, $params)->await();
                $this->recordSuccess($circuitKey);
                return $result;
            } catch (McpError $e) {
                $this->recordFailure($circuitKey);
                throw $e;
            }
        });
    }

    private function isCircuitOpen(string $circuitKey): bool
    {
        $state = $this->circuitState[$circuitKey] ?? null;

        if (!$state) {
            return false;
        }

        if ($state['failures'] >= $this->failureThreshold) {
            if (time() - $state['last_failure'] > $this->recoveryTimeout) {
                // Try to recover
                unset($this->circuitState[$circuitKey]);
                return false;
            }
            return true;
        }

        return false;
    }

    private function recordFailure(string $circuitKey): void
    {
        if (!isset($this->circuitState[$circuitKey])) {
            $this->circuitState[$circuitKey] = ['failures' => 0, 'last_failure' => 0];
        }

        $this->circuitState[$circuitKey]['failures']++;
        $this->circuitState[$circuitKey]['last_failure'] = time();
    }

    private function recordSuccess(string $circuitKey): void
    {
        unset($this->circuitState[$circuitKey]);
    }
}
```

## Performance Optimization

### Caching Client

```php
class CachingClient
{
    private Client $client;
    private array $cache = [];
    private int $defaultTtl = 300;

    public function callTool(string $name, array $params = [], ?int $ttl = null): Promise
    {
        return async(function () use ($name, $params, $ttl) {
            $cacheKey = $this->generateCacheKey($name, $params);
            $ttl = $ttl ?? $this->defaultTtl;

            // Check cache
            if (isset($this->cache[$cacheKey])) {
                $cached = $this->cache[$cacheKey];
                if (time() - $cached['timestamp'] < $ttl) {
                    return $cached['result'];
                }
            }

            // Call tool and cache result
            $result = $this->client->callTool($name, $params)->await();

            $this->cache[$cacheKey] = [
                'result' => $result,
                'timestamp' => time()
            ];

            return $result;
        });
    }

    private function generateCacheKey(string $name, array $params): string
    {
        return md5($name . ':' . json_encode($params));
    }

    public function clearCache(): void
    {
        $this->cache = [];
    }
}
```

### Batch Operations

```php
class BatchClient
{
    private Client $client;

    public function batchToolCalls(array $calls): Promise
    {
        return async(function () use ($calls) {
            $promises = [];

            foreach ($calls as $index => $call) {
                $promises[$index] = $this->client->callTool(
                    $call['name'],
                    $call['params'] ?? []
                );
            }

            return Promise::all($promises)->await();
        });
    }

    public function batchResourceReads(array $uris): Promise
    {
        return async(function () use ($uris) {
            $promises = [];

            foreach ($uris as $index => $uri) {
                $promises[$index] = $this->client->readResource($uri);
            }

            return Promise::all($promises)->await();
        });
    }
}
```

## Testing Clients

### Mock Server for Testing

```php
class MockMcpServer
{
    private array $tools = [];
    private array $resources = [];

    public function addTool(string $name, callable $handler): void
    {
        $this->tools[$name] = $handler;
    }

    public function addResource(string $uri, callable $handler): void
    {
        $this->resources[$uri] = $handler;
    }

    public function handleRequest(array $request): array
    {
        $method = $request['method'];
        $params = $request['params'] ?? [];

        return match($method) {
            'tools/call' => $this->handleToolCall($params),
            'resources/read' => $this->handleResourceRead($params),
            'tools/list' => $this->handleToolsList(),
            default => throw new McpError(ErrorCode::MethodNotFound, "Method not found: {$method}")
        };
    }

    private function handleToolCall(array $params): array
    {
        $name = $params['name'];

        if (!isset($this->tools[$name])) {
            throw new McpError(ErrorCode::ToolNotFound, "Tool not found: {$name}");
        }

        return $this->tools[$name]($params['arguments'] ?? []);
    }
}
```

### Client Unit Tests

```php
use PHPUnit\Framework\TestCase;

class McpClientTest extends TestCase
{
    private MockMcpServer $mockServer;
    private Client $client;

    protected function setUp(): void
    {
        $this->mockServer = new MockMcpServer();
        $this->client = new Client(new Implementation('test-client', '1.0.0'));
    }

    public function testToolCall(): void
    {
        $this->mockServer->addTool('echo', function ($params) {
            return ['content' => [['type' => 'text', 'text' => $params['message']]]];
        });

        $result = $this->client->callTool('echo', ['message' => 'Hello'])->await();

        $this->assertEquals('Hello', $result['content'][0]['text']);
    }

    public function testErrorHandling(): void
    {
        $this->expectException(McpError::class);

        $this->client->callTool('nonexistent-tool')->await();
    }
}
```

## Complete Client Example

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use function Amp\async;

class ProductionClient
{
    private Client $client;
    private array $serverConfig;
    private bool $connected = false;

    public function __construct(array $serverConfig)
    {
        $this->serverConfig = $serverConfig;
        $this->client = new Client(
            new Implementation('production-client', '1.0.0')
        );
    }

    public function start(): void
    {
        async(function () {
            try {
                echo "🚀 Starting production MCP client...\n";

                // Connect to server
                await $this->connect();

                // Discover capabilities
                await $this->discoverCapabilities();

                // Run main application logic
                await $this->runMainLoop();

            } catch (\Exception $e) {
                echo "❌ Client error: {$e->getMessage()}\n";
            } finally {
                await $this->cleanup();
            }
        })->await();
    }

    private function connect(): Promise
    {
        return async(function () {
            echo "🔌 Connecting to server...\n";

            $transport = new StdioClientTransport([
                'command' => $this->serverConfig['command'],
                'args' => $this->serverConfig['args']
            ]);

            $initResult = $this->client->connect($transport)->await();
            $this->connected = true;

            echo "✅ Connected to {$initResult['serverInfo']['name']}\n";
        });
    }

    private function discoverCapabilities(): Promise
    {
        return async(function () {
            echo "🔍 Discovering server capabilities...\n";

            $tools = $this->client->listTools()->await();
            $resources = $this->client->listResources()->await();
            $prompts = $this->client->listPrompts()->await();

            echo "Found {$tools['tools']->count()} tools, {$resources['resources']->count()} resources, {$prompts['prompts']->count()} prompts\n";
        });
    }

    private function runMainLoop(): Promise
    {
        return async(function () {
            echo "🎯 Running main application logic...\n";

            // Example: Process a workflow
            $result = $this->client->callTool('process_data', [
                'input' => 'sample data'
            ])->await();

            echo "Processing result: {$result['content'][0]['text']}\n";
        });
    }

    private function cleanup(): Promise
    {
        return async(function () {
            if ($this->connected) {
                echo "🔌 Disconnecting...\n";
                $this->client->close()->await();
                echo "✅ Disconnected successfully\n";
            }
        });
    }
}

// Usage
$client = new ProductionClient([
    'command' => 'php',
    'args' => ['server.php']
]);

$client->start();
```

## See Also

- [Client API Reference](../api/client)
- [Transport Options](transports)
- [Error Handling](error-handling)
- [Client Examples](../examples/)
