# Frequently Asked Questions

Common questions about PHP MCP SDK. Can't find what you're looking for? [Open a GitHub Discussion](https://github.com/dalehurley/php-mcp-sdk/discussions).

[[toc]]

## General

### What is the Model Context Protocol (MCP)?

MCP is an open protocol developed by Anthropic that standardises how AI applications interact with external data sources and tools. Instead of building custom integrations for every AI model and data source combination, you implement MCP once and it works with any compatible AI client (Claude Desktop, Claude Code, Cursor, etc.).

Think of MCP as a universal adapter: your PHP application becomes an MCP server, and AI clients can discover and use all the capabilities you expose — querying your database, calling your APIs, reading files — without knowing anything specific about your implementation.

### Why use PHP for MCP instead of Python or TypeScript?

If your existing application, team, or infrastructure is PHP-based, then PHP MCP SDK lets you build MCP servers without introducing a new language or runtime. You can expose your existing PHP business logic, models, and services as MCP tools directly, with no translation layer.

PHP MCP SDK is a full-featured implementation — not a thin wrapper — with async support, proper streaming, OAuth 2.0, and framework integrations specifically built for the PHP ecosystem.

### What PHP versions are supported?

- **PHP 8.1** — Minimum supported version
- **PHP 8.2** — Fully supported and recommended for production
- **PHP 8.3** — Fully supported, recommended for new projects
- **PHP 8.4** — Compatible (not yet tested in CI)

PHP 7.x is not supported. PHP 8.1+ enum and fibre support are used internally.

### Is this an official Anthropic SDK?

No. PHP MCP SDK is an open-source community project created by Dale Hurley. It implements the [official MCP specification](https://spec.modelcontextprotocol.io/) but is not maintained by Anthropic. The official MCP SDKs from Anthropic are available for [Python](https://github.com/modelcontextprotocol/python-sdk) and [TypeScript](https://github.com/modelcontextprotocol/typescript-sdk).

### Is PHP MCP SDK production ready?

Yes. v1.0.0 is a stable release with a full test suite. It has been designed with production use in mind, including:

- Comprehensive error handling with typed exceptions
- Structured logging compatible with any PSR-3 logger
- Docker and Kubernetes deployment examples
- Security hardening guidelines
- Performance optimisation for high-throughput workloads

---

## Installation & Setup

### What are the system requirements?

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| PHP | 8.1 | 8.3+ |
| Composer | 2.0 | Latest |
| ext-json | Required | — |
| ext-mbstring | Required | — |
| ext-openssl | Required for HTTPS | — |

### How do I install PHP MCP SDK?

```bash
composer require dalehurley/php-mcp-sdk
```

See the [Installation Guide](/guide/installation) for full setup instructions including optional dependencies.

### Do I need Redis or a database?

No. The SDK works standalone without Redis or a database. These are optional dependencies used for:
- **Redis** — Session storage and caching in production multi-process setups
- **Database** — Only if your MCP tools read/write data (your application logic)

### Can I use PHP MCP SDK without Laravel or Symfony?

Yes. The SDK is framework-agnostic. It follows PSR standards and works with any PHP project. Laravel and Symfony integrations are optional extras, not requirements.

---

## Architecture & Concepts

### What's the difference between an MCP server and an MCP client?

| | MCP Server | MCP Client |
|---|---|---|
| **Role** | Provides capabilities (tools, resources) | Consumes capabilities |
| **Who builds it** | You (the developer) | Usually the AI vendor (Anthropic, OpenAI) |
| **Examples** | Your PHP app exposing a `search_products` tool | Claude Desktop, Claude Code, Cursor |
| **SDK usage** | `McpServer` class | `McpClient` class |

Most developers building with PHP MCP SDK will primarily build **servers**. You build a client when you want to programmatically connect to other MCP servers.

### What are Tools, Resources, and Prompts?

**Tools** are callable functions the AI can invoke — like `search_database`, `send_email`, or `create_invoice`. They take parameters and return results.

**Resources** are data sources the AI can read — like a file, database record, or API response. They are identified by URI and support both text and binary content.

**Prompts** are reusable message templates that pre-configure the AI's behaviour for specific tasks. They can accept arguments and generate structured conversation starters.

### What transport should I use?

| Transport | Best For |
|-----------|----------|
| **STDIO** | Claude Desktop, Claude Code, local dev tools |
| **HTTP Streaming** | Web APIs, server-side deployed MCP servers |
| **WebSocket** | Real-time applications, bidirectional streaming |

Start with STDIO for local development and Claude Desktop integration. Move to HTTP Streaming for production web deployments.

### Can I run multiple tools in a single server?

Yes. A single `McpServer` instance can register an unlimited number of tools, resources, and prompts. There is no practical limit.

```php
$server->tool('tool_one', ...);
$server->tool('tool_two', ...);
$server->tool('tool_three', ...);
// All tools are available to any connected client
```

---

## Framework Integration

### Does it work with Laravel?

Yes. See the [Laravel Integration Guide](/integrations/laravel) for:
- Service provider registration
- Artisan commands for MCP servers
- Facade usage
- Laravel's event system integration
- Horizon queue worker compatibility

### Does it work with Symfony?

Yes. See the [Symfony Integration Guide](/integrations/symfony) for bundle setup, dependency injection container integration, and console command usage.

### Can I use it with WordPress or other PHP frameworks?

The SDK is PSR-compliant and works with any PHP application. There are no framework-specific integration guides for WordPress yet, but the core SDK works — you just wire it up manually.

---

## Authentication & Security

### How do I add authentication to my MCP server?

See the [Authentication Guide](/guide/authentication). The SDK supports:
- **OAuth 2.0** with PKCE for secure browser-based flows
- **Bearer token** validation for API key authentication
- **Custom middleware** for any authentication scheme

### Is MCP communication encrypted?

STDIO transport communicates locally (process stdin/stdout) with no network transmission. HTTP and WebSocket transports should be run over TLS (HTTPS/WSS) in production — the SDK fully supports this.

### How do I prevent unauthorised access?

- Use OAuth 2.0 or API key authentication (see [Authentication](/guide/authentication))
- Validate and sanitise all tool inputs (see [Security Best Practices](/guide/security))
- Run HTTPS in production
- Implement rate limiting at the transport layer
- Use PHP's `open_basedir` restrictions for file access tools

---

## Troubleshooting

### My Claude Desktop can't find my MCP server

Check the `claude_desktop_config.json` path for the `php` binary is correct for your system:

```bash
# macOS/Linux
which php

# Windows (PowerShell)
where.exe php
```

Use the full path in the config, not just `php`.

### I'm getting "Extension not loaded" errors

Make sure the required PHP extensions are installed:

```bash
php -m | grep -E "json|mbstring|openssl"
```

Install missing extensions via your system package manager or `pecl`.

### Connection drops after idle period

HTTP and WebSocket connections may be closed by proxies or load balancers during idle periods. Configure `keepalive` settings or implement heartbeat logic. See [Troubleshooting](/guide/troubleshooting) for details.

### Tool calls are timing out

Async tools that take longer than the client's timeout will be cancelled. Options:
1. Increase the client timeout configuration
2. Return a job ID immediately and poll for results
3. Use streaming responses for long-running operations

See [Performance Optimisation](/guide/performance) for guidance.

---

## Contributing & Community

### How do I report a bug?

[Open a GitHub Issue](https://github.com/dalehurley/php-mcp-sdk/issues) with:
- PHP version
- SDK version
- Minimal reproducible example
- Expected vs actual behaviour

### How do I contribute code?

See the [Contributing Guide](/contributing) for development setup, coding standards, and the pull request process.

### Where do I ask questions?

- **GitHub Discussions** — [Ask questions and share ideas](https://github.com/dalehurley/php-mcp-sdk/discussions)
- **GitHub Issues** — [Report bugs](https://github.com/dalehurley/php-mcp-sdk/issues)
- **Community Page** — [More resources](/community)

### Is there a roadmap?

Check the [GitHub Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions) for planned features and the [CHANGELOG](https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md) for what's been done.
