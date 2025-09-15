# API Reference

Complete reference documentation for the PHP MCP SDK.

## Core Classes

### [McpServer](server)

High-level server implementation for creating MCP servers with tools, resources, and prompts.

### [Client](client)

MCP client for connecting to and interacting with MCP servers.

### [Types & Schemas](types)

Type definitions, validation schemas, and data structures used throughout the SDK.

### [Transport APIs](transports)

Transport layer implementations for STDIO, HTTP, and WebSocket communication.

## Quick Reference

### Server Creation

```php
use MCP\Server\McpServer;
use MCP\Types\Implementation;

$server = new McpServer(
    new Implementation('my-server', '1.0.0', 'Description')
);
```

### Tool Registration

```php
$server->tool(
    'tool-name',
    'Tool description',
    $jsonSchema,
    function (array $params): array {
        return ['content' => [['type' => 'text', 'text' => 'Result']]];
    }
);
```

### Client Usage

```php
use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;

$client = new Client(new Implementation('client', '1.0.0'));
$transport = new StdioClientTransport(['command' => 'php', 'args' => ['server.php']]);

$client->connect($transport)->await();
$result = $client->callTool('tool-name', $params)->await();
```

## Navigation

- **[Server API](server)** - Creating and configuring MCP servers
- **[Client API](client)** - Connecting to and using MCP servers
- **[Types](types)** - Data types and validation schemas
- **[Transports](transports)** - Communication layer options
- **[Authentication](authentication)** - Security and access control
