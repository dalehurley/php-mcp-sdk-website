---
layout: home

hero:
  name: PHP MCP SDK
  text: Build AI Agents with PHP
  tagline: The most complete Model Context Protocol implementation for PHP. Connect LLMs to your data, APIs, and tools with a production-ready async SDK.
  image:
    src: /images/hero-logo.svg
    alt: PHP MCP SDK
  actions:
    - theme: brand
      text: Start Building →
      link: /guide/getting-started
    - theme: alt
      text: See Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/dalehurley/php-mcp-sdk

features:
  - icon: 🚀
    title: Complete MCP Protocol Support
    details: Full implementation of the Model Context Protocol specification with type-safe PHP 8.1+ features. Tools, resources, prompts, and sampling — all covered.

  - icon: ⚡
    title: Async First Architecture
    details: Built on Amphp for non-blocking I/O operations, enabling high-throughput applications that handle thousands of concurrent connections.

  - icon: 🔌
    title: Multiple Transport Options
    details: STDIO for Claude Desktop, HTTP Streaming for web APIs, and WebSocket for real-time applications — choose the right transport for your use case.

  - icon: 🔐
    title: OAuth 2.0 & PKCE Ready
    details: Built-in authentication with PKCE support, token management, and secure integrations for production deployments.

  - icon: 🏗️
    title: Framework Integration
    details: Laravel, Symfony, and PSR-compatible design. Drop into your existing project in minutes with zero lock-in.

  - icon: 🤖
    title: Agentic AI Support
    details: Build intelligent AI agents with MCP tool orchestration, multi-agent coordination, and complex workflow automation.

  - icon: 📦
    title: PSR Compliant
    details: Follows PSR-4, PSR-7, PSR-12, and PSR-15 standards for maximum interoperability with any PHP project.

  - icon: 🛡️
    title: Production Ready
    details: Comprehensive error handling, logging, monitoring, Docker deployment, and enterprise-grade features out of the box.

  - icon: 📚
    title: Best-in-Class Documentation
    details: 20+ tested examples, real-world applications, API reference, and integration guides — everything you need to ship fast.
---

<div class="home-content">

## Quick Start

Get up and running in minutes:

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

$server = new McpServer(
    new Implementation('hello-world-server', '1.0.0')
);

$server->tool(
    'say_hello',
    'Says hello to someone',
    [
        'type' => 'object',
        'properties' => [
            'name' => ['type' => 'string', 'description' => 'Name to greet']
        ],
        'required' => ['name']
    ],
    function (array $args): array {
        return [
            'content' => [['type' => 'text', 'text' => "Hello, {$args['name']}!"]]
        ];
    }
);

async(function () use ($server) {
    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

### Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hello-world": {
      "command": "php",
      "args": ["/path/to/your/server.php"]
    }
  }
}
```

<div class="try-it-section">

## Try It Online

Explore PHP MCP SDK without any local setup:

<div class="try-it-grid">
  <div class="try-it-card">
    <div class="try-it-icon">▶</div>
    <h3>PHP Sandbox</h3>
    <p>Run PHP code instantly in your browser with 3v4l.org — no installation needed.</p>
    <a href="https://3v4l.org/" target="_blank" rel="noopener" class="try-it-btn">Open PHP Sandbox →</a>
  </div>
  <div class="try-it-card">
    <div class="try-it-icon">🔍</div>
    <h3>MCP Inspector</h3>
    <p>Visually test and debug your MCP server using the official MCP Inspector tool.</p>
    <a href="https://github.com/modelcontextprotocol/inspector" target="_blank" rel="noopener" class="try-it-btn">MCP Inspector →</a>
  </div>
  <div class="try-it-card">
    <div class="try-it-icon">📋</div>
    <h3>Hello World Example</h3>
    <p>A complete, runnable Hello World example to copy, paste, and start customising.</p>
    <a href="/examples/hello-world" class="try-it-btn">View Example →</a>
  </div>
</div>

</div>

## By the Numbers

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-number">20+</div>
    <div class="stat-label">Working Examples</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">4</div>
    <div class="stat-label">Framework Integrations</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">3</div>
    <div class="stat-label">Transport Options</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">PHP 8.1+</div>
    <div class="stat-label">Minimum Requirement</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">MIT</div>
    <div class="stat-label">Open Source License</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">100%</div>
    <div class="stat-label">MCP Spec Coverage</div>
  </div>
</div>

## Use Cases

What are developers building with PHP MCP SDK?

<div class="use-cases-grid">
  <div class="use-case-card">
    <div class="use-case-icon">🤖</div>
    <h3>AI-Powered Chatbots</h3>
    <p>Connect Claude, GPT-4, or any LLM to your PHP application data — databases, APIs, CMS content — and let AI answer questions in real time.</p>
  </div>
  <div class="use-case-card">
    <div class="use-case-icon">📊</div>
    <h3>Business Intelligence Agents</h3>
    <p>Give AI agents read access to your ERP, CRM, or analytics platform so non-technical users can query complex data with natural language.</p>
  </div>
  <div class="use-case-card">
    <div class="use-case-icon">🔧</div>
    <h3>Developer Tooling</h3>
    <p>Build MCP servers that expose code analysis, CI/CD pipelines, and deployment tools directly into AI coding assistants like Claude Code.</p>
  </div>
  <div class="use-case-card">
    <div class="use-case-icon">🏢</div>
    <h3>Enterprise Automation</h3>
    <p>Automate complex multi-step workflows with AI orchestration across microservices — approvals, notifications, data transformation, and more.</p>
  </div>
  <div class="use-case-card">
    <div class="use-case-icon">🛒</div>
    <h3>E-commerce Intelligence</h3>
    <p>Let AI agents interact with your product catalog, inventory, and order systems to assist customers and automate merchandising tasks.</p>
  </div>
  <div class="use-case-card">
    <div class="use-case-icon">📝</div>
    <h3>Content Management</h3>
    <p>Build AI-assisted CMS tools that can draft, edit, categorise, and publish content while accessing your full content library as context.</p>
  </div>
</div>

## Performance Highlights

PHP MCP SDK is designed for production workloads:

<div class="perf-grid">
  <div class="perf-card">
    <h3>Non-Blocking I/O</h3>
    <p>Built on <strong>Amphp</strong> — PHP's battle-tested async framework. Handle multiple concurrent MCP sessions without the overhead of multi-threading.</p>
    <div class="perf-detail">
      <code>No blocking calls · Event-loop driven · Coroutine-based</code>
    </div>
  </div>
  <div class="perf-card">
    <h3>Efficient Transport</h3>
    <p>HTTP Streaming uses chunked transfer for low-latency, memory-efficient message delivery. STDIO transport has near-zero overhead for local use.</p>
    <div class="perf-detail">
      <code>Chunked streaming · Connection pooling · Keep-alive support</code>
    </div>
  </div>
  <div class="perf-card">
    <h3>Memory Optimised</h3>
    <p>Resources are streamed and never fully loaded into memory. Large file and database operations stay lean regardless of dataset size.</p>
    <div class="perf-detail">
      <code>Lazy loading · Generator-based streaming · Configurable limits</code>
    </div>
  </div>
</div>

## What's New in v1.0.0

<div class="changelog-highlights">
  <div class="changelog-item">
    <span class="changelog-badge new">NEW</span>
    <div class="changelog-text">
      <strong>Full MCP Specification Coverage</strong> — Tools, resources, prompts, sampling, roots, and elicitation all implemented to spec.
    </div>
  </div>
  <div class="changelog-item">
    <span class="changelog-badge new">NEW</span>
    <div class="changelog-text">
      <strong>OAuth 2.0 + PKCE Authentication</strong> — Production-ready auth flow with token refresh and secure storage.
    </div>
  </div>
  <div class="changelog-item">
    <span class="changelog-badge new">NEW</span>
    <div class="changelog-text">
      <strong>Laravel & Symfony Integrations</strong> — First-class framework support with service providers, facades, and DI container integration.
    </div>
  </div>
  <div class="changelog-item">
    <span class="changelog-badge new">NEW</span>
    <div class="changelog-text">
      <strong>Agentic AI Toolkit</strong> — Multi-agent orchestration, tool chaining, and agent-to-agent communication primitives.
    </div>
  </div>
  <div class="changelog-item">
    <span class="changelog-badge new">NEW</span>
    <div class="changelog-text">
      <strong>20+ Production Examples</strong> — From Hello World to enterprise microservices, with Docker deployment configs included.
    </div>
  </div>
  <a href="https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md" class="changelog-link" target="_blank">View full changelog →</a>
</div>

## Why Choose PHP MCP SDK?

### Complete MCP Coverage
The full Model Context Protocol spec — not a partial port. Tools, resources, prompts, sampling, roots, and elicitation are all implemented and tested.

### Framework-First Design
PSR-compliant throughout. Drop-in support for Laravel and Symfony means you spend time on features, not plumbing.

### Agentic AI Ready
Built from the ground up for AI agents. Multi-agent coordination, tool orchestration, and complex workflow automation are first-class citizens.

### Enterprise Grade
Docker deployment, microservices architecture, monitoring, observability, and security hardening guides — ready for production from day one.

### The Best Documentation in the Ecosystem
20+ working code examples, comprehensive API reference, integration guides, and troubleshooting resources. If you're stuck, the answer is in the docs.

## Real-World Applications

<div class="examples-grid">
  <div class="example-card">
    <h3>🏢 Enterprise API Gateway</h3>
    <p>Complete API orchestration with authentication, rate limiting, and distributed monitoring across microservices.</p>
    <a href="/examples/real-world/api-gateway">View Example →</a>
  </div>

  <div class="example-card">
    <h3>📝 Blog CMS</h3>
    <p>AI-assisted content management system with user management, media handling, and analytics integration.</p>
    <a href="/examples/real-world/blog-cms">View Example →</a>
  </div>

  <div class="example-card">
    <h3>🤖 AI Agent Orchestrator</h3>
    <p>Multi-agent system with specialised agents for research, writing, coding, and task management with human-in-the-loop workflows.</p>
    <a href="/agentic-ai/multi-agent">View Example →</a>
  </div>

  <div class="example-card">
    <h3>📊 Data Pipeline</h3>
    <p>High-throughput data processing pipeline with AI-powered transformation, validation, and enrichment.</p>
    <a href="/examples/real-world/data-pipeline">View Example →</a>
  </div>

  <div class="example-card">
    <h3>🔬 Code Analyser</h3>
    <p>Automated code review and quality analysis tool powered by AI with custom rule engines and reporting.</p>
    <a href="/examples/real-world/code-analyzer">View Example →</a>
  </div>

  <div class="example-card">
    <h3>✅ Task Manager</h3>
    <p>AI-enhanced project management with natural language task creation, prioritisation, and automated status updates.</p>
    <a href="/examples/real-world/task-manager">View Example →</a>
  </div>
</div>

## Badges

Add these to your project's README to show PHP MCP SDK integration:

```markdown
[![PHP MCP SDK](https://img.shields.io/badge/PHP%20MCP%20SDK-v1.0.0-646cff)](https://phpmcpsdk.com)
[![PHP Version](https://img.shields.io/badge/PHP-8.1%2B-777BB4)](https://php.net)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol%20Compliant-00A86B)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/dalehurley/php-mcp-sdk/blob/main/LICENSE)
```

</div>

<style>
.home-content {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.stat-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem 1rem;
  background: var(--vp-c-bg-soft);
  text-align: center;
  transition: border-color 0.2s, transform 0.2s;
}

.stat-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--vp-c-brand);
  line-height: 1;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  margin-top: 0.5rem;
}

/* Try It Section */
.try-it-section {
  margin: 2rem 0;
}

.try-it-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
}

.try-it-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  transition: border-color 0.2s, transform 0.2s;
}

.try-it-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.try-it-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.try-it-card h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--vp-c-text-1);
}

.try-it-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  flex: 1;
}

.try-it-btn {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  border: 1px solid var(--vp-c-brand);
  color: var(--vp-c-brand);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.try-it-btn:hover {
  background: var(--vp-c-brand);
  color: white;
  text-decoration: none;
}

/* Use Cases Grid */
.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.use-case-card {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s, transform 0.2s;
}

.use-case-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.use-case-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.use-case-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--vp-c-brand);
}

.use-case-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

/* Performance Grid */
.perf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.perf-card {
  border: 1px solid var(--vp-c-border);
  border-left: 3px solid var(--vp-c-brand);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
}

.perf-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--vp-c-text-1);
}

.perf-card p {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.perf-detail code {
  font-size: 0.8rem;
  color: var(--vp-c-brand);
  background: var(--vp-c-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

/* Changelog Highlights */
.changelog-highlights {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  margin: 2rem 0;
}

.changelog-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.changelog-item:last-of-type {
  border-bottom: none;
}

.changelog-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  margin-top: 2px;
}

.changelog-badge.new {
  background: var(--vp-c-brand);
  color: white;
}

.changelog-badge.fix {
  background: #22c55e;
  color: white;
}

.changelog-badge.improved {
  background: #f59e0b;
  color: white;
}

.changelog-text {
  font-size: 0.95rem;
  color: var(--vp-c-text-1);
  line-height: 1.5;
}

.changelog-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--vp-c-brand);
  font-weight: 500;
  text-decoration: none;
}

.changelog-link:hover {
  text-decoration: underline;
}

/* Examples Grid */
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
  transition: border-color 0.2s, transform 0.2s;
}

.example-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.example-card h3 {
  margin-top: 0;
  color: var(--vp-c-brand);
}

.example-card p {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  line-height: 1.6;
}

.example-card a {
  color: var(--vp-c-brand);
  text-decoration: none;
  font-weight: 500;
}

.example-card a:hover {
  text-decoration: underline;
}

/* Footer links */
.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.footer-links a {
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}

.footer-links a:hover {
  color: var(--vp-c-brand);
}
</style>
