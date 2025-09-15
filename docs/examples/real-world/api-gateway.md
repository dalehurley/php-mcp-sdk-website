# API Gateway Example

Enterprise API orchestration system with authentication, rate limiting, and comprehensive monitoring.

## Overview

This example demonstrates:

- Request routing and transformation
- Authentication and authorization
- Rate limiting and throttling
- Monitoring and analytics
- Load balancing and failover

## Features

- **Request Routing**: Intelligent routing based on patterns
- **Authentication**: Multiple auth providers (OAuth, API keys, JWT)
- **Rate Limiting**: Per-client and global rate limits
- **Monitoring**: Real-time metrics and alerting
- **Transformation**: Request/response transformation

## Quick Start

```php
$server = new McpServer(new Implementation('api-gateway', '1.0.0'));

// Gateway management tools
$server->tool('route_request', 'Route API request', $schema, $handler);
$server->tool('add_route', 'Add new route', $schema, $handler);
$server->tool('get_metrics', 'Get API metrics', $schema, $handler);

// Authentication tools
$server->tool('validate_token', 'Validate API token', $schema, $handler);
$server->tool('create_api_key', 'Create new API key', $schema, $handler);
```

See the [complete implementation](https://github.com/dalehurley/php-mcp-sdk/tree/main/examples/real-world/api-gateway) for full source code.
