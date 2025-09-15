# Troubleshooting Guide

Common issues and solutions when working with the PHP MCP SDK.

## Common Issues

### Server Won't Start

**Symptoms:** Server exits immediately or shows errors

**Solutions:**

```bash
# Check PHP version
php --version  # Should be 8.1+

# Check syntax
php -l server.php

# Check extensions
php -m | grep -E "(json|mbstring)"

# Run with debug
DEBUG=1 php server.php
```

### Client Connection Fails

**Symptoms:** Client can't connect to server

**Solutions:**

```bash
# Check if server is running
ps aux | grep server.php

# Test server directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | php server.php

# Check permissions
chmod +x server.php
```

### Tool Call Errors

**Symptoms:** Tool calls fail with validation errors

**Solutions:**

- Verify parameter names match schema exactly
- Check parameter types (string vs number)
- Ensure required parameters are provided
- Validate parameter values against constraints

### Memory Issues

**Symptoms:** Server crashes with memory errors

**Solutions:**

```bash
# Increase memory limit
php -d memory_limit=512M server.php

# Monitor memory usage
php -d memory_limit=512M -d log_errors=1 server.php
```

## Debugging Tips

### Enable Debug Logging

```php
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

$logger = new Logger('mcp-debug');
$logger->pushHandler(new StreamHandler('php://stderr', Logger::DEBUG));

$server->setLogger($logger);
```

### Request/Response Logging

```php
$server->addMiddleware(function($request, $next) use ($logger) {
    $logger->info('Request', $request);

    try {
        $response = $next($request);
        $logger->info('Response', $response);
        return $response;
    } catch (\Exception $e) {
        $logger->error('Error', ['exception' => $e->getMessage()]);
        throw $e;
    }
});
```

## Performance Issues

### Slow Tool Execution

**Symptoms:** Tools take too long to respond

**Solutions:**

- Add caching for expensive operations
- Use async operations for I/O
- Implement timeouts
- Profile code to find bottlenecks

### High Memory Usage

**Symptoms:** Server uses excessive memory

**Solutions:**

- Stream large responses instead of loading into memory
- Implement garbage collection
- Use generators for large datasets
- Monitor memory usage

## Getting Help

- [GitHub Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- [Community Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions)
- [Documentation](../api/)
