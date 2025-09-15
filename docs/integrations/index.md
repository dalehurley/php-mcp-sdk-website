# Framework Integrations

The PHP MCP SDK is designed to work seamlessly with popular PHP frameworks through its PSR-compliant architecture.

## Available Integrations

### [Laravel Integration](laravel)

Complete Laravel integration with:

- Service providers and facades
- Artisan commands
- Middleware support
- Blade components
- Queue integration

### [Symfony Integration](symfony)

Full Symfony integration with:

- Bundle configuration
- Console commands
- Event system integration
- Dependency injection
- Twig extensions

### [OpenAI Integration](openai)

AI-powered tool calling with:

- Function calling support
- Streaming responses
- Error handling
- Token management

### [FullCX Integration](fullcx)

Product management platform integration with:

- Requirements management
- Feature tracking
- User story integration
- Analytics and reporting

## Coming Soon

- **WordPress Plugin** - MCP integration for WordPress
- **Drupal Module** - Drupal-specific MCP tools
- **CodeIgniter Integration** - Lightweight framework support
- **CakePHP Plugin** - Convention over configuration

## Generic PHP Integration

For frameworks not listed above, the PHP MCP SDK can be integrated using standard PSR patterns:

```php
// Basic integration example
use MCP\Server\McpServer;
use MCP\Types\Implementation;

class MyFrameworkMcpIntegration
{
    public function createServer(): McpServer
    {
        $server = new McpServer(
            new Implementation('my-app', '1.0.0')
        );

        // Register your framework-specific tools
        $this->registerTools($server);

        return $server;
    }

    private function registerTools(McpServer $server): void
    {
        // Add your framework's capabilities as MCP tools
    }
}
```

See the [API Reference](../api/) for detailed integration patterns.
