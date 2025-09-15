# Getting Started with PHP MCP SDK

Welcome to the PHP MCP SDK! This guide will help you understand what MCP is, why it's useful, and how to get started building with it.

## What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that enables seamless integration between Large Language Models (LLMs) and external data sources, tools, and services. Think of it as a standardized way for AI models to interact with the world beyond their training data.

## Why Use MCP?

### 🔌 **Universal Integration**

- Connect any LLM to any data source or tool
- Standardized protocol means write once, use everywhere
- Growing ecosystem of compatible tools and services

### 🛡️ **Secure & Controlled**

- Fine-grained access control
- OAuth 2.0 authentication support
- Input validation and sanitization

### ⚡ **High Performance**

- Async-first architecture
- Multiple transport options (STDIO, HTTP, WebSocket)
- Built-in caching and connection pooling

### 🏗️ **Production Ready**

- Comprehensive error handling
- Monitoring and observability
- Docker and cloud deployment support

## Key Concepts

Before diving into code, let's understand the core MCP concepts:

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      LLM        │◄──►│   MCP Client    │◄──►│   MCP Server    │
│   (ChatGPT,     │    │                 │    │                 │
│    Claude, etc) │    │                 │    │ Your PHP App    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **MCP Server** (what you'll build): Provides tools, resources, and capabilities
- **MCP Client**: Connects servers to LLMs (like Claude Desktop)
- **LLM**: The AI model that uses your server's capabilities

### Core Capabilities

MCP servers can provide four types of capabilities:

#### 1. 🔧 Tools

Callable functions that perform actions:

- Database queries
- API calls
- File operations
- Calculations

#### 2. 📦 Resources

Data sources that can be read:

- Configuration files
- Documentation
- Database records
- API responses

#### 3. 💭 Prompts

Templates that guide LLM behavior:

- Instructions and context
- Response formatting
- Domain-specific guidelines

#### 4. 🎯 Sampling

Request LLM completions from within your server:

- Content generation
- Analysis and summarization
- Translation

## Your First MCP Server

Let's create a simple "Hello World" server to see MCP in action:

### Installation

```bash
composer require dalehurley/php-mcp-sdk
```

### Create the Server

Create `hello-server.php`:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

// Create server with basic info
$server = new McpServer(
    new Implementation(
        'hello-world-server',
        '1.0.0',
        'A simple greeting server'
    )
);

// Add a tool that says hello
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

### Make it Executable

```bash
chmod +x hello-server.php
```

### Test with MCP Inspector

The MCP Inspector is a great tool for testing servers:

```bash
# Install MCP Inspector (requires Node.js)
npm install -g @modelcontextprotocol/inspector

# Test your server
mcp-inspector ./hello-server.php
```

This opens a web interface where you can:

- View available tools and resources
- Test tool calls with different parameters
- Inspect JSON-RPC messages
- Debug issues

### Test with Claude Desktop

Add your server to Claude Desktop's configuration:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "php",
      "args": ["/path/to/your/hello-server.php"]
    }
  }
}
```

Now you can ask Claude to use your greeting tool!

## Understanding the Code

Let's break down what's happening:

### 1. Server Creation

```php
$server = new McpServer(
    new Implementation('hello-world-server', '1.0.0', 'Description')
);
```

Creates a new MCP server with identifying information.

### 2. Tool Registration

```php
$server->tool($name, $description, $schema, $handler);
```

- **Name**: Unique identifier for the tool
- **Description**: Human-readable description
- **Schema**: JSON Schema defining expected parameters
- **Handler**: Function that processes tool calls

### 3. Transport Setup

```php
$transport = new StdioServerTransport();
$server->connect($transport)->await();
```

Sets up communication via STDIO (standard input/output).

### 4. Async Execution

```php
async(function () use ($server) {
    // Server logic here
})->await();
```

Uses ReactPHP's async system for non-blocking operations.

## Real-World Example

Let's build something more practical - a weather server:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

$server = new McpServer(
    new Implementation('weather-server', '1.0.0')
);

// Weather tool with input validation
$server->tool(
    'get_weather',
    'Get current weather for a location',
    [
        'type' => 'object',
        'properties' => [
            'location' => [
                'type' => 'string',
                'description' => 'City name or coordinates'
            ],
            'units' => [
                'type' => 'string',
                'enum' => ['celsius', 'fahrenheit'],
                'default' => 'celsius'
            ]
        ],
        'required' => ['location']
    ],
    function (array $args): array {
        $location = $args['location'];
        $units = $args['units'] ?? 'celsius';

        // Simulate API call (replace with real weather API)
        $weather = [
            'location' => $location,
            'temperature' => rand(15, 30),
            'condition' => ['sunny', 'cloudy', 'rainy'][rand(0, 2)],
            'humidity' => rand(40, 80) . '%',
            'units' => $units
        ];

        if ($units === 'fahrenheit') {
            $weather['temperature'] = round($weather['temperature'] * 9/5 + 32);
        }

        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "Weather in {$location}:\n" .
                             "Temperature: {$weather['temperature']}°" .
                             ($units === 'celsius' ? 'C' : 'F') . "\n" .
                             "Condition: {$weather['condition']}\n" .
                             "Humidity: {$weather['humidity']}"
                ]
            ]
        ];
    }
);

// Weather resource for current conditions
$server->resource(
    'weather://current/{location}',
    'Current weather conditions',
    'application/json',
    function (string $uri): array {
        preg_match('/weather:\/\/current\/(.+)/', $uri, $matches);
        $location = urldecode($matches[1] ?? 'Unknown');

        $weather = [
            'location' => $location,
            'temperature' => rand(15, 30),
            'condition' => ['sunny', 'cloudy', 'rainy'][rand(0, 2)],
            'timestamp' => date('c')
        ];

        return [
            'contents' => [
                [
                    'uri' => $uri,
                    'mimeType' => 'application/json',
                    'text' => json_encode($weather, JSON_PRETTY_PRINT)
                ]
            ]
        ];
    }
);

async(function () use ($server) {
    echo "🌤️  Weather MCP Server starting...\n";

    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

This server provides:

- A **tool** for getting weather data with parameters
- A **resource** for accessing weather data via URI
- Input validation and error handling
- Realistic data structure

## What's Next?

Now that you've created your first MCP server, here are the next steps:

### 📚 Learn More

- [Installation Guide](installation) - Detailed setup instructions
- [Quick Start](quick-start) - Build a complete client-server example
- [Core Concepts](concepts) - Deep dive into MCP architecture

### 🛠️ Build Advanced Features

- [Creating Servers](../guides/creating-servers) - Production-ready servers
- [Authentication](../guides/authentication) - Secure your servers
- [Transport Options](../guides/transports) - HTTP, WebSocket, and more

### 🏗️ Framework Integration

- [Laravel Integration](../integrations/laravel) - Use MCP in Laravel apps
- [Symfony Integration](../integrations/symfony) - Symfony-specific patterns

### 🤖 Agentic AI

- [Building AI Agents](../agentic-ai/) - Create intelligent AI systems
- [Multi-Agent Systems](../agentic-ai/multi-agent) - Coordinate multiple agents

### 🎯 Examples

- [Hello World Examples](../examples/hello-world) - Simple starting points
- [Real-World Applications](../examples/real-world/) - Complete applications
- [Enterprise Examples](../examples/enterprise/) - Production deployments

## Getting Help

- 📖 [Full Documentation](../api/)
- 🐛 [Report Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- 💬 [Community Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions)
- 📧 [Contact Support](mailto:support@example.com)

Welcome to the world of MCP! Let's build something amazing together. 🚀
