# Installation & Setup

This guide walks you through installing and setting up the PHP MCP SDK in your project.

## System Requirements

### PHP Version Compatibility

| PHP Version | Status | Notes |
|-------------|--------|-------|
| **8.4** | ✅ Compatible | Not yet in CI; works in practice |
| **8.3** | ✅ Recommended | Best performance, latest features |
| **8.2** | ✅ Supported | Production-ready |
| **8.1** | ✅ Minimum | Supported; upgrade recommended |
| 8.0 and below | ❌ Not supported | Missing fibre and enum support |
| PHP 7.x | ❌ Not supported | EOL; not compatible |

::: tip
PHP 8.3+ is recommended for new projects. It includes performance improvements to fibers and JIT that benefit async MCP servers.
:::

### Required PHP Extensions

| Extension | Purpose | How to Check |
|-----------|---------|--------------|
| `ext-json` | JSON encoding/decoding for MCP messages | `php -m \| grep json` |
| `ext-mbstring` | Multibyte string handling | `php -m \| grep mbstring` |
| `ext-openssl` | SSL/TLS for HTTPS and WSS transports | `php -m \| grep openssl` |

```bash
# Verify all required extensions are loaded
php -r "
  \$required = ['json', 'mbstring', 'openssl'];
  foreach (\$required as \$ext) {
    echo \$ext . ': ' . (extension_loaded(\$ext) ? 'OK' : 'MISSING') . PHP_EOL;
  }
"
```

### Composer

- Composer 2.0 or higher (`composer --version` to check)

### Optional Dependencies

| Dependency | Purpose | Required For |
|-----------|---------|-------------|
| **Node.js 18+** | MCP Inspector GUI | Development debugging |
| **Redis** | Session storage, caching | Production multi-process deployments |
| **Docker** | Containerised deployment | Enterprise/cloud deployments |

## Installation Methods

### 1. Via Composer (Recommended)

#### Stable Release

```bash
composer require dalehurley/php-mcp-sdk
```

#### Latest Development Version

```bash
composer require dalehurley/php-mcp-sdk:dev-main
```

#### Specific Version

```bash
composer require dalehurley/php-mcp-sdk:^1.0
```

### 2. From Source

```bash
# Clone the repository
git clone https://github.com/dalehurley/php-mcp-sdk.git
cd php-mcp-sdk

# Install dependencies
composer install

# Verify installation
composer test
```

## Project Setup

### 1. Basic Project Structure

Create a new project or add to existing:

```bash
mkdir my-mcp-project
cd my-mcp-project
composer init
composer require dalehurley/php-mcp-sdk
```

Recommended project structure:

```
my-mcp-project/
├── composer.json
├── composer.lock
├── src/
│   ├── Server/
│   │   └── MyServer.php
│   └── Tools/
│       ├── WeatherTool.php
│       └── DatabaseTool.php
├── config/
│   └── mcp.php
├── bin/
│   ├── server.php
│   └── client.php
├── tests/
└── .env
```

### 2. Environment Configuration

Create `.env` file:

```env
# Server Configuration
MCP_SERVER_NAME=my-server
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_DESCRIPTION="My MCP Server"

# Transport Settings
MCP_TRANSPORT=stdio
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=127.0.0.1

# Authentication
MCP_AUTH_ENABLED=false
MCP_OAUTH_CLIENT_ID=
MCP_OAUTH_CLIENT_SECRET=

# Logging
MCP_LOG_LEVEL=info
MCP_LOG_FILE=/var/log/mcp-server.log

# Performance
MCP_REQUEST_TIMEOUT=30
MCP_MAX_CONCURRENT_REQUESTS=100
```

### 3. Configuration File

Create `config/mcp.php`:

```php
<?php

return [
    'server' => [
        'name' => env('MCP_SERVER_NAME', 'php-mcp-server'),
        'version' => env('MCP_SERVER_VERSION', '1.0.0'),
        'description' => env('MCP_SERVER_DESCRIPTION', 'PHP MCP Server'),
    ],

    'transport' => [
        'default' => env('MCP_TRANSPORT', 'stdio'),

        'stdio' => [
            'buffer_size' => 8192,
        ],

        'http' => [
            'host' => env('MCP_HTTP_HOST', '127.0.0.1'),
            'port' => (int) env('MCP_HTTP_PORT', 3000),
            'ssl' => false,
            'cors' => [
                'enabled' => true,
                'origins' => ['*'],
                'methods' => ['GET', 'POST'],
                'headers' => ['Content-Type', 'Authorization'],
            ],
        ],
    ],

    'auth' => [
        'enabled' => env('MCP_AUTH_ENABLED', false),
        'provider' => 'oauth2',

        'oauth2' => [
            'client_id' => env('MCP_OAUTH_CLIENT_ID'),
            'client_secret' => env('MCP_OAUTH_CLIENT_SECRET'),
            'redirect_uri' => env('MCP_OAUTH_REDIRECT_URI'),
            'scopes' => ['read', 'write'],
            'pkce' => true,
        ],
    ],

    'logging' => [
        'level' => env('MCP_LOG_LEVEL', 'info'),
        'file' => env('MCP_LOG_FILE'),
        'channels' => ['file', 'stderr'],
    ],

    'performance' => [
        'request_timeout' => (int) env('MCP_REQUEST_TIMEOUT', 30),
        'max_concurrent_requests' => (int) env('MCP_MAX_CONCURRENT_REQUESTS', 100),
        'debounced_notifications' => true,
    ],

    'tools' => [
        // Register your tools here
    ],

    'resources' => [
        // Register your resources here
    ],

    'prompts' => [
        // Register your prompts here
    ],
];
```

## Verify Installation

### 1. Check PHP Version and Extensions

```bash
php -v
php -m | grep -E "(json|mbstring|openssl)"
```

### 2. Verify Composer Dependencies

```bash
composer show dalehurley/php-mcp-sdk
composer validate
```

### 3. Run Basic Test

Create `test-installation.php`:

```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Types\Implementation;
use MCP\Server\McpServer;

try {
    $implementation = new Implementation(
        'test-server',
        '1.0.0',
        'Installation Test Server'
    );

    $server = new McpServer($implementation);

    echo "✅ PHP MCP SDK installed successfully!\n";
    echo "   Server: {$implementation->name} v{$implementation->version}\n";
    echo "   Description: {$implementation->description}\n";

} catch (Exception $e) {
    echo "❌ Installation error: " . $e->getMessage() . "\n";
    exit(1);
}
```

Run the test:

```bash
php test-installation.php
```

### 4. Test with MCP Inspector

```bash
# Install MCP Inspector (requires Node.js)
npm install -g @modelcontextprotocol/inspector

# Create a simple server for testing
cat > test-server.php << 'EOF'
#!/usr/bin/env php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

$server = new McpServer(
    new Implementation('test', '1.0.0', 'Test Server')
);

$server->tool(
    'echo',
    'Echo back the input',
    [
        'type' => 'object',
        'properties' => [
            'message' => ['type' => 'string']
        ]
    ],
    fn($params) => [
        'content' => [['type' => 'text', 'text' => $params['message']]]
    ]
);

async(function () use ($server) {
    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
EOF

chmod +x test-server.php

# Test with inspector
mcp-inspector ./test-server.php
```

## Common Installation Issues

### 1. PHP Version Issues

**Error**: `PHP version requirement not met`

**Solution**:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install php8.1 php8.1-cli php8.1-json php8.1-mbstring

# macOS with Homebrew
brew install php@8.1

# Windows with Chocolatey
choco install php
```

### 2. Missing Extensions

**Error**: `Extension not loaded: json/mbstring`

**Solution**:

```bash
# Ubuntu/Debian
sudo apt install php8.1-json php8.1-mbstring php8.1-openssl

# macOS - usually included with PHP
# Windows - uncomment in php.ini:
extension=json
extension=mbstring
extension=openssl
```

### 3. Composer Issues

**Error**: `Package not found` or `Version conflicts`

**Solution**:

```bash
# Update Composer
composer self-update

# Clear cache
composer clear-cache

# Update dependencies
composer update --with-dependencies

# Install with lower stability
composer require dalehurley/php-mcp-sdk --prefer-stable
```

### 4. Memory Limit Issues

**Error**: `Fatal error: Allowed memory size exhausted`

**Solution**:

```bash
# Temporary increase
php -d memory_limit=512M test-installation.php

# Permanent fix in php.ini
memory_limit = 512M
```

## Performance Optimization

### 1. PHP Configuration

Add to `php.ini`:

```ini
; Increase memory limit
memory_limit = 512M

; Optimize for CLI usage
max_execution_time = 0
max_input_time = -1

; Enable OPcache for production
opcache.enable = 1
opcache.memory_consumption = 128
opcache.max_accelerated_files = 4000
opcache.validate_timestamps = 0
```

### 2. Composer Optimization

```bash
# Optimize autoloader for production
composer install --no-dev --optimize-autoloader

# Enable APCu cache
composer config cache-files-dir /tmp/composer-cache
```

## Framework Integration

### Laravel

If you're using Laravel, consider the dedicated Laravel MCP SDK package:

```bash
composer require dalehurley/laravel-mcp-sdk
```

See the [Laravel Integration Guide](../integrations/laravel) for details.

### Symfony

For Symfony applications:

```bash
composer require dalehurley/php-mcp-sdk
```

See the [Symfony Integration Guide](../integrations/symfony) for configuration details.

## Next Steps

1. [📚 Read the Quick Start Guide](quick-start)
2. [💡 Learn Core Concepts](concepts)
3. [🖥️ Create Your First Server](creating-servers)
4. [📱 Build a Client](creating-clients)

## Getting Help

- [🐛 Report Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- [💬 Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions)
- [📖 Full Documentation](../api/)

You're now ready to start building with the PHP MCP SDK! 🚀
