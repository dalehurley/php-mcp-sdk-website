# Client API Reference

Complete reference for creating and managing MCP clients with the PHP MCP SDK.

## Client Class

The main class for creating MCP clients that connect to MCP servers.

### Constructor

```php
public function __construct(Implementation $implementation)
```

Creates a new MCP client with the specified implementation details.

**Parameters:**

- `$implementation` - Client identification and metadata

**Example:**

```php
use MCP\Client\Client;
use MCP\Types\Implementation;

$client = new Client(
    new Implementation(
        'my-client',           // name
        '1.0.0',              // version
        'My MCP Client'       // description (optional)
    )
);
```

## Connection Management

### connect()

```php
public function connect(Transport $transport): Promise
```

Connects the client to an MCP server through a transport layer.

**Parameters:**

- `$transport` - Transport implementation (STDIO, HTTP, WebSocket)

**Returns:** Promise that resolves when connection is established

**Example:**

```php
use MCP\Client\Transport\StdioClientTransport;
use function Amp\async;

async(function () use ($client) {
    $transport = new StdioClientTransport([
        'command' => 'php',
        'args' => ['server.php']
    ]);

    $client->connect($transport)->await();
})->await();
```

### close()

```php
public function close(): Promise
```

Closes the connection to the server and cleans up resources.

**Returns:** Promise that resolves when connection is closed

**Example:**

```php
async(function () use ($client) {
    $client->close()->await();
})->await();
```

## Server Discovery

### initialize()

```php
public function initialize(): Promise
```

Initializes the connection and exchanges capability information with the server.

**Returns:** Promise resolving to initialization result with server info

**Example:**

```php
async(function () use ($client, $transport) {
    $initResult = $client->connect($transport)->await();

    echo "Connected to: {$initResult['serverInfo']['name']}\n";
    echo "Version: {$initResult['serverInfo']['version']}\n";
})->await();
```

### listTools()

```php
public function listTools(): Promise
```

Retrieves the list of available tools from the server.

**Returns:** Promise resolving to array of tool definitions

**Example:**

```php
async(function () use ($client) {
    $result = $client->listTools()->await();

    foreach ($result['tools'] as $tool) {
        echo "Tool: {$tool['name']} - {$tool['description']}\n";
    }
})->await();
```

### listResources()

```php
public function listResources(): Promise
```

Retrieves the list of available resources from the server.

**Returns:** Promise resolving to array of resource definitions

**Example:**

```php
async(function () use ($client) {
    $result = $client->listResources()->await();

    foreach ($result['resources'] as $resource) {
        echo "Resource: {$resource['uri']} - {$resource['name']}\n";
    }
})->await();
```

### listPrompts()

```php
public function listPrompts(): Promise
```

Retrieves the list of available prompts from the server.

**Returns:** Promise resolving to array of prompt definitions

**Example:**

```php
async(function () use ($client) {
    $result = $client->listPrompts()->await();

    foreach ($result['prompts'] as $prompt) {
        echo "Prompt: {$prompt['name']} - {$prompt['description']}\n";
    }
})->await();
```

## Tool Execution

### callTool()

```php
public function callTool(string $name, array $arguments = []): Promise
```

Calls a tool on the server with the specified arguments.

**Parameters:**

- `$name` - Name of the tool to call
- `$arguments` - Arguments to pass to the tool

**Returns:** Promise resolving to tool execution result

**Example:**

```php
async(function () use ($client) {
    $result = $client->callTool('calculate', [
        'expression' => '2 + 2'
    ])->await();

    echo "Result: {$result['content'][0]['text']}\n";
})->await();
```

### callToolWithProgress()

```php
public function callToolWithProgress(
    string $name,
    array $arguments = [],
    callable $progressCallback = null
): Promise
```

Calls a tool with progress reporting support.

**Parameters:**

- `$name` - Name of the tool to call
- `$arguments` - Arguments to pass to the tool
- `$progressCallback` - Optional callback for progress updates

**Returns:** Promise resolving to tool execution result

**Example:**

```php
async(function () use ($client) {
    $result = $client->callToolWithProgress(
        'process_large_file',
        ['file' => 'large_data.csv'],
        function ($progress) {
            echo "Progress: {$progress['percentage']}%\n";
        }
    )->await();
})->await();
```

## Resource Access

### readResource()

```php
public function readResource(string $uri): Promise
```

Reads the contents of a resource from the server.

**Parameters:**

- `$uri` - URI of the resource to read

**Returns:** Promise resolving to resource contents

**Example:**

```php
async(function () use ($client) {
    $result = $client->readResource('file:///config.json')->await();

    echo "Content: {$result['contents'][0]['text']}\n";
})->await();
```

### subscribeToResource()

```php
public function subscribeToResource(string $uri, callable $callback): Promise
```

Subscribes to resource changes and receives notifications when the resource is updated.

**Parameters:**

- `$uri` - URI of the resource to subscribe to
- `$callback` - Callback function for change notifications

**Returns:** Promise resolving when subscription is established

**Example:**

```php
async(function () use ($client) {
    $client->subscribeToResource(
        'live://system-stats',
        function ($update) {
            echo "Resource updated: {$update['uri']}\n";
        }
    )->await();
})->await();
```

## Prompt Management

### getPrompt()

```php
public function getPrompt(string $name, array $arguments = []): Promise
```

Retrieves a prompt template from the server with the specified arguments.

**Parameters:**

- `$name` - Name of the prompt to get
- `$arguments` - Arguments for the prompt template

**Returns:** Promise resolving to prompt content

**Example:**

```php
async(function () use ($client) {
    $result = $client->getPrompt('code_review', [
        'code' => $sourceCode,
        'language' => 'php'
    ])->await();

    echo "Prompt: {$result['messages'][0]['content'][0]['text']}\n";
})->await();
```

## Sampling (LLM Requests)

### requestSampling()

```php
public function requestSampling(array $request): Promise
```

Requests text completion from the connected LLM.

**Parameters:**

- `$request` - Sampling request with messages and parameters

**Returns:** Promise resolving to LLM completion

**Example:**

```php
async(function () use ($client) {
    $result = $client->requestSampling([
        'messages' => [
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => 'Explain quantum computing']
                ]
            ]
        ],
        'maxTokens' => 500
    ])->await();

    echo "Completion: {$result['completion']}\n";
})->await();
```

## Error Handling

All client methods can throw `McpError` exceptions for various error conditions:

```php
use MCP\Types\McpError;
use MCP\Types\ErrorCode;

async(function () use ($client) {
    try {
        $result = $client->callTool('nonexistent-tool')->await();
    } catch (McpError $e) {
        echo "MCP Error [{$e->getCode()}]: {$e->getMessage()}\n";

        // Handle specific error types
        if ($e->getCode() === ErrorCode::MethodNotFound) {
            echo "Tool not found on server\n";
        }
    } catch (\Exception $e) {
        echo "General Error: {$e->getMessage()}\n";
    }
})->await();
```

## Transport Types

### StdioClientTransport

For process-based communication:

```php
use MCP\Client\Transport\StdioClientTransport;

$transport = new StdioClientTransport([
    'command' => 'php',
    'args' => ['server.php'],
    'cwd' => '/path/to/server',
    'env' => ['DEBUG' => '1']
]);
```

### HttpClientTransport

For HTTP-based communication:

```php
use MCP\Client\Transport\HttpClientTransport;

$transport = new HttpClientTransport([
    'baseUrl' => 'http://localhost:3000',
    'timeout' => 30,
    'headers' => [
        'Authorization' => 'Bearer token123'
    ]
]);
```

### WebSocketClientTransport

For WebSocket-based communication:

```php
use MCP\Client\Transport\WebSocketClientTransport;

$transport = new WebSocketClientTransport([
    'url' => 'ws://localhost:8080',
    'timeout' => 30,
    'headers' => [
        'Authorization' => 'Bearer token123'
    ]
]);
```

## Advanced Usage

### Connection Pooling

```php
class ClientPool
{
    private array $clients = [];

    public function getClient(string $serverId): Client
    {
        if (!isset($this->clients[$serverId])) {
            $this->clients[$serverId] = $this->createClient($serverId);
        }

        return $this->clients[$serverId];
    }

    private function createClient(string $serverId): Client
    {
        $config = $this->getServerConfig($serverId);
        $client = new Client(new Implementation('pool-client', '1.0.0'));

        $transport = new StdioClientTransport($config['transport']);
        $client->connect($transport)->await();

        return $client;
    }
}
```

### Parallel Operations

```php
async(function () use ($client) {
    // Execute multiple tools in parallel
    $promises = [
        $client->callTool('tool1', ['param' => 'value1']),
        $client->callTool('tool2', ['param' => 'value2']),
        $client->callTool('tool3', ['param' => 'value3'])
    ];

    $results = Promise::all($promises)->await();

    foreach ($results as $i => $result) {
        echo "Tool " . ($i + 1) . " result: {$result['content'][0]['text']}\n";
    }
})->await();
```

### Retry Logic

```php
async function callToolWithRetry(
    Client $client,
    string $toolName,
    array $params,
    int $maxRetries = 3
): Promise {
    $attempt = 0;

    while ($attempt < $maxRetries) {
        try {
            return $client->callTool($toolName, $params)->await();
        } catch (McpError $e) {
            $attempt++;

            if ($attempt >= $maxRetries) {
                throw $e;
            }

            // Exponential backoff
            $delay = pow(2, $attempt) * 1000;
            delay($delay)->await();
        }
    }
}
```

### Request Caching

```php
class CachingClient
{
    private Client $client;
    private array $cache = [];
    private int $ttl = 300; // 5 minutes

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function callTool(string $name, array $arguments = []): Promise
    {
        return async(function () use ($name, $arguments) {
            $cacheKey = md5($name . json_encode($arguments));

            // Check cache
            if (isset($this->cache[$cacheKey])) {
                $cached = $this->cache[$cacheKey];
                if (time() - $cached['timestamp'] < $this->ttl) {
                    return $cached['result'];
                }
            }

            // Call tool and cache result
            $result = $this->client->callTool($name, $arguments)->await();

            $this->cache[$cacheKey] = [
                'result' => $result,
                'timestamp' => time()
            ];

            return $result;
        });
    }
}
```

## Configuration

### Client Options

```php
$client = new Client(
    new Implementation('my-client', '1.0.0'),
    [
        'timeout' => 30,
        'maxRetries' => 3,
        'retryDelay' => 1000,
        'keepAlive' => true,
        'debug' => false
    ]
);
```

### Logging

```php
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

$logger = new Logger('mcp-client');
$logger->pushHandler(new StreamHandler('php://stdout', Logger::INFO));

$client->setLogger($logger);
```

### Middleware

```php
$client->addMiddleware(new AuthenticationMiddleware($token));
$client->addMiddleware(new LoggingMiddleware($logger));
$client->addMiddleware(new RetryMiddleware(3));
```

## Complete Example

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

async(function () {
    try {
        // Create client
        $client = new Client(new Implementation('example-client', '1.0.0'));

        // Create transport
        $transport = new StdioClientTransport([
            'command' => 'php',
            'args' => ['weather-server.php']
        ]);

        // Connect
        echo "Connecting to server...\n";
        $client->connect($transport)->await();

        // Discover capabilities
        $tools = $client->listTools()->await();
        echo "Available tools: " . count($tools['tools']) . "\n";

        // Call a tool
        $result = $client->callTool('get-weather', [
            'location' => 'London'
        ])->await();

        echo "Weather: {$result['content'][0]['text']}\n";

        // Read a resource
        $resource = $client->readResource('config://app/production')->await();
        echo "Config: {$resource['contents'][0]['text']}\n";

        // Get a prompt
        $prompt = $client->getPrompt('weather_analysis', [
            'city' => 'London'
        ])->await();

        echo "Prompt: {$prompt['messages'][0]['content'][0]['text']}\n";

        // Clean shutdown
        $client->close()->await();
        echo "Disconnected successfully\n";

    } catch (\Exception $e) {
        echo "Error: {$e->getMessage()}\n";
    }
})->await();
```

## See Also

- [Server API](server) - MCP server reference
- [Types](types) - Type definitions and schemas
- [Transports](transports) - Transport layer options
- [Examples](../examples/) - Working client examples
