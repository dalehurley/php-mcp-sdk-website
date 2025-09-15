---
layout: home

hero:
  name: PHP MCP SDK
  text: Model Context Protocol for PHP
  tagline: Build intelligent AI agents and applications with seamless integration between LLMs and external data sources
  image:
    src: /images/hero-logo.svg
    alt: PHP MCP SDK
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/dalehurley/php-mcp-sdk

features:
  - icon: 🚀
    title: Complete MCP Protocol Support
    details: Full implementation of the Model Context Protocol specification with type-safe PHP 8.1+ features

  - icon: ⚡
    title: Async First Architecture
    details: Built on Amphp for non-blocking I/O operations, enabling high-performance applications

  - icon: 🔌
    title: Multiple Transport Options
    details: STDIO, HTTP Streaming, and WebSocket transports for flexible deployment scenarios

  - icon: 🔐
    title: OAuth 2.0 Ready
    details: Built-in authentication with PKCE support for secure integrations

  - icon: 🏗️
    title: Framework Integration
    details: Laravel, Symfony, and PSR-compatible design for seamless framework integration

  - icon: 🤖
    title: Agentic AI Support
    details: Build intelligent AI agents with MCP tool orchestration and multi-agent coordination

  - icon: 📦
    title: PSR Compliant
    details: Follows PSR-4, PSR-7, PSR-12, and PSR-15 standards for maximum interoperability

  - icon: 🛡️
    title: Production Ready
    details: Comprehensive error handling, logging, monitoring, and enterprise-grade features

  - icon: 📚
    title: Comprehensive Documentation
    details: Best-in-class documentation with 20+ tested examples and real-world applications
---

## Quick Start

Get up and running with PHP MCP SDK in minutes:

```bash
composer require dalehurley/php-mcp-sdk
```

### Create Your First MCP Server

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
    new Implementation('hello-world-server', '1.0.0')
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

### Test with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "php",
      "args": ["/path/to/your/hello-world-server.php"]
    }
  }
}
```

## Why Choose PHP MCP SDK?

### 🎯 **Comprehensive Examples**

20+ working examples from simple "Hello World" to complex real-world applications like Blog CMS, Task Manager, and API Gateway.

### 🏗️ **Framework Ready**

Seamless integration with Laravel, Symfony, and other PHP frameworks through PSR-compliant design.

### 🤖 **Agentic AI First**

Built specifically for creating intelligent AI agents with multi-agent coordination and tool orchestration.

### 🏭 **Enterprise Grade**

Production-ready features including Docker deployment, microservices architecture, monitoring, and observability.

### 📖 **Best-in-Class Documentation**

The most comprehensive MCP SDK documentation in the ecosystem with tested examples and migration guides.

## Real-World Applications

<div class="examples-grid">
  <div class="example-card">
    <h3>🏢 Enterprise API Gateway</h3>
    <p>Complete API orchestration system with authentication, rate limiting, and monitoring</p>
    <a href="/examples/real-world/api-gateway">View Example →</a>
  </div>
  
  <div class="example-card">
    <h3>📝 Blog CMS</h3>
    <p>Full-featured content management system with user management and analytics</p>
    <a href="/examples/real-world/blog-cms">View Example →</a>
  </div>
  
  <div class="example-card">
    <h3>🤖 AI Agent Orchestrator</h3>
    <p>Multi-agent system with specialized agents for different tasks and coordination</p>
    <a href="/examples/agentic-ai/multi-agent-orchestrator">View Example →</a>
  </div>
</div>

<style>
.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.example-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s;
}

.example-card:hover {
  border-color: var(--vp-c-brand);
}

.example-card h3 {
  margin-top: 0;
  color: var(--vp-c-brand);
}

.example-card a {
  color: var(--vp-c-brand);
  text-decoration: none;
  font-weight: 500;
}

.example-card a:hover {
  text-decoration: underline;
}
</style>
