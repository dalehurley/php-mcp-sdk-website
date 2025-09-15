# Hello World Example

The simplest possible MCP server to get you started with the PHP MCP SDK.

## Overview

This example demonstrates:

- Basic server creation
- Simple tool registration
- STDIO transport usage
- Minimal error handling

## Complete Code

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

// Create the simplest possible MCP server
$server = new McpServer(
    new Implementation(
        'hello-world-server',
        '1.0.0',
        'A simple greeting server'
    )
);

// Add a simple "say_hello" tool
$server->tool(
    'say_hello',
    'Says hello to someone',
    [
        'type' => 'object',
        'properties' => [
            'name' => [
                'type' => 'string',
                'description' => 'Name of the person to greet'
            ]
        ],
        'required' => ['name']
    ],
    function (array $args): array {
        $name = $args['name'] ?? 'World';

        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "Hello, {$name}! 👋 Welcome to MCP!"
                ]
            ]
        ];
    }
);

// Start the server
async(function () use ($server) {
    echo "🚀 Hello World MCP Server starting...\n";

    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

## How to Run

1. Save the code as `hello-world-server.php`
2. Make it executable: `chmod +x hello-world-server.php`
3. Test with MCP Inspector: `mcp-inspector ./hello-world-server.php`

## What You'll Learn

- How to create an MCP server
- Tool registration patterns
- Basic JSON schema validation
- STDIO transport usage

## Next Steps

- [Calculator Example](calculator) - Multiple tools
- [Weather Client](weather-client) - API integration
- [Quick Start Guide](../guide/quick-start) - Comprehensive tutorial
