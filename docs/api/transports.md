# Transport APIs Reference

Complete reference for transport layer implementations that handle communication between MCP clients and servers.

## Transport Interface

All transport implementations must implement the base Transport interface:

```php
interface Transport
{
    public function start(): Promise;
    public function send(array $message): Promise;
    public function close(): Promise;
    public function setMessageHandler(callable $handler): void;
    public function setCloseHandler(callable $handler): void;
    public function setErrorHandler(callable $handler): void;
}
```

## STDIO Transport

Process-based communication using standard input/output streams.

### StdioServerTransport

```php
use MCP\Server\Transport\StdioServerTransport;

$transport = new StdioServerTransport([
    'bufferSize' => 8192,
    'timeout' => 30
]);
```

### StdioClientTransport

```php
use MCP\Client\Transport\StdioClientTransport;

$transport = new StdioClientTransport([
    'command' => 'php',
    'args' => ['server.php'],
    'cwd' => '/path/to/server',
    'env' => ['DEBUG' => '1'],
    'timeout' => 30
]);
```

**Best for:** Local development, command-line tools, desktop applications

## HTTP Transport

Web-based communication using HTTP streaming.

### HttpServerTransport

```php
use MCP\Server\Transport\HttpServerTransport;

$transport = new HttpServerTransport([
    'host' => '0.0.0.0',
    'port' => 3000,
    'ssl' => false,
    'cors' => [
        'enabled' => true,
        'origins' => ['*'],
        'methods' => ['GET', 'POST'],
        'headers' => ['Content-Type', 'Authorization']
    ]
]);
```

### HttpClientTransport

```php
use MCP\Client\Transport\HttpClientTransport;

$transport = new HttpClientTransport([
    'baseUrl' => 'http://localhost:3000',
    'timeout' => 30,
    'headers' => [
        'Authorization' => 'Bearer token123',
        'User-Agent' => 'MCP-Client/1.0'
    ]
]);
```

**Best for:** Web services, microservices, cloud deployments

## WebSocket Transport

Real-time bidirectional communication.

### WebSocketServerTransport

```php
use MCP\Server\Transport\WebSocketServerTransport;

$transport = new WebSocketServerTransport([
    'host' => '0.0.0.0',
    'port' => 8080,
    'maxConnections' => 100,
    'enablePing' => true,
    'pingInterval' => 30,
    'allowedOrigins' => ['https://example.com']
]);
```

### WebSocketClientTransport

```php
use MCP\Client\Transport\WebSocketClientTransport;

$transport = new WebSocketClientTransport([
    'url' => 'ws://localhost:8080',
    'timeout' => 30,
    'headers' => [
        'Authorization' => 'Bearer token123'
    ],
    'enableCompression' => true
]);
```

**Best for:** Real-time applications, persistent connections, interactive UIs

## Transport Comparison

| Feature              | STDIO   | HTTP   | WebSocket |
| -------------------- | ------- | ------ | --------- |
| **Complexity**       | Low     | Medium | High      |
| **Multiple Clients** | ❌      | ✅     | ✅        |
| **Network Access**   | ❌      | ✅     | ✅        |
| **Real-time**        | ❌      | ⚠️     | ✅        |
| **Bidirectional**    | ✅      | ⚠️     | ✅        |
| **Load Balancing**   | ❌      | ✅     | ✅        |
| **Security**         | Process | HTTPS  | WSS       |

## Complete Examples

### STDIO Server & Client

Server:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

$server = new McpServer(new Implementation('stdio-server', '1.0.0'));

$server->tool('echo', 'Echo input', ['type' => 'object'],
    fn($args) => ['content' => [['type' => 'text', 'text' => $args['message']]]]
);

async(function () use ($server) {
    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

Client:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

async(function () {
    $client = new Client(new Implementation('stdio-client', '1.0.0'));
    $transport = new StdioClientTransport(['command' => 'php', 'args' => ['server.php']]);

    $client->connect($transport)->await();
    $result = $client->callTool('echo', ['message' => 'Hello World'])->await();

    echo $result['content'][0]['text'] . "\n";

    $client->close()->await();
})->await();
```

### HTTP Server & Client

Server:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\HttpServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

$server = new McpServer(new Implementation('http-server', '1.0.0'));

$server->tool('time', 'Get current time', ['type' => 'object'],
    fn($args) => ['content' => [['type' => 'text', 'text' => date('c')]]]
);

async(function () use ($server) {
    $transport = new HttpServerTransport(['host' => 'localhost', 'port' => 3000]);
    $server->connect($transport)->await();

    echo "HTTP server running on http://localhost:3000\n";
})->await();
```

Client:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\HttpClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

async(function () {
    $client = new Client(new Implementation('http-client', '1.0.0'));
    $transport = new HttpClientTransport(['baseUrl' => 'http://localhost:3000']);

    $client->connect($transport)->await();
    $result = $client->callTool('time')->await();

    echo "Server time: {$result['content'][0]['text']}\n";

    $client->close()->await();
})->await();
```

## See Also

- [Server API](server) - Server implementation reference
- [Client API](client) - Client implementation reference
- [Types](types) - Type definitions and schemas
- [Examples](../examples/) - Working transport examples
