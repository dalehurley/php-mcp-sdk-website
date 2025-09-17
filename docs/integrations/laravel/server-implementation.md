# Laravel MCP Server Implementation

Complete guide to implementing MCP servers in Laravel with full specification support, multiple server management, and production-ready features.

## Multiple Server Configuration

Configure multiple named servers in `config/mcp.php`:

```php
<?php

return [
    'default_server' => 'main',

    'servers' => [
        'main' => [
            'name' => 'Laravel Main Server',
            'version' => '1.0.0',
            'transport' => 'stdio',
            'capabilities' => ['tools', 'resources', 'prompts'],
            'tools' => [
                'discover' => [app_path('Mcp/Tools')],
                'auto_register' => true,
            ],
        ],

        'api' => [
            'name' => 'Laravel API Server',
            'version' => '1.0.0',
            'transport' => 'http',
            'capabilities' => ['tools', 'resources'],
            'tools' => [
                'discover' => [app_path('Mcp/Api/Tools')],
                'auto_register' => true,
            ],
        ],

        'realtime' => [
            'name' => 'Laravel Realtime Server',
            'version' => '1.0.0',
            'transport' => 'websocket',
            'capabilities' => ['tools', 'resources', 'prompts', 'roots'],
            'tools' => [
                'discover' => [app_path('Mcp/Realtime/Tools')],
                'auto_register' => true,
            ],
        ],
    ],

    'transports' => [
        'stdio' => ['enabled' => true],
        'http' => [
            'enabled' => true,
            'host' => '127.0.0.1',
            'port' => 3000,
            'security' => [
                'cors_enabled' => true,
                'rate_limiting' => '60,1',
            ],
        ],
        'websocket' => [
            'enabled' => true,
            'host' => '127.0.0.1',
            'port' => 3001,
            'max_connections' => 1000,
        ],
    ],

    'authorization' => [
        'enabled' => true,
        'provider' => 'oauth',
        'oauth' => [
            'scopes' => [
                'mcp:tools' => 'Access to MCP tools',
                'mcp:resources' => 'Access to MCP resources',
                'mcp:prompts' => 'Access to MCP prompts',
            ],
            'pkce_required' => true,
        ],
    ],
];
```

## Creating Advanced Tools

### Database Query Tool with Progress Reporting

```php
<?php

namespace App\Mcp\Tools;

use MCP\Laravel\Laravel\LaravelTool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class DatabaseQueryTool extends LaravelTool
{
    public function name(): string
    {
        return 'database_query';
    }

    public function description(): string
    {
        return 'Execute safe database queries with caching and progress reporting';
    }

    protected function properties(): array
    {
        return [
            'query' => [
                'type' => 'string',
                'description' => 'SQL query to execute (SELECT only)',
            ],
            'bindings' => [
                'type' => 'array',
                'description' => 'Query parameter bindings',
                'default' => [],
            ],
            'cache_ttl' => [
                'type' => 'integer',
                'description' => 'Cache TTL in seconds',
                'default' => 300,
            ],
        ];
    }

    protected function required(): array
    {
        return ['query'];
    }

    public function requiresAuth(): bool
    {
        return true;
    }

    public function requiredScopes(): array
    {
        return ['mcp:tools', 'database:read'];
    }

    protected function validationRules(): array
    {
        return [
            'query' => 'required|string|starts_with:SELECT',
            'bindings' => 'array',
            'cache_ttl' => 'integer|min:0|max:3600',
        ];
    }

    public function handle(array $params): array
    {
        // Validate parameters
        $params = $this->validate($params);

        // Security: Only allow SELECT queries
        if (!str_starts_with(strtoupper(trim($params['query'])), 'SELECT')) {
            return $this->errorResponse('Only SELECT queries are allowed');
        }

        $cacheKey = 'db_query_' . md5($params['query'] . serialize($params['bindings'] ?? []));

        try {
            // Check cache first
            if ($params['cache_ttl'] > 0) {
                $cached = Cache::get($cacheKey);
                if ($cached !== null) {
                    $this->log('info', 'Query result served from cache', ['cache_key' => $cacheKey]);
                    return $this->textContent("Results (cached):\n" . json_encode($cached, JSON_PRETTY_PRINT));
                }
            }

            // Execute query with progress reporting for large results
            $progress = app(\MCP\Laravel\Utilities\ProgressManager::class);
            $progressToken = $progress->start('Executing database query', 100);

            $results = DB::select($params['query'], $params['bindings'] ?? []);

            $progress->update($progressToken, 50, 'Processing results');

            // Convert to array
            $data = collect($results)->map(function ($item) {
                return (array) $item;
            })->toArray();

            $progress->update($progressToken, 80, 'Caching results');

            // Cache results if TTL > 0
            if ($params['cache_ttl'] > 0) {
                Cache::put($cacheKey, $data, $params['cache_ttl']);
            }

            $progress->complete($progressToken, 'Query completed successfully');

            $this->log('info', 'Database query executed successfully', [
                'rows_returned' => count($data),
                'cache_key' => $cacheKey,
            ]);

            return $this->textContent(
                "Query executed successfully. Rows returned: " . count($data) . "\n\n" .
                json_encode($data, JSON_PRETTY_PRINT)
            );

        } catch (\Exception $e) {
            $this->log('error', 'Database query failed', [
                'error' => $e->getMessage(),
                'query' => $params['query'],
            ]);

            return $this->errorResponse('Query failed: ' . $e->getMessage());
        }
    }
}
```

### File Processing Tool with Cancellation Support

```php
<?php

namespace App\Mcp\Tools;

use MCP\Laravel\Laravel\LaravelTool;
use Illuminate\Support\Facades\Storage;

class FileProcessingTool extends LaravelTool
{
    public function name(): string
    {
        return 'process_file';
    }

    public function description(): string
    {
        return 'Process large files with cancellation and progress tracking';
    }

    protected function properties(): array
    {
        return [
            'file_path' => ['type' => 'string'],
            'operation' => ['type' => 'string', 'enum' => ['analyze', 'compress', 'validate']],
            'chunk_size' => ['type' => 'integer', 'default' => 8192],
        ];
    }

    public function handle(array $params): array
    {
        $filePath = $params['file_path'];
        $operation = $params['operation'];
        $chunkSize = $params['chunk_size'] ?? 8192;

        if (!Storage::exists($filePath)) {
            return $this->errorResponse('File not found');
        }

        $fileSize = Storage::size($filePath);
        $totalChunks = ceil($fileSize / $chunkSize);

        $progress = app(\MCP\Laravel\Utilities\ProgressManager::class);
        $cancellation = app(\MCP\Laravel\Utilities\CancellationManager::class);

        $progressToken = $progress->start("Processing file: {$operation}", $totalChunks);
        $cancellationToken = $cancellation->createToken();

        try {
            $handle = Storage::readStream($filePath);
            $processedChunks = 0;
            $result = [];

            while (!feof($handle) && !$cancellation->isCancelled($cancellationToken)) {
                $chunk = fread($handle, $chunkSize);

                // Process chunk based on operation
                $chunkResult = match ($operation) {
                    'analyze' => $this->analyzeChunk($chunk),
                    'compress' => $this->compressChunk($chunk),
                    'validate' => $this->validateChunk($chunk),
                };

                $result[] = $chunkResult;
                $processedChunks++;

                $progress->update($progressToken, $processedChunks, "Processed chunk {$processedChunks}/{$totalChunks}");

                // Allow other processes to run
                usleep(1000);
            }

            fclose($handle);

            if ($cancellation->isCancelled($cancellationToken)) {
                $progress->cancel($progressToken, 'Operation cancelled by user');
                return $this->textContent('File processing was cancelled');
            }

            $progress->complete($progressToken, 'File processing completed');

            return $this->textContent(
                "File processing completed.\n" .
                "Operation: {$operation}\n" .
                "Chunks processed: {$processedChunks}\n" .
                "Results: " . json_encode(array_slice($result, 0, 10), JSON_PRETTY_PRINT)
            );

        } catch (\Exception $e) {
            $progress->fail($progressToken, $e->getMessage());
            return $this->errorResponse('Processing failed: ' . $e->getMessage());
        }
    }

    private function analyzeChunk(string $chunk): array
    {
        return [
            'size' => strlen($chunk),
            'lines' => substr_count($chunk, "\n"),
            'words' => str_word_count($chunk),
        ];
    }

    private function compressChunk(string $chunk): array
    {
        $compressed = gzcompress($chunk);
        return [
            'original_size' => strlen($chunk),
            'compressed_size' => strlen($compressed),
            'compression_ratio' => strlen($compressed) / strlen($chunk),
        ];
    }

    private function validateChunk(string $chunk): array
    {
        return [
            'valid_utf8' => mb_check_encoding($chunk, 'UTF-8'),
            'checksum' => md5($chunk),
        ];
    }
}
```

## Managing Multiple Servers

### Using Server Facades

```php
use MCP\Laravel\Facades\McpServer;

// Start multiple servers simultaneously
McpServer::start('main', 'stdio');
McpServer::start('api', 'http');
McpServer::start('realtime', 'websocket');

// Add tools to specific servers
McpServer::get('api')->addTool('weather', function($params) {
    return ['content' => [['type' => 'text', 'text' => 'Sunny, 72°F']]];
});

// Get server status
$status = McpServer::getStatus('api');
echo "API Server: " . ($status['running'] ? 'Running' : 'Stopped');

// List all servers
$servers = McpServer::list();
foreach ($servers as $serverName) {
    echo "Server: {$serverName} - " . (McpServer::get($serverName)->isRunning() ? 'Running' : 'Stopped') . "\n";
}
```

### Server Manager Service

```php
<?php

namespace App\Services;

use MCP\Laravel\Laravel\ServerManager;
use Illuminate\Support\Facades\Log;

class McpServerOrchestrator
{
    private ServerManager $serverManager;

    public function __construct(ServerManager $serverManager)
    {
        $this->serverManager = $serverManager;
    }

    /**
     * Start all configured servers
     */
    public function startAllServers(): array
    {
        $results = [];
        $serverConfigs = config('mcp.servers', []);

        foreach ($serverConfigs as $name => $config) {
            try {
                $server = $this->serverManager->get($name);
                $server->start($config['transport']);

                $results[$name] = [
                    'status' => 'started',
                    'transport' => $config['transport'],
                    'capabilities' => $config['capabilities'],
                ];

                Log::info("MCP Server started", ['server' => $name]);

            } catch (\Exception $e) {
                $results[$name] = [
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];

                Log::error("Failed to start MCP Server", [
                    'server' => $name,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $results;
    }

    /**
     * Stop all running servers
     */
    public function stopAllServers(): array
    {
        $results = [];
        $servers = $this->serverManager->list();

        foreach ($servers as $serverName) {
            try {
                $server = $this->serverManager->get($serverName);
                if ($server->isRunning()) {
                    $server->stop();
                    $results[$serverName] = 'stopped';
                    Log::info("MCP Server stopped", ['server' => $serverName]);
                } else {
                    $results[$serverName] = 'not_running';
                }
            } catch (\Exception $e) {
                $results[$serverName] = 'error: ' . $e->getMessage();
                Log::error("Failed to stop MCP Server", [
                    'server' => $serverName,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $results;
    }

    /**
     * Get status of all servers
     */
    public function getSystemStatus(): array
    {
        $status = [
            'total_servers' => 0,
            'running_servers' => 0,
            'failed_servers' => 0,
            'servers' => [],
        ];

        $servers = $this->serverManager->list();
        $status['total_servers'] = count($servers);

        foreach ($servers as $serverName) {
            try {
                $server = $this->serverManager->get($serverName);
                $serverStatus = $server->getStatus();

                $status['servers'][$serverName] = $serverStatus;

                if ($serverStatus['running']) {
                    $status['running_servers']++;
                } else {
                    $status['failed_servers']++;
                }
            } catch (\Exception $e) {
                $status['servers'][$serverName] = [
                    'error' => $e->getMessage(),
                    'running' => false,
                ];
                $status['failed_servers']++;
            }
        }

        return $status;
    }
}
```

## Resources and Prompts

### Dynamic Resource Implementation

```php
<?php

namespace App\Mcp\Resources;

use MCP\Laravel\Laravel\LaravelResource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DatabaseResource extends LaravelResource
{
    public function uri(): string
    {
        return 'database://{table}/{id?}';
    }

    public function description(): string
    {
        return 'Access database records with URI templates';
    }

    public function read(string $uri): array
    {
        $variables = $this->extractUriVariables($uri);
        $table = $variables['table'];
        $id = $variables['id'] ?? null;

        // Validate table name for security
        if (!$this->isValidTable($table)) {
            throw new \InvalidArgumentException("Invalid table name: {$table}");
        }

        $cacheKey = "db_resource:{$table}:" . ($id ?: 'all');

        return Cache::remember($cacheKey, 300, function () use ($table, $id) {
            if ($id) {
                $data = DB::table($table)->where('id', $id)->first();
                if (!$data) {
                    throw new \Exception("Record not found: {$table}#{$id}");
                }
            } else {
                $data = DB::table($table)->limit(100)->get();
            }

            return [
                'contents' => [[
                    'uri' => "database://{$table}" . ($id ? "/{$id}" : ''),
                    'mimeType' => 'application/json',
                    'text' => json_encode($data, JSON_PRETTY_PRINT),
                ]]
            ];
        });
    }

    private function isValidTable(string $table): bool
    {
        $allowedTables = ['users', 'posts', 'comments', 'categories'];
        return in_array($table, $allowedTables);
    }
}
```

### Prompt Templates

````php
<?php

namespace App\Mcp\Prompts;

use MCP\Laravel\Laravel\LaravelPrompt;

class CodeReviewPrompt extends LaravelPrompt
{
    public function name(): string
    {
        return 'code_review';
    }

    public function description(): string
    {
        return 'Generate a comprehensive code review prompt';
    }

    public function arguments(): array
    {
        return [
            'code' => ['type' => 'string', 'description' => 'Code to review'],
            'language' => ['type' => 'string', 'description' => 'Programming language'],
            'focus' => ['type' => 'string', 'enum' => ['security', 'performance', 'maintainability', 'all']],
        ];
    }

    public function handle(array $args): array
    {
        $code = $args['code'];
        $language = $args['language'] ?? 'php';
        $focus = $args['focus'] ?? 'all';

        $prompt = $this->buildPrompt($code, $language, $focus);

        return [
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $prompt,
                        ]
                    ]
                ]
            ]
        ];
    }

    private function buildPrompt(string $code, string $language, string $focus): string
    {
        $focusInstructions = match ($focus) {
            'security' => 'Focus on security vulnerabilities, input validation, and potential attack vectors.',
            'performance' => 'Focus on performance issues, optimization opportunities, and resource usage.',
            'maintainability' => 'Focus on code structure, readability, and long-term maintainability.',
            'all' => 'Provide a comprehensive review covering security, performance, and maintainability.',
        };

        return "Please review the following {$language} code:

```{$language}
{$code}
```

{$focusInstructions}

Provide your review in the following format:

1. **Summary**: Brief overview of the code quality
2. **Issues Found**: List any problems with severity levels
3. **Recommendations**: Specific suggestions for improvement
4. **Positive Aspects**: What the code does well
5. **Overall Rating**: Rate from 1-10 with justification";
    }
}
```

## Artisan Commands

### Server Management Commands

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\McpServerOrchestrator;

class McpServerCommand extends Command
{
    protected $signature = 'mcp:server
                           {action : start, stop, restart, status}
                           {server? : Server name (optional)}
                           {--transport= : Transport type}
                           {--port= : Port number}
                           {--host= : Host address}
                           {--daemon : Run in daemon mode}';

    protected $description = 'Manage MCP servers';

    public function handle(McpServerOrchestrator $orchestrator): int
    {
        $action = $this->argument('action');
        $serverName = $this->argument('server');

        switch ($action) {
            case 'start':
                return $this->startServers($orchestrator, $serverName);
            case 'stop':
                return $this->stopServers($orchestrator, $serverName);
            case 'restart':
                return $this->restartServers($orchestrator, $serverName);
            case 'status':
                return $this->showStatus($orchestrator, $serverName);
            default:
                $this->error("Unknown action: {$action}");
                return 1;
        }
    }

    private function startServers(McpServerOrchestrator $orchestrator, ?string $serverName): int
    {
        if ($serverName) {
            $this->info("Starting MCP server: {$serverName}");
            // Start specific server logic
        } else {
            $this->info("Starting all MCP servers...");
            $results = $orchestrator->startAllServers();

            foreach ($results as $name => $result) {
                if ($result['status'] === 'started') {
                    $this->info("✓ {$name}: Started on {$result['transport']}");
                } else {
                    $this->error("✗ {$name}: Failed - {$result['error']}");
                }
            }
        }

        return 0;
    }

    private function showStatus(McpServerOrchestrator $orchestrator, ?string $serverName): int
    {
        $status = $orchestrator->getSystemStatus();

        $this->info("MCP Server Status:");
        $this->info("Total: {$status['total_servers']}, Running: {$status['running_servers']}, Failed: {$status['failed_servers']}");
        $this->newLine();

        $headers = ['Server', 'Status', 'Transport', 'Uptime', 'Tools', 'Memory'];
        $rows = [];

        foreach ($status['servers'] as $name => $server) {
            $rows[] = [
                $name,
                $server['running'] ? '🟢 Running' : '🔴 Stopped',
                $server['transport'] ?? 'N/A',
                $this->formatUptime($server['uptime'] ?? 0),
                $server['tools_count'] ?? 0,
                $this->formatBytes($server['memory_usage'] ?? 0),
            ];
        }

        $this->table($headers, $rows);

        return 0;
    }

    private function formatUptime(int $seconds): string
    {
        if ($seconds < 60) return "{$seconds}s";
        if ($seconds < 3600) return floor($seconds / 60) . 'm';
        return floor($seconds / 3600) . 'h ' . floor(($seconds % 3600) / 60) . 'm';
    }

    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
```

## Testing Server Implementation

### Integration Tests

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use MCP\Laravel\Facades\McpServer;

class McpServerTest extends TestCase
{
    public function test_multiple_servers_can_start(): void
    {
        McpServer::start('test1', 'stdio');
        McpServer::start('test2', 'http');

        $this->assertTrue(McpServer::get('test1')->isRunning());
        $this->assertTrue(McpServer::get('test2')->isRunning());
    }

    public function test_tools_can_be_registered_dynamically(): void
    {
        $server = McpServer::get('test');

        $server->addTool('echo', function($params) {
            return ['content' => [['type' => 'text', 'text' => $params['message'] ?? 'echo']]];
        });

        $tools = $server->getTools();
        $this->assertArrayHasKey('echo', $tools);
    }

    public function test_server_handles_tool_errors_gracefully(): void
    {
        $server = McpServer::get('test');

        $server->addTool('error_tool', function($params) {
            throw new \Exception('Test error');
        });

        // Test that errors are handled without crashing the server
        $this->assertTrue($server->isRunning());
    }
}
```

### Performance Tests

```php
<?php

namespace Tests\Performance;

use Tests\TestCase;
use MCP\Laravel\Facades\McpServer;

class ServerPerformanceTest extends TestCase
{
    public function test_server_handles_concurrent_requests(): void
    {
        $server = McpServer::get('performance');

        $server->addTool('slow_tool', function($params) {
            usleep(100000); // 100ms delay
            return ['content' => [['type' => 'text', 'text' => 'slow response']]];
        });

        $start = microtime(true);

        // Simulate 10 concurrent requests
        $futures = [];
        for ($i = 0; $i < 10; $i++) {
            $futures[] = $this->callToolAsync($server, 'slow_tool', []);
        }

        // Wait for all to complete
        foreach ($futures as $future) {
            $future->await();
        }

        $duration = microtime(true) - $start;

        // Should handle concurrent requests efficiently
        $this->assertLessThan(1.5, $duration, 'Concurrent requests should complete in under 1.5 seconds');
    }

    private function callToolAsync($server, string $tool, array $params)
    {
        // Implementation would depend on your async setup
        return \Amp\async(function () use ($server, $tool, $params) {
            return $server->callTool($tool, $params);
        });
    }
}
```

## See Also

- [Client Implementation](client-implementation.md)
- [OpenAI Integration](openai-integration.md)
- [Caching Best Practices](caching-best-practices.md)
- [Production Deployment](../guide/deployment.md)
