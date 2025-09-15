# PHP MCP SDK Examples

This directory contains comprehensive examples demonstrating the PHP MCP SDK capabilities, including server implementations, client applications, framework integrations, and real-world applications.

## 📁 Example Categories

### 🎓 Getting Started Examples (4 examples)

Perfect for beginners learning MCP concepts:

#### [Hello World](hello-world)

The simplest possible MCP server demonstrating basic tool registration.

```php
$server->tool('say_hello', 'Says hello to someone', $schema,
    fn($args) => ['content' => [['type' => 'text', 'text' => "Hello, {$args['name']}!"]]]
);
```

#### [Calculator Server](calculator)

Multi-tool server demonstrating mathematical operations and input validation.

#### [File Reader](file-reader)

Secure file system integration with proper path validation and access control.

#### [Weather Client](weather-client)

External API integration patterns and error handling.

### 🏗️ Framework Integration Examples (2 examples)

#### [Laravel Integration](../integrations/laravel)

Complete Laravel patterns with service container integration, Artisan commands, and middleware.

#### [Symfony Integration](../integrations/symfony)

Full Symfony integration with dependency injection container and event system.

### 🤖 Agentic AI Examples (4 examples)

Build intelligent AI agents that can reason and coordinate:

#### [Building AI Agents](../agentic-ai/building-agents)

Rule-based agent reasoning with decision trees and context awareness.

#### [Multi-Agent Systems](../agentic-ai/multi-agent)

Multi-MCP server coordination for complex task management.

#### [Agent Orchestration](../agentic-ai/orchestration)

Specialized agent coordination with role-based task distribution.

#### [OpenAI Integration](../integrations/openai)

LLM-powered intelligent agents with tool calling and function orchestration.

### 🏭 Real-World Applications (5 examples)

Complete, production-ready applications:

#### [Blog CMS](real-world/blog-cms)

Full-featured content management system with:

- User management and authentication
- Content creation and editing
- SEO optimization
- Analytics and reporting

#### [Task Manager](real-world/task-manager)

Project management system with:

- Task creation and assignment
- Team collaboration
- Progress tracking
- Deadline management

#### [API Gateway](real-world/api-gateway)

Enterprise API orchestration with:

- Request routing and transformation
- Authentication and authorization
- Rate limiting and throttling
- Monitoring and analytics

#### [Code Analyzer](real-world/code-analyzer)

Development quality tools with:

- Static code analysis
- Security vulnerability detection
- Performance optimization suggestions
- Code style enforcement

#### [Data Pipeline](real-world/data-pipeline)

ETL and data processing with:

- Data ingestion from multiple sources
- Transformation and validation
- Error handling and retries
- Output to various destinations

### 🏢 Enterprise Examples (3 examples)

Production deployment patterns:

#### [Docker Deployment](enterprise/docker-deployment)

Complete containerization setup with:

- Multi-stage Docker builds
- Docker Compose orchestration
- Health checks and monitoring
- Scaling and load balancing

#### [Microservices Architecture](enterprise/microservices)

Distributed systems patterns with:

- Service discovery and registration
- Inter-service communication
- Circuit breakers and fallbacks
- Distributed tracing

#### [Monitoring & Observability](enterprise/monitoring)

Production monitoring with:

- Metrics collection and alerting
- Distributed logging
- Performance monitoring
- Error tracking and reporting

## 📊 Example Categories

### By Complexity Level

| Level            | Examples                    | Description                          |
| ---------------- | --------------------------- | ------------------------------------ |
| **Beginner**     | Hello World, Calculator     | Basic concepts and tool registration |
| **Intermediate** | Weather Client, File Reader | API integration and security         |
| **Advanced**     | Blog CMS, Task Manager      | Complete applications                |
| **Expert**       | API Gateway, Microservices  | Enterprise patterns                  |

### By Use Case

| Use Case        | Examples                 | Best For                     |
| --------------- | ------------------------ | ---------------------------- |
| **Learning**    | Getting Started examples | Understanding MCP concepts   |
| **Integration** | Framework examples       | Adding MCP to existing apps  |
| **AI Agents**   | Agentic AI examples      | Building intelligent systems |
| **Production**  | Enterprise examples      | Deploying at scale           |

## 🚀 Quick Start

### Prerequisites

```bash
# Install PHP MCP SDK
composer require dalehurley/php-mcp-sdk

# Install MCP Inspector for testing
npm install -g @modelcontextprotocol/inspector
```

### Running Your First Example

```bash
# 1. Clone or create the hello world server
# 2. Make it executable
chmod +x hello-world-server.php

# 3. Run the server
php hello-world-server.php

# 4. Test with MCP Inspector
mcp-inspector hello-world-server.php
```

### Testing with Claude Desktop

Add any server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "php",
      "args": ["/path/to/server.php"]
    }
  }
}
```

## 📁 Example Structure

Each example includes:

- **Complete source code** - Copy-paste ready
- **Documentation** - Setup instructions and usage
- **Tests** - Unit and integration tests where applicable
- **Docker support** - Containerization where applicable
- **Detailed explanations** - How and why it works

## 🧪 Comprehensive Example Catalog

### Server Examples

#### Basic Servers

- **Simple Server** (`simple-server.php`) - Mathematical calculations, static resources, prompt templates
- **Weather Server** (`weather-server.php`) - External API integration with caching and rate limiting
- **Database Server** (`sqlite-server.php`) - SQLite operations with safe query execution
- **OAuth Server** (`oauth-server.php`) - Authentication with scope-based access control
- **Resource Server** (`resource-server.php`) - Dynamic resource management and subscriptions

#### Advanced Servers

- **WebSocket Server** - Real-time bidirectional communication
- **HTTP Streaming Server** - Server-sent events and streaming responses
- **Multi-Transport Server** - Supporting multiple transport types simultaneously

### Client Examples

#### Basic Clients

- **Simple STDIO Client** (`simple-stdio-client.php`) - Basic MCP operations and error handling
- **Parallel Tools Client** (`parallel-tools-client.php`) - Concurrent operations and performance comparison
- **OAuth Client** (`oauth-client.php`) - Authentication flow demonstration
- **HTTP Client** (`http-client.php`) - HTTP transport with session management

#### Advanced Clients

- **Multiple Servers Client** (`multiple-servers-client.php`) - Multi-server management and coordination
- **OpenAI MCP Agent** (`openai-mcp-agent.php`) - Dynamic tool discovery with GPT-4 integration
- **WebSocket Client** - Real-time communication patterns
- **Middleware Client** - Request/response transformation

### Framework Integration

#### Laravel Integration

- **Service Provider** (`ExampleMcpServiceProvider.php`) - Laravel-specific tools and resources
- **Inertia Controller** (`McpDemoController.php`) - Web-based MCP client interface
- **React Components** (`Demo.tsx`) - Interactive dashboard
- **Configuration** (`mcp-config.php`) - Comprehensive Laravel setup

#### Symfony Integration

- **Bundle Configuration** - Symfony-specific MCP bundle
- **Console Commands** - CLI tools for MCP management
- **Event Integration** - Symfony event system integration
- **Dependency Injection** - Service container patterns

### Utility Tools

#### Inspector Tool (`utils/inspector.php`)

Comprehensive server analysis:

```bash
# Basic inspection
php utils/inspector.php --server=server.php

# Interactive mode
php utils/inspector.php --server=server.php --interactive

# Generate report
php utils/inspector.php --server=server.php --report --output=report.json
```

#### Monitor Tool (`utils/monitor.php`)

Real-time server monitoring:

```bash
# Basic monitoring
php utils/monitor.php --server=server.php

# Dashboard mode with alerts
php utils/monitor.php --server=server.php --dashboard --alerts
```

## 🐳 Docker Examples

### Quick Start with Docker

```bash
# Build and start all services
cd examples/docker
docker-compose up -d

# View running services
docker-compose ps

# Check logs
docker-compose logs -f mcp-simple-server

# Connect to client
docker-compose exec mcp-client bash
```

### Individual Services

```bash
# Start specific server
docker-compose up mcp-weather-server

# Run client in different modes
docker-compose run --rm mcp-client
MCP_CLIENT_MODE=inspector docker-compose run --rm mcp-client
MCP_CLIENT_MODE=monitor docker-compose run --rm mcp-client

# Laravel integration
docker-compose up laravel-mcp
# Access at http://localhost:8080
```

## 📚 Learning Path

### 1. Start with Simple Examples (30 minutes)

- Run `hello-world-server.php` and `hello-world-client.php`
- Understand basic MCP concepts
- Learn tool calling patterns

### 2. Explore Advanced Features (1 hour)

- Try the weather server for API integration
- Use the database server for data operations
- Test the calculator for multiple tools

### 3. Test Authentication (30 minutes)

- Run the OAuth server and client
- Understand scope-based access control
- Learn token management

### 4. Use Utility Tools (30 minutes)

- Inspect servers with the inspector tool
- Monitor performance with the monitor tool
- Generate comprehensive reports

### 5. Try Framework Integration (1 hour)

- Set up the Laravel service provider
- Use the Inertia.js interface
- Explore Symfony integration

### 6. Deploy with Docker (30 minutes)

- Use Docker Compose for full stack deployment
- Scale with multiple server instances
- Monitor with containerized tools

## 🔧 Configuration

### Environment Variables

```bash
# Weather Server
OPENWEATHER_API_KEY=your_api_key_here

# OAuth Server
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_ISSUER=https://your-auth-server.com

# HTTP Client
MCP_HTTP_SERVER_URL=http://localhost:3000

# Laravel Integration
MCP_ENABLED=true
MCP_HTTP_ENABLED=true
MCP_AUTH_ENABLED=true
```

### Docker Environment

```bash
# Server Configuration
MCP_SERVER_TYPE=simple|weather|database|oauth|resource
MCP_LOG_LEVEL=info|debug|error
MCP_ENVIRONMENT=production|development

# Client Configuration
MCP_CLIENT_MODE=interactive|parallel|oauth|http|inspector|monitor
MCP_TARGET_SERVER=simple-server|weather-server|database-server
```

## 🧪 Testing Examples

All examples include comprehensive testing:

```bash
# Run tests for a specific example
cd examples/real-world/blog-cms
composer test

# Run all example tests
composer test-examples

# Test with different PHP versions
docker run --rm -v $(pwd):/app php:8.1-cli php /app/examples/test-runner.php
docker run --rm -v $(pwd):/app php:8.2-cli php /app/examples/test-runner.php
docker run --rm -v $(pwd):/app php:8.3-cli php /app/examples/test-runner.php
```

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**

```bash
# Check PHP syntax
php -l examples/server/simple-server.php

# Check required extensions
php -m | grep -E "(pcntl|sockets|pdo_sqlite)"

# Check permissions
ls -la examples/server/
```

**Client connection fails:**

```bash
# Verify server is running
ps aux | grep php

# Check for port conflicts
netstat -tulpn | grep :3000

# Test server directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | php examples/server/simple-server.php
```

**Docker issues:**

```bash
# Rebuild containers
docker-compose build --no-cache

# Check container logs
docker-compose logs mcp-simple-server

# Clean up
docker-compose down -v
docker system prune
```

### Performance Tips

1. **Use parallel operations** when calling multiple tools
2. **Enable caching** for frequently accessed resources
3. **Monitor memory usage** with long-running servers
4. **Use connection pooling** for multiple clients
5. **Implement proper error handling** and retries

## 💡 Example Ideas

Looking for inspiration? Try building:

- **E-commerce Platform** - Product catalog, shopping cart, payments
- **Social Media Dashboard** - Multi-platform posting and analytics
- **IoT Device Manager** - Device monitoring and control
- **Document Processing** - OCR, translation, summarization
- **Financial Analytics** - Market data analysis and reporting
- **Content Management** - Multi-site CMS with workflow
- **DevOps Tools** - Deployment, monitoring, and automation
- **Educational Platform** - Course management and assessment

## 🤝 Contributing Examples

We welcome new examples! See our [Contributing Guide](../contributing) for:

- Example standards and structure
- Testing requirements
- Documentation format
- Submission process

### Example Template

```php
#!/usr/bin/env php
<?php

/**
 * [Example Name] MCP Server
 *
 * [Brief description of what this example demonstrates]
 *
 * Features:
 * - [Feature 1]
 * - [Feature 2]
 * - [Feature 3]
 *
 * Usage:
 *   php [filename].php
 */

require_once __DIR__ . '/vendor/autoload.php';

// Your example code here
```

## 📖 Additional Resources

- [PHP MCP SDK Documentation](../guide/getting-started)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [TypeScript SDK Examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples)
- [Laravel Documentation](https://laravel.com/docs)
- [Symfony Documentation](https://symfony.com/doc)

## 🆘 Getting Help

- [📖 Full Documentation](../api/)
- [💬 Community Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions)
- [🐛 Report Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- [📧 Direct Support](mailto:support@example.com)

Ready to start building? Pick an example that matches your goals and dive in! 🚀

---

**All examples are tested and working!** 🎉 Each example includes comprehensive documentation, error handling, and follows MCP best practices.
