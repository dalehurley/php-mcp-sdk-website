# Server API Reference

Complete reference for creating and managing MCP servers with the PHP MCP SDK.

## McpServer Class

The main class for creating MCP servers.

### Constructor

```php
public function __construct(Implementation $implementation)
```

Creates a new MCP server with the specified implementation details.

**Parameters:**

- `$implementation` - Server identification and metadata

**Example:**

```php
use MCP\Server\McpServer;
use MCP\Types\Implementation;

$server = new McpServer(
    new Implementation(
        'my-server',           // name
        '1.0.0',              // version
        'My MCP Server'       // description (optional)
    )
);
```

## Tool Registration

### tool()

```php
public function tool(
    string $name,
    string $description,
    array $inputSchema,
    callable $handler
): void
```

Registers a tool that clients can call.

**Parameters:**

- `$name` - Unique tool identifier
- `$description` - Human-readable description
- `$inputSchema` - JSON Schema for input validation
- `$handler` - Function that processes tool calls

**Example:**

```php
$server->tool(
    'calculate',
    'Performs mathematical calculations',
    [
        'type' => 'object',
        'properties' => [
            'operation' => [
                'type' => 'string',
                'enum' => ['add', 'subtract', 'multiply', 'divide']
            ],
            'a' => ['type' => 'number'],
            'b' => ['type' => 'number']
        ],
        'required' => ['operation', 'a', 'b']
    ],
    function (array $params): array {
        $result = match($params['operation']) {
            'add' => $params['a'] + $params['b'],
            'subtract' => $params['a'] - $params['b'],
            'multiply' => $params['a'] * $params['b'],
            'divide' => $params['a'] / $params['b']
        };

        return [
            'content' => [[
                'type' => 'text',
                'text' => "Result: {$result}"
            ]]
        ];
    }
);
```

## Resource Registration

### resource()

```php
public function resource(
    string $uriTemplate,
    string $description,
    string $mimeType,
    callable $handler
): void
```

Registers a resource that clients can read.

**Parameters:**

- `$uriTemplate` - URI pattern with placeholders
- `$description` - Human-readable description
- `$mimeType` - Content MIME type
- `$handler` - Function that provides resource content

**Example:**

```php
$server->resource(
    'config://app/{environment}',
    'Application configuration',
    'application/json',
    function (string $uri): array {
        preg_match('/config:\/\/app\/(.+)/', $uri, $matches);
        $env = $matches[1];

        $config = loadConfiguration($env);

        return [
            'contents' => [[
                'uri' => $uri,
                'mimeType' => 'application/json',
                'text' => json_encode($config, JSON_PRETTY_PRINT)
            ]]
        ];
    }
);
```

## Prompt Registration

### prompt()

```php
public function prompt(
    string $name,
    string $description,
    array $arguments,
    callable $handler
): void
```

Registers a prompt template.

**Parameters:**

- `$name` - Unique prompt identifier
- `$description` - Human-readable description
- `$arguments` - Array of argument definitions
- `$handler` - Function that generates prompt content

**Example:**

```php
$server->prompt(
    'code-review',
    'Generate code review prompts',
    [
        [
            'name' => 'language',
            'description' => 'Programming language',
            'required' => true
        ],
        [
            'name' => 'complexity',
            'description' => 'Code complexity level',
            'required' => false
        ]
    ],
    function (array $arguments): array {
        $language = $arguments['language'];
        $complexity = $arguments['complexity'] ?? 'medium';

        return [
            'description' => "Code review for {$language}",
            'messages' => [[
                'role' => 'system',
                'content' => [
                    'type' => 'text',
                    'text' => "Review this {$language} code at {$complexity} complexity level..."
                ]
            ]]
        ];
    }
);
```

## Connection Management

### connect()

```php
public function connect(Transport $transport): Promise
```

Connects the server to a transport layer.

**Parameters:**

- `$transport` - Transport implementation (STDIO, HTTP, WebSocket)

**Returns:** Promise that resolves when connection is established

**Example:**

```php
use MCP\Server\Transport\StdioServerTransport;
use function Amp\async;

async(function () use ($server) {
    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

## Server Information

### listTools()

```php
public function listTools(): array
```

Returns all registered tools.

### listResources()

```php
public function listResources(): array
```

Returns all registered resources.

### listPrompts()

```php
public function listPrompts(): array
```

Returns all registered prompts.

## Configuration

### setLogger()

```php
public function setLogger(LoggerInterface $logger): void
```

Sets a PSR-3 compatible logger.

### setAuthProvider()

```php
public function setAuthProvider(AuthProvider $provider): void
```

Sets an authentication provider.

### setErrorHandler()

```php
public function setErrorHandler(callable $handler): void
```

Sets a custom error handler.

## Error Handling

All tool, resource, and prompt handlers can throw `McpError` exceptions:

```php
use MCP\Types\McpError;
use MCP\Types\ErrorCode;

$server->tool(
    'validated-tool',
    'Tool with validation',
    $schema,
    function (array $params): array {
        if (!isset($params['required_field'])) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'Missing required field: required_field'
            );
        }

        // Tool logic here...

        return $result;
    }
);
```

## Complete Example

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use function Amp\async;

// Create server
$server = new McpServer(
    new Implementation('example-server', '1.0.0')
);

// Add logging
$logger = new Logger('example-server');
$logger->pushHandler(new StreamHandler('php://stderr', Logger::INFO));
$server->setLogger($logger);

// Register tools, resources, and prompts
$server->tool('echo', 'Echo input', $schema, $handler);
$server->resource('data://{id}', 'Data resource', 'application/json', $handler);
$server->prompt('analyze', 'Analysis prompt', $args, $handler);

// Start server
async(function () use ($server) {
    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

## See Also

- [Client API](client) - MCP client reference
- [Types](types) - Type definitions and schemas
- [Transports](transports) - Transport layer options
- [Examples](../examples/) - Working examples
