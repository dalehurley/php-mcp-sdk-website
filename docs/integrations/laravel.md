# Laravel MCP SDK - Complete Integration Guide

The Laravel MCP SDK provides comprehensive support for the MCP 2025-06-18 specification with Laravel's elegant developer experience. This guide covers server implementation, client usage, OpenAI integration for agentic workflows, and production best practices.

## Quick Start

### Installation

```bash
composer require dalehurley/laravel-php-mcp-sdk
```

### Basic Setup

```bash
# Install MCP scaffolding
php artisan mcp:install

# Create your first tool
php artisan make:mcp-tool WeatherTool

# Start the server
php artisan mcp:server start
```

## Service Provider Setup

### Basic Service Provider

Create `app/Providers/McpServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use MCP\Server\McpServer;
use MCP\Types\Implementation;

class McpServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(McpServer::class, function ($app) {
            $server = new McpServer(
                new Implementation(
                    config('app.name', 'laravel-app'),
                    config('app.version', '1.0.0'),
                    'Laravel MCP Server'
                )
            );

            $this->registerLaravelTools($server);
            $this->registerLaravelResources($server);

            return $server;
        });
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../../config/mcp.php' => config_path('mcp.php'),
        ], 'mcp-config');
    }

    private function registerLaravelTools(McpServer $server): void
    {
        // User management tools
        $server->tool(
            'get_users',
            'Get users from database',
            [
                'type' => 'object',
                'properties' => [
                    'limit' => ['type' => 'integer', 'default' => 10],
                    'search' => ['type' => 'string']
                ]
            ],
            function (array $params): array {
                $query = \App\Models\User::query();

                if (!empty($params['search'])) {
                    $query->where('name', 'like', "%{$params['search']}%")
                          ->orWhere('email', 'like', "%{$params['search']}%");
                }

                $users = $query->limit($params['limit'] ?? 10)->get();

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $users->toJson(JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Artisan command execution
        $server->tool(
            'run_artisan',
            'Execute Artisan command',
            [
                'type' => 'object',
                'properties' => [
                    'command' => ['type' => 'string'],
                    'arguments' => ['type' => 'array', 'default' => []]
                ],
                'required' => ['command']
            ],
            function (array $params): array {
                $command = $params['command'];
                $arguments = $params['arguments'] ?? [];

                // Security: Only allow specific commands
                $allowedCommands = [
                    'cache:clear', 'config:cache', 'route:list',
                    'queue:work', 'migrate:status'
                ];

                if (!in_array($command, $allowedCommands)) {
                    throw new \MCP\Types\McpError(
                        \MCP\Types\ErrorCode::Forbidden,
                        "Command '{$command}' not allowed"
                    );
                }

                $exitCode = \Illuminate\Support\Facades\Artisan::call($command, $arguments);
                $output = \Illuminate\Support\Facades\Artisan::output();

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Command: {$command}\nExit Code: {$exitCode}\nOutput:\n{$output}"
                    ]]
                ];
            }
        );

        // Cache management
        $server->tool(
            'cache_get',
            'Get cached value',
            [
                'type' => 'object',
                'properties' => [
                    'key' => ['type' => 'string']
                ],
                'required' => ['key']
            ],
            function (array $params): array {
                $value = \Illuminate\Support\Facades\Cache::get($params['key']);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'key' => $params['key'],
                            'value' => $value,
                            'exists' => $value !== null
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        $server->tool(
            'cache_set',
            'Set cached value',
            [
                'type' => 'object',
                'properties' => [
                    'key' => ['type' => 'string'],
                    'value' => ['type' => 'string'],
                    'ttl' => ['type' => 'integer', 'default' => 3600]
                ],
                'required' => ['key', 'value']
            ],
            function (array $params): array {
                $ttl = $params['ttl'] ?? 3600;

                \Illuminate\Support\Facades\Cache::put(
                    $params['key'],
                    $params['value'],
                    $ttl
                );

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Cached '{$params['key']}' for {$ttl} seconds"
                    ]]
                ];
            }
        );
    }

    private function registerLaravelResources(McpServer $server): void
    {
        // Application configuration
        $server->resource(
            'app-config',
            'laravel://config/{key}',
            'application/json',
            function (string $uri): array {
                if (!preg_match('/laravel:\/\/config\/(.+)/', $uri, $matches)) {
                    throw new \MCP\Types\McpError(
                        \MCP\Types\ErrorCode::InvalidParams,
                        'Invalid config URI format'
                    );
                }

                $configKey = urldecode($matches[1]);
                $value = config($configKey);

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode([
                            'key' => $configKey,
                            'value' => $value
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Route information
        $server->resource(
            'routes',
            'laravel://routes',
            'application/json',
            function (string $uri): array {
                $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())
                    ->map(function ($route) {
                        return [
                            'uri' => $route->uri(),
                            'methods' => $route->methods(),
                            'name' => $route->getName(),
                            'action' => $route->getActionName()
                        ];
                    })
                    ->values()
                    ->all();

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode($routes, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Application logs
        $server->resource(
            'logs',
            'laravel://logs/{date}',
            'text/plain',
            function (string $uri): array {
                if (!preg_match('/laravel:\/\/logs\/(.+)/', $uri, $matches)) {
                    throw new \MCP\Types\McpError(
                        \MCP\Types\ErrorCode::InvalidParams,
                        'Invalid log URI format'
                    );
                }

                $date = urldecode($matches[1]);
                $logFile = storage_path("logs/laravel-{$date}.log");

                if (!file_exists($logFile)) {
                    throw new \MCP\Types\McpError(
                        \MCP\Types\ErrorCode::InvalidParams,
                        "Log file not found for date: {$date}"
                    );
                }

                $content = file_get_contents($logFile);

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'text/plain',
                        'text' => $content
                    ]]
                ];
            }
        );
    }
}
```

### Register the Service Provider

Add to `config/app.php`:

```php
'providers' => [
    // Other providers...
    App\Providers\McpServiceProvider::class,
],
```

## Configuration

### MCP Configuration File

Create `config/mcp.php`:

```php
<?php

return [
    'server' => [
        'name' => env('MCP_SERVER_NAME', config('app.name')),
        'version' => env('MCP_SERVER_VERSION', '1.0.0'),
        'description' => env('MCP_SERVER_DESCRIPTION', 'Laravel MCP Server'),
    ],

    'transport' => [
        'default' => env('MCP_TRANSPORT', 'stdio'),

        'stdio' => [
            'buffer_size' => 8192,
        ],

        'http' => [
            'host' => env('MCP_HTTP_HOST', '127.0.0.1'),
            'port' => (int) env('MCP_HTTP_PORT', 3000),
            'ssl' => env('MCP_HTTP_SSL', false),
            'cors' => [
                'enabled' => true,
                'origins' => explode(',', env('MCP_CORS_ORIGINS', '*')),
                'methods' => ['GET', 'POST'],
                'headers' => ['Content-Type', 'Authorization'],
            ],
        ],
    ],

    'auth' => [
        'enabled' => env('MCP_AUTH_ENABLED', false),
        'provider' => env('MCP_AUTH_PROVIDER', 'sanctum'),

        'sanctum' => [
            'guard' => 'sanctum',
        ],

        'oauth2' => [
            'client_id' => env('MCP_OAUTH_CLIENT_ID'),
            'client_secret' => env('MCP_OAUTH_CLIENT_SECRET'),
            'redirect_uri' => env('MCP_OAUTH_REDIRECT_URI'),
            'scopes' => explode(',', env('MCP_OAUTH_SCOPES', 'read,write')),
        ],
    ],

    'tools' => [
        'enabled' => [
            'user_management' => true,
            'cache_management' => true,
            'artisan_commands' => true,
            'database_queries' => false, // Security: disabled by default
        ],

        'artisan' => [
            'allowed_commands' => [
                'cache:clear',
                'config:cache',
                'route:list',
                'queue:work',
                'migrate:status'
            ],
        ],
    ],

    'resources' => [
        'enabled' => [
            'config' => true,
            'routes' => true,
            'logs' => false, // Security: disabled by default
        ],
    ],
];
```

## Artisan Commands

### MCP Server Command

Create `app/Console/Commands/McpServerCommand.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Server\Transport\HttpServerTransport;

class McpServerCommand extends Command
{
    protected $signature = 'mcp:serve
                           {--transport=stdio : Transport type (stdio, http)}
                           {--host=127.0.0.1 : HTTP host}
                           {--port=3000 : HTTP port}';

    protected $description = 'Start the MCP server';

    public function handle(): int
    {
        $server = app(McpServer::class);
        $transport = $this->option('transport');

        $this->info("Starting MCP server with {$transport} transport...");

        try {
            if ($transport === 'http') {
                $httpTransport = new HttpServerTransport([
                    'host' => $this->option('host'),
                    'port' => (int) $this->option('port'),
                ]);

                $this->info("HTTP server starting on {$this->option('host')}:{$this->option('port')}");
                $server->connect($httpTransport)->await();
            } else {
                $stdioTransport = new StdioServerTransport();
                $server->connect($stdioTransport)->await();
            }

            return 0;
        } catch (\Exception $e) {
            $this->error("Failed to start MCP server: {$e->getMessage()}");
            return 1;
        }
    }
}
```

### MCP Client Command

Create `app/Console/Commands/McpClientCommand.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;

class McpClientCommand extends Command
{
    protected $signature = 'mcp:client
                           {server : Path to MCP server}
                           {--tool= : Tool to call}
                           {--params= : JSON parameters for tool}';

    protected $description = 'Connect to MCP server and call tools';

    public function handle(): int
    {
        $serverPath = $this->argument('server');
        $toolName = $this->option('tool');
        $params = $this->option('params') ? json_decode($this->option('params'), true) : [];

        $client = new Client(new Implementation('laravel-client', '1.0.0'));
        $transport = new StdioClientTransport([
            'command' => 'php',
            'args' => [$serverPath]
        ]);

        try {
            $this->info("Connecting to MCP server: {$serverPath}");
            $client->connect($transport)->await();

            if ($toolName) {
                $this->info("Calling tool: {$toolName}");
                $result = $client->callTool($toolName, $params)->await();
                $this->line($result['content'][0]['text']);
            } else {
                // List available capabilities
                $tools = $client->listTools()->await();
                $this->info("Available tools:");
                foreach ($tools['tools'] as $tool) {
                    $this->line("  - {$tool['name']}: {$tool['description']}");
                }
            }

            $client->close()->await();
            return 0;

        } catch (\Exception $e) {
            $this->error("MCP client error: {$e->getMessage()}");
            return 1;
        }
    }
}
```

## Controller Integration

### MCP Controller

Create `app/Http/Controllers/McpController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use MCP\Server\McpServer;
use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;

class McpController extends Controller
{
    private McpServer $server;

    public function __construct(McpServer $server)
    {
        $this->server = $server;
    }

    public function listTools(): JsonResponse
    {
        $tools = $this->server->listTools();

        return response()->json([
            'tools' => $tools['tools'],
            'count' => count($tools['tools'])
        ]);
    }

    public function callTool(Request $request): JsonResponse
    {
        $request->validate([
            'tool_name' => 'required|string',
            'parameters' => 'array'
        ]);

        try {
            $result = $this->server->callToolByName(
                $request->input('tool_name'),
                $request->input('parameters', [])
            );

            return response()->json(['result' => $result]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function connectToExternalServer(Request $request): JsonResponse
    {
        $request->validate([
            'server_command' => 'required|string',
            'server_args' => 'array'
        ]);

        $client = new Client(new Implementation('laravel-client', '1.0.0'));
        $transport = new StdioClientTransport([
            'command' => $request->input('server_command'),
            'args' => $request->input('server_args', [])
        ]);

        try {
            $client->connect($transport)->await();
            $tools = $client->listTools()->await();
            $client->close()->await();

            return response()->json([
                'connected' => true,
                'tools' => $tools['tools']
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'connected' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }
}
```

## Middleware Integration

### MCP Authentication Middleware

Create `app/Http/Middleware/McpAuthMiddleware.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;

class McpAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        // Skip authentication for public endpoints
        if ($request->is('mcp/public/*')) {
            return $next($request);
        }

        $token = $request->bearerToken();

        if (!$token) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Authentication token required'
            );
        }

        // Validate token using Laravel Sanctum
        $user = \Laravel\Sanctum\PersonalAccessToken::findToken($token)?->tokenable;

        if (!$user) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Invalid authentication token'
            );
        }

        // Add user to request
        $request->merge(['mcp_user' => $user]);

        return $next($request);
    }
}
```

## Blade Components

### MCP Client Component

Create `resources/views/components/mcp-client.blade.php`:

```php
<div x-data="mcpClient()" class="mcp-client">
    <div class="mb-4">
        <h3 class="text-lg font-semibold">MCP Server Connection</h3>
        <div class="flex gap-2">
            <input x-model="serverPath" placeholder="Server path" class="border rounded px-3 py-1">
            <button @click="connect()" :disabled="connecting" class="bg-blue-500 text-white px-4 py-1 rounded">
                <span x-show="!connecting">Connect</span>
                <span x-show="connecting">Connecting...</span>
            </button>
        </div>
    </div>

    <div x-show="connected" class="space-y-4">
        <div>
            <h4 class="font-medium">Available Tools</h4>
            <ul class="list-disc list-inside">
                <template x-for="tool in tools">
                    <li>
                        <button @click="selectTool(tool)" class="text-blue-600 hover:underline" x-text="tool.name"></button>
                        - <span x-text="tool.description"></span>
                    </li>
                </template>
            </ul>
        </div>

        <div x-show="selectedTool">
            <h4 class="font-medium">Call Tool: <span x-text="selectedTool?.name"></span></h4>
            <textarea x-model="toolParams" placeholder="Parameters (JSON)" class="w-full border rounded p-2"></textarea>
            <button @click="callTool()" class="bg-green-500 text-white px-4 py-1 rounded mt-2">
                Call Tool
            </button>
        </div>

        <div x-show="result">
            <h4 class="font-medium">Result</h4>
            <pre class="bg-gray-100 p-3 rounded overflow-auto" x-text="result"></pre>
        </div>
    </div>
</div>

<script>
function mcpClient() {
    return {
        serverPath: '',
        connecting: false,
        connected: false,
        tools: [],
        selectedTool: null,
        toolParams: '{}',
        result: '',

        async connect() {
            this.connecting = true;

            try {
                const response = await fetch('/mcp/connect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify({
                        server_command: 'php',
                        server_args: [this.serverPath]
                    })
                });

                const data = await response.json();

                if (data.connected) {
                    this.connected = true;
                    this.tools = data.tools;
                } else {
                    alert('Connection failed: ' + data.error);
                }
            } catch (error) {
                alert('Connection error: ' + error.message);
            } finally {
                this.connecting = false;
            }
        },

        selectTool(tool) {
            this.selectedTool = tool;
            this.result = '';
        },

        async callTool() {
            try {
                const params = JSON.parse(this.toolParams);

                const response = await fetch('/mcp/call-tool', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify({
                        tool_name: this.selectedTool.name,
                        parameters: params
                    })
                });

                const data = await response.json();

                if (data.result) {
                    this.result = JSON.stringify(data.result, null, 2);
                } else {
                    this.result = 'Error: ' + data.error;
                }
            } catch (error) {
                this.result = 'Error: ' + error.message;
            }
        }
    }
}
</script>
```

## Routes

### MCP Routes

Create `routes/mcp.php`:

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\McpController;

Route::prefix('mcp')->group(function () {
    // Public routes
    Route::get('/tools', [McpController::class, 'listTools']);
    Route::get('/resources', [McpController::class, 'listResources']);

    // Protected routes
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/call-tool', [McpController::class, 'callTool']);
        Route::post('/connect', [McpController::class, 'connectToExternalServer']);
        Route::get('/server-info', [McpController::class, 'getServerInfo']);
    });
});
```

## Queue Integration

### MCP Job

Create `app/Jobs/McpToolCallJob.php`:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;

class McpToolCallJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private string $serverPath,
        private string $toolName,
        private array $parameters,
        private ?string $callbackUrl = null
    ) {}

    public function handle(): void
    {
        $client = new Client(new Implementation('laravel-queue-client', '1.0.0'));
        $transport = new StdioClientTransport([
            'command' => 'php',
            'args' => [$this->serverPath]
        ]);

        try {
            $client->connect($transport)->await();
            $result = $client->callTool($this->toolName, $this->parameters)->await();
            $client->close()->await();

            // Store result or send callback
            if ($this->callbackUrl) {
                $this->sendCallback($result);
            } else {
                $this->storeResult($result);
            }

        } catch (\Exception $e) {
            $this->fail($e);
        }
    }

    private function sendCallback(array $result): void
    {
        // Send HTTP callback with result
        \Illuminate\Support\Facades\Http::post($this->callbackUrl, [
            'tool' => $this->toolName,
            'result' => $result,
            'status' => 'completed'
        ]);
    }

    private function storeResult(array $result): void
    {
        // Store result in database or cache
        \Illuminate\Support\Facades\Cache::put(
            "mcp_result_{$this->job->uuid}",
            $result,
            3600
        );
    }
}
```

## Testing

### Feature Tests

Create `tests/Feature/McpIntegrationTest.php`:

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use MCP\Server\McpServer;
use MCP\Types\Implementation;

class McpIntegrationTest extends TestCase
{
    public function test_mcp_server_creation(): void
    {
        $server = app(McpServer::class);

        $this->assertInstanceOf(McpServer::class, $server);
    }

    public function test_mcp_tools_endpoint(): void
    {
        $response = $this->get('/mcp/tools');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'tools',
                     'count'
                 ]);
    }

    public function test_mcp_tool_call(): void
    {
        $this->actingAs($this->createUser());

        $response = $this->postJson('/mcp/call-tool', [
            'tool_name' => 'cache_get',
            'parameters' => ['key' => 'test-key']
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['result']);
    }

    private function createUser()
    {
        return \App\Models\User::factory()->create();
    }
}
```

## Environment Configuration

### .env Settings

```env
# MCP Configuration
MCP_SERVER_NAME="My Laravel App"
MCP_SERVER_VERSION="1.0.0"
MCP_TRANSPORT=stdio
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
MCP_AUTH_ENABLED=true
MCP_AUTH_PROVIDER=sanctum

# CORS Settings
MCP_CORS_ORIGINS="http://localhost:3000,https://myapp.com"

# OAuth Settings (if using OAuth)
MCP_OAUTH_CLIENT_ID=your-client-id
MCP_OAUTH_CLIENT_SECRET=your-client-secret
MCP_OAUTH_REDIRECT_URI=http://localhost:8000/auth/callback
```

## Usage Examples

### Basic Server Usage

```bash
# Start MCP server with STDIO transport
php artisan mcp:serve

# Start HTTP server
php artisan mcp:serve --transport=http --port=3000

# Connect to external MCP server
php artisan mcp:client path/to/server.php --tool=get_weather --params='{"city":"London"}'
```

### Programmatic Usage

```php
// In a Laravel controller or service
class WeatherService
{
    public function getWeather(string $city): array
    {
        $client = new Client(new Implementation('weather-client', '1.0.0'));
        $transport = new StdioClientTransport([
            'command' => 'php',
            'args' => [base_path('weather-server.php')]
        ]);

        $client->connect($transport)->await();
        $result = $client->callTool('get_weather', ['city' => $city])->await();
        $client->close()->await();

        return $result;
    }
}
```

### Queue Integration

```php
// Dispatch MCP tool call to queue
McpToolCallJob::dispatch(
    'path/to/server.php',
    'process_data',
    ['data' => $largeDataset],
    'https://myapp.com/mcp/callback'
);
```

## Best Practices

### 1. Security

- Use Laravel Sanctum for API authentication
- Validate all MCP tool parameters
- Restrict allowed Artisan commands
- Implement proper authorization checks

### 2. Performance

- Use Laravel's queue system for long-running MCP operations
- Implement caching for frequently called tools
- Use connection pooling for multiple MCP servers
- Monitor performance with Laravel Telescope

### 3. Error Handling

- Use Laravel's exception handling for MCP errors
- Log all MCP operations for debugging
- Implement proper fallback mechanisms
- Use Laravel's retry mechanisms for transient failures

### 4. Testing

- Write feature tests for MCP endpoints
- Mock MCP servers for unit testing
- Use Laravel's HTTP testing for integration tests
- Test both success and error scenarios

## Deployment

### Production Configuration

```php
// config/mcp.php - Production settings
return [
    'server' => [
        'name' => env('APP_NAME'),
        'version' => env('APP_VERSION', '1.0.0'),
    ],

    'transport' => [
        'default' => 'http',
        'http' => [
            'host' => '0.0.0.0',
            'port' => (int) env('MCP_PORT', 3000),
            'ssl' => true,
        ],
    ],

    'auth' => [
        'enabled' => true,
        'provider' => 'sanctum',
    ],
];
```

### Docker Integration

```dockerfile
FROM php:8.1-fpm

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy application
COPY . /var/www
WORKDIR /var/www

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /var/www

# Start MCP server
CMD ["php", "artisan", "mcp:serve", "--transport=http", "--host=0.0.0.0"]
```

## See Also

- [Laravel MCP SDK Package](https://github.com/dalehurley/laravel-mcp-sdk)
- [Laravel Documentation](https://laravel.com/docs)
- [Authentication Guide](../guide/authentication)
- [Server API Reference](../api/server)
