# Transport Layers

Learn about the different transport options available in the PHP MCP SDK and how to choose the right one for your use case.

## Overview

MCP supports multiple transport mechanisms for communication between clients and servers. Each transport has different characteristics and is suited for different deployment scenarios.

## STDIO Transport

Process-based communication using standard input/output streams.

### When to Use

- Local development and testing
- Command-line tools and desktop applications
- Single-client scenarios
- Simple deployment requirements

### Server Implementation

```php
use MCP\Server\Transport\StdioServerTransport;

$transport = new StdioServerTransport();
$server->connect($transport)->await();
```

### Client Implementation

```php
use MCP\Client\Transport\StdioClientTransport;

$transport = new StdioClientTransport([
    'command' => 'php',
    'args' => ['server.php']
]);
$client->connect($transport)->await();
```

## HTTP Transport

Web-based communication using HTTP streaming.

### When to Use

- Web applications and services
- Multiple concurrent clients
- Cloud deployments
- Load balancing scenarios

### Server Implementation

```php
use MCP\Server\Transport\HttpServerTransport;

$transport = new HttpServerTransport([
    'host' => '0.0.0.0',
    'port' => 3000,
    'cors' => true
]);
$server->connect($transport)->await();
```

### Client Implementation

```php
use MCP\Client\Transport\HttpClientTransport;

$transport = new HttpClientTransport([
    'baseUrl' => 'http://localhost:3000'
]);
$client->connect($transport)->await();
```

## WebSocket Transport

Real-time bidirectional communication.

### When to Use

- Real-time applications
- Interactive user interfaces
- Persistent connections
- Low-latency requirements

### Server Implementation

```php
use MCP\Server\Transport\WebSocketServerTransport;

$transport = new WebSocketServerTransport([
    'host' => '0.0.0.0',
    'port' => 8080,
    'maxConnections' => 100
]);
$server->connect($transport)->await();
```

## See Also

- [Transport API Reference](../api/transports)
- [Examples](../examples/)
- [Deployment Guide](../enterprise/deployment)
