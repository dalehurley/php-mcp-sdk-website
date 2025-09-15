# Creating MCP Servers

Learn how to build production-ready MCP servers with advanced features, proper error handling, and scalable architecture.

## 🎯 Overview

This guide covers everything you need to know to create robust MCP servers that can handle real-world use cases. We'll go beyond the basics to show you professional patterns and best practices.

## 🏗️ Server Architecture

### Basic Server Structure

```php
<?php

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

class MyMcpServer
{
    private McpServer $server;
    private array $config;

    public function __construct(array $config = [])
    {
        $this->config = $config;
        $this->server = new McpServer(
            new Implementation(
                $config['name'] ?? 'my-server',
                $config['version'] ?? '1.0.0',
                $config['description'] ?? 'My MCP Server'
            )
        );

        $this->registerTools();
        $this->registerResources();
        $this->registerPrompts();
    }

    private function registerTools(): void
    {
        // Tool registration logic
    }

    private function registerResources(): void
    {
        // Resource registration logic
    }

    private function registerPrompts(): void
    {
        // Prompt registration logic
    }

    public function start(): void
    {
        async(function () {
            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}
```

## 🔧 Tool Development

### Tool Design Principles

1. **Single Responsibility** - Each tool should do one thing well
2. **Clear Naming** - Use descriptive, action-oriented names
3. **Comprehensive Schemas** - Define clear input/output contracts
4. **Error Handling** - Handle all edge cases gracefully
5. **Documentation** - Provide helpful descriptions and examples

### Advanced Tool Example

```php
$server->tool(
    'process_document',
    'Process and analyze document content',
    [
        'type' => 'object',
        'properties' => [
            'content' => [
                'type' => 'string',
                'description' => 'Document content to process',
                'minLength' => 1,
                'maxLength' => 100000
            ],
            'format' => [
                'type' => 'string',
                'enum' => ['markdown', 'html', 'plain'],
                'default' => 'plain',
                'description' => 'Content format'
            ],
            'options' => [
                'type' => 'object',
                'properties' => [
                    'extract_keywords' => ['type' => 'boolean', 'default' => true],
                    'generate_summary' => ['type' => 'boolean', 'default' => false],
                    'word_count' => ['type' => 'boolean', 'default' => true]
                ],
                'additionalProperties' => false
            ]
        ],
        'required' => ['content'],
        'additionalProperties' => false
    ],
    function (array $params): array {
        try {
            // Input validation
            $content = trim($params['content']);
            if (empty($content)) {
                throw new McpError(
                    ErrorCode::InvalidParams,
                    'Content cannot be empty'
                );
            }

            $format = $params['format'] ?? 'plain';
            $options = $params['options'] ?? [];

            // Process the document
            $result = [
                'format' => $format,
                'length' => strlen($content),
                'processed_at' => date('c')
            ];

            // Optional processing based on options
            if ($options['word_count'] ?? true) {
                $result['word_count'] = str_word_count($content);
            }

            if ($options['extract_keywords'] ?? true) {
                $result['keywords'] = $this->extractKeywords($content);
            }

            if ($options['generate_summary'] ?? false) {
                $result['summary'] = $this->generateSummary($content);
            }

            return [
                'content' => [[
                    'type' => 'text',
                    'text' => json_encode($result, JSON_PRETTY_PRINT)
                ]]
            ];

        } catch (McpError $e) {
            throw $e; // Re-throw MCP errors
        } catch (\Exception $e) {
            throw new McpError(
                ErrorCode::InternalError,
                'Document processing failed: ' . $e->getMessage()
            );
        }
    }
);
```

## 📦 Resource Management

### Dynamic Resources

```php
$server->resource(
    'user-data',
    'user://{user_id}/profile',
    'application/json',
    function (string $uri): array {
        // Extract user ID from URI
        if (!preg_match('/user:\/\/(\d+)\/profile/', $uri, $matches)) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'Invalid user URI format'
            );
        }

        $userId = (int)$matches[1];
        
        // Validate user exists
        if (!$this->userExists($userId)) {
            throw new McpError(
                ErrorCode::InvalidParams,
                "User {$userId} not found"
            );
        }

        // Get user data
        $userData = $this->getUserData($userId);

        return [
            'contents' => [[
                'uri' => $uri,
                'mimeType' => 'application/json',
                'text' => json_encode($userData, JSON_PRETTY_PRINT)
            ]]
        ];
    }
);
```

### File-Based Resources

```php
$server->resource(
    'project-files',
    'file://{path}',
    'text/plain',
    function (string $uri): array {
        // Extract and validate file path
        if (!preg_match('/file:\/\/(.+)/', $uri, $matches)) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'Invalid file URI format'
            );
        }

        $path = urldecode($matches[1]);
        
        // Security: Restrict to allowed directories
        $allowedPaths = ['/var/www/project', '/home/user/documents'];
        $realPath = realpath($path);
        
        if (!$realPath || !$this->isPathAllowed($realPath, $allowedPaths)) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'Access denied to file path'
            );
        }

        if (!file_exists($realPath)) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'File not found'
            );
        }

        // Determine MIME type
        $mimeType = mime_content_type($realPath) ?: 'text/plain';
        
        return [
            'contents' => [[
                'uri' => $uri,
                'mimeType' => $mimeType,
                'text' => file_get_contents($realPath)
            ]]
        ];
    }
);
```

## 💭 Prompt Engineering

### Context-Aware Prompts

```php
$server->prompt(
    'code_review',
    'Generate comprehensive code review prompts',
    [
        [
            'name' => 'code',
            'description' => 'Code to review',
            'required' => true
        ],
        [
            'name' => 'language',
            'description' => 'Programming language',
            'required' => true
        ],
        [
            'name' => 'focus_areas',
            'description' => 'Specific areas to focus on',
            'required' => false
        ],
        [
            'name' => 'severity_level',
            'description' => 'Review severity level',
            'required' => false
        ]
    ],
    function (array $arguments): array {
        $code = $arguments['code'];
        $language = $arguments['language'];
        $focusAreas = $arguments['focus_areas'] ?? ['security', 'performance', 'maintainability'];
        $severityLevel = $arguments['severity_level'] ?? 'standard';

        // Build context-specific prompt
        $prompt = "You are an expert {$language} code reviewer. ";
        
        if ($severityLevel === 'strict') {
            $prompt .= "Apply strict coding standards and best practices. ";
        } elseif ($severityLevel === 'lenient') {
            $prompt .= "Focus on critical issues only. ";
        }

        $prompt .= "Review the following code focusing on: " . implode(', ', $focusAreas) . ".\n\n";
        $prompt .= "Provide specific, actionable feedback with examples where appropriate.\n\n";
        $prompt .= "Code to review:\n```{$language}\n{$code}\n```";

        return [
            'description' => "Code review for {$language} code",
            'messages' => [[
                'role' => 'user',
                'content' => [[
                    'type' => 'text',
                    'text' => $prompt
                ]]
            ]]
        ];
    }
);
```

## 🔐 Security & Validation

### Input Sanitization

```php
class SecurityValidator
{
    public static function sanitizeString(string $input, int $maxLength = 1000): string
    {
        // Remove null bytes and control characters
        $input = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $input);
        
        // Trim whitespace
        $input = trim($input);
        
        // Limit length
        if (strlen($input) > $maxLength) {
            $input = substr($input, 0, $maxLength);
        }
        
        return $input;
    }

    public static function validatePath(string $path, array $allowedPaths): bool
    {
        $realPath = realpath($path);
        if (!$realPath) {
            return false;
        }

        foreach ($allowedPaths as $allowedPath) {
            if (strpos($realPath, realpath($allowedPath)) === 0) {
                return true;
            }
        }

        return false;
    }

    public static function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
}
```

### Rate Limiting

```php
class RateLimiter
{
    private array $requests = [];
    private int $maxRequests;
    private int $timeWindow;

    public function __construct(int $maxRequests = 100, int $timeWindow = 60)
    {
        $this->maxRequests = $maxRequests;
        $this->timeWindow = $timeWindow;
    }

    public function isAllowed(string $clientId): bool
    {
        $now = time();
        $windowStart = $now - $this->timeWindow;

        // Clean old requests
        if (isset($this->requests[$clientId])) {
            $this->requests[$clientId] = array_filter(
                $this->requests[$clientId],
                fn($timestamp) => $timestamp > $windowStart
            );
        }

        // Check rate limit
        $requestCount = count($this->requests[$clientId] ?? []);
        
        if ($requestCount >= $this->maxRequests) {
            return false;
        }

        // Record this request
        $this->requests[$clientId][] = $now;
        
        return true;
    }
}
```

## 📊 Monitoring & Logging

### Structured Logging

```php
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Formatter\JsonFormatter;

class McpLogger
{
    private Logger $logger;

    public function __construct(string $name = 'mcp-server')
    {
        $this->logger = new Logger($name);

        // Console output
        $consoleHandler = new StreamHandler('php://stdout', Logger::INFO);
        $this->logger->pushHandler($consoleHandler);

        // File output with rotation
        $fileHandler = new RotatingFileHandler(
            '/var/log/mcp-server.log',
            0,
            Logger::DEBUG
        );
        $fileHandler->setFormatter(new JsonFormatter());
        $this->logger->pushHandler($fileHandler);
    }

    public function logToolCall(string $toolName, array $params, float $duration, bool $success): void
    {
        $this->logger->info('Tool called', [
            'tool' => $toolName,
            'params' => $params,
            'duration_ms' => round($duration * 1000, 2),
            'success' => $success,
            'timestamp' => microtime(true)
        ]);
    }

    public function logError(string $context, \Exception $error): void
    {
        $this->logger->error('Error occurred', [
            'context' => $context,
            'error' => $error->getMessage(),
            'file' => $error->getFile(),
            'line' => $error->getLine(),
            'trace' => $error->getTraceAsString()
        ]);
    }
}
```

### Performance Monitoring

```php
class PerformanceMonitor
{
    private array $metrics = [];

    public function startTimer(string $operation): void
    {
        $this->metrics[$operation] = [
            'start' => microtime(true),
            'memory_start' => memory_get_usage()
        ];
    }

    public function endTimer(string $operation): array
    {
        if (!isset($this->metrics[$operation])) {
            throw new \InvalidArgumentException("Timer for '{$operation}' was not started");
        }

        $start = $this->metrics[$operation];
        $duration = microtime(true) - $start['start'];
        $memoryUsed = memory_get_usage() - $start['memory_start'];

        $result = [
            'operation' => $operation,
            'duration_ms' => round($duration * 1000, 2),
            'memory_used_bytes' => $memoryUsed,
            'memory_used_mb' => round($memoryUsed / 1024 / 1024, 2)
        ];

        unset($this->metrics[$operation]);

        return $result;
    }
}
```

## 🔄 Advanced Patterns

### Plugin System

```php
interface McpPlugin
{
    public function getName(): string;
    public function getVersion(): string;
    public function register(McpServer $server): void;
    public function initialize(): void;
    public function shutdown(): void;
}

class PluginManager
{
    private array $plugins = [];
    private McpServer $server;

    public function __construct(McpServer $server)
    {
        $this->server = $server;
    }

    public function loadPlugin(McpPlugin $plugin): void
    {
        $name = $plugin->getName();
        
        if (isset($this->plugins[$name])) {
            throw new \InvalidArgumentException("Plugin '{$name}' is already loaded");
        }

        $this->plugins[$name] = $plugin;
        $plugin->register($this->server);
        $plugin->initialize();
    }

    public function unloadPlugin(string $name): void
    {
        if (!isset($this->plugins[$name])) {
            throw new \InvalidArgumentException("Plugin '{$name}' is not loaded");
        }

        $this->plugins[$name]->shutdown();
        unset($this->plugins[$name]);
    }

    public function getLoadedPlugins(): array
    {
        return array_keys($this->plugins);
    }
}
```

### Middleware System

```php
interface McpMiddleware
{
    public function handle(array $request, callable $next): array;
}

class AuthenticationMiddleware implements McpMiddleware
{
    private array $validTokens;

    public function __construct(array $validTokens)
    {
        $this->validTokens = $validTokens;
    }

    public function handle(array $request, callable $next): array
    {
        // Skip authentication for initialize method
        if ($request['method'] === 'initialize') {
            return $next($request);
        }

        $token = $request['params']['auth_token'] ?? null;
        
        if (!$token || !in_array($token, $this->validTokens)) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Invalid or missing authentication token'
            );
        }

        return $next($request);
    }
}

class MiddlewareStack
{
    private array $middleware = [];

    public function add(McpMiddleware $middleware): void
    {
        $this->middleware[] = $middleware;
    }

    public function handle(array $request, callable $finalHandler): array
    {
        $stack = array_reduce(
            array_reverse($this->middleware),
            fn($next, $middleware) => fn($req) => $middleware->handle($req, $next),
            $finalHandler
        );

        return $stack($request);
    }
}
```

## 🧪 Testing Your Server

### Unit Testing

```php
use PHPUnit\Framework\TestCase;

class McpServerTest extends TestCase
{
    private MyMcpServer $server;

    protected function setUp(): void
    {
        $this->server = new MyMcpServer([
            'name' => 'test-server',
            'version' => '1.0.0'
        ]);
    }

    public function testToolRegistration(): void
    {
        $tools = $this->server->listTools();
        
        $this->assertNotEmpty($tools['tools']);
        $this->assertArrayHasKey('process_document', $tools['tools']);
    }

    public function testDocumentProcessing(): void
    {
        $result = $this->server->callTool('process_document', [
            'content' => 'This is a test document.',
            'format' => 'plain',
            'options' => ['word_count' => true]
        ]);

        $this->assertArrayHasKey('content', $result);
        $data = json_decode($result['content'][0]['text'], true);
        $this->assertEquals(5, $data['word_count']);
    }
}
```

### Integration Testing

```php
use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;

class ServerIntegrationTest extends TestCase
{
    public function testFullWorkflow(): void
    {
        $client = new Client(new Implementation('test-client', '1.0.0'));
        $transport = new StdioClientTransport([
            'command' => 'php',
            'args' => [__DIR__ . '/../server.php']
        ]);

        async(function() use ($client, $transport) {
            // Connect
            yield $client->connect($transport);

            // Test tool call
            $result = yield $client->callTool('process_document', [
                'content' => 'Test content'
            ]);

            $this->assertNotEmpty($result['content']);

            // Clean up
            yield $client->close();
        })->await();
    }
}
```

## 📚 Best Practices

### 1. Configuration Management

```php
class ServerConfig
{
    public static function load(string $configPath): array
    {
        if (!file_exists($configPath)) {
            throw new \InvalidArgumentException("Config file not found: {$configPath}");
        }

        $config = json_decode(file_get_contents($configPath), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \InvalidArgumentException("Invalid JSON in config file");
        }

        return array_merge(self::getDefaults(), $config);
    }

    private static function getDefaults(): array
    {
        return [
            'name' => 'mcp-server',
            'version' => '1.0.0',
            'description' => 'MCP Server',
            'max_request_size' => 1024 * 1024, // 1MB
            'timeout' => 30,
            'debug' => false
        ];
    }
}
```

### 2. Graceful Shutdown

```php
class GracefulServer
{
    private bool $shutdownRequested = false;
    private McpServer $server;

    public function __construct(McpServer $server)
    {
        $this->server = $server;
        $this->registerSignalHandlers();
    }

    private function registerSignalHandlers(): void
    {
        pcntl_signal(SIGTERM, [$this, 'handleShutdown']);
        pcntl_signal(SIGINT, [$this, 'handleShutdown']);
    }

    public function handleShutdown(int $signal): void
    {
        echo "Received shutdown signal ({$signal}). Gracefully shutting down...\n";
        $this->shutdownRequested = true;
    }

    public function run(): void
    {
        async(function() {
            while (!$this->shutdownRequested) {
                // Process requests
                pcntl_signal_dispatch();
                yield delay(100); // Small delay to prevent busy waiting
            }

            echo "Server shutdown complete.\n";
        })->await();
    }
}
```

### 3. Health Checks

```php
$server->tool(
    'health_check',
    'Check server health and status',
    ['type' => 'object', 'properties' => []],
    function (): array {
        $status = [
            'status' => 'healthy',
            'timestamp' => date('c'),
            'version' => '1.0.0',
            'uptime' => time() - $_SERVER['REQUEST_TIME'],
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ];

        // Add custom health checks
        $status['database'] = $this->checkDatabaseConnection();
        $status['external_apis'] = $this->checkExternalApis();

        return [
            'content' => [[
                'type' => 'text',
                'text' => json_encode($status, JSON_PRETTY_PRINT)
            ]]
        ];
    }
);
```

## 🚀 Next Steps

1. **[Authentication Guide](authentication)** - Add security to your servers
2. **[Transport Guide](transports)** - Learn about different transport options
3. **[Performance Guide](performance)** - Optimize for production
4. **[Real-World Examples](../examples/real-world/)** - See complete applications

## 📖 Additional Resources

- [Server API Reference](../api/server)
- [Error Handling Guide](error-handling)
- [Testing Guide](testing)
- [Deployment Guide](../enterprise/deployment)

Building robust MCP servers requires attention to security, performance, and maintainability. Use these patterns as a foundation for your production servers!
