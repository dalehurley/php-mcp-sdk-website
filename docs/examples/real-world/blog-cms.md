# Blog CMS Example

A complete content management system built with the PHP MCP SDK, demonstrating enterprise-grade features and real-world application patterns.

## Overview

This example shows how to build a full-featured blog CMS using MCP, including:

- User management and authentication
- Content creation and editing
- SEO optimization tools
- Analytics and reporting
- Multi-author support

## Features

### Content Management

- Create, edit, and delete blog posts
- Draft and publish workflows
- Category and tag management
- Media file handling
- SEO metadata management

### User Management

- User registration and authentication
- Role-based permissions (admin, editor, author)
- Profile management
- Activity logging

### Analytics

- Page view tracking
- Popular content reports
- User engagement metrics
- SEO performance analysis

## Quick Start

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;

$server = new McpServer(
    new Implementation('blog-cms', '1.0.0', 'Blog CMS MCP Server')
);

// Content management tools
$server->tool('create_post', 'Create a new blog post', $schema, $handler);
$server->tool('edit_post', 'Edit existing blog post', $schema, $handler);
$server->tool('delete_post', 'Delete blog post', $schema, $handler);
$server->tool('publish_post', 'Publish draft post', $schema, $handler);

// User management tools
$server->tool('create_user', 'Create new user account', $schema, $handler);
$server->tool('update_user', 'Update user profile', $schema, $handler);
$server->tool('list_users', 'List all users', $schema, $handler);

// Analytics tools
$server->tool('get_analytics', 'Get blog analytics', $schema, $handler);
$server->tool('popular_posts', 'Get popular posts', $schema, $handler);

// Resources
$server->resource('posts', 'blog://posts', 'application/json', $postsHandler);
$server->resource('users', 'blog://users', 'application/json', $usersHandler);
$server->resource('analytics', 'blog://analytics', 'application/json', $analyticsHandler);

// Start server
$transport = new StdioServerTransport();
$server->connect($transport)->await();
```

## Implementation Details

This is a comprehensive example that demonstrates:

- Database integration with proper ORM patterns
- Authentication and authorization
- File upload and media management
- SEO optimization features
- Analytics and reporting
- Admin dashboard functionality

## See Also

- [Complete Source Code](https://github.com/dalehurley/php-mcp-sdk/tree/main/examples/real-world/blog-cms)
- [Installation Guide](../../guide/installation)
- [Authentication Guide](../../guide/authentication)
