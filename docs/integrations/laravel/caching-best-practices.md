# Laravel MCP SDK - Caching Best Practices

Comprehensive guide to implementing intelligent caching strategies for MCP tools, resources, and prompts in Laravel applications.

## Overview

Effective caching is crucial for MCP applications because:

- **Tool Execution**: Many tools perform expensive operations (database queries, API calls, file processing)
- **Resource Access**: Resources may involve file I/O or network requests
- **OpenAI Integration**: AI model calls are costly and have rate limits
- **Conversation Context**: Chat history and context need efficient storage

## Tool Result Caching

### Smart Cache Keys and TTL

```php
<?php

namespace App\Mcp\Tools;

use MCP\Laravel\Laravel\LaravelTool;
use Illuminate\Support\Facades\Cache;

class SmartCachedTool extends LaravelTool
{
    public function name(): string
    {
        return 'smart_cached_tool';
    }

    public function description(): string
    {
        return 'Tool with intelligent caching based on data volatility';
    }

    public function handle(array $params): array
    {
        $cacheStrategy = $this->determineCacheStrategy($params);
        $cacheKey = $this->buildSmartCacheKey($params);

        if (!$this->shouldBypassCache($params)) {
            $cached = Cache::tags($cacheStrategy['tags'])
                ->get($cacheKey);

            if ($cached !== null) {
                return $this->enrichCachedResult($cached);
            }
        }

        // Execute tool logic
        $result = $this->executeToolLogic($params);

        // Cache with intelligent TTL
        Cache::tags($cacheStrategy['tags'])
            ->put($cacheKey, $result, $cacheStrategy['ttl']);

        return $this->enrichFreshResult($result);
    }

    private function determineCacheStrategy(array $params): array
    {
        // Dynamic strategy based on parameters
        if ($this->isRealTimeData($params)) {
            return [
                'ttl' => 60,    // 1 minute for real-time data
                'tags' => ['realtime', $this->name()],
            ];
        }

        if ($this->isHistoricalData($params)) {
            return [
                'ttl' => 86400, // 24 hours for historical data
                'tags' => ['historical', $this->name()],
            ];
        }

        if ($this->isUserSpecificData($params)) {
            return [
                'ttl' => 3600,  // 1 hour for user data
                'tags' => ['user_data', $this->name(), "user_{$this->getUserId()}"],
            ];
        }

        return [
            'ttl' => 1800,      // 30 minutes default
            'tags' => ['default', $this->name()],
        ];
    }

    private function buildSmartCacheKey(array $params): string
    {
        $keyParts = [$this->name()];

        // Add time-based component for time-sensitive data
        if ($this->isTimeSensitive($params)) {
            $keyParts[] = 'time:' . floor(time() / 300); // 5-minute buckets
        }

        // Add user context if user-specific
        if ($this->isUserSpecificData($params)) {
            $keyParts[] = 'user:' . $this->getUserId();
        }

        // Add parameter hash
        $keyParts[] = 'params:' . $this->hashParameters($params);

        return implode(':', $keyParts);
    }

    private function hashParameters(array $params): string
    {
        // Remove cache-control parameters before hashing
        $cacheParams = array_diff_key($params, [
            'force_refresh' => true,
            'cache_ttl' => true,
            '_cache_control' => true,
        ]);

        return md5(json_encode($cacheParams, JSON_SORT_KEYS));
    }

    private function shouldBypassCache(array $params): bool
    {
        return $params['force_refresh'] ?? false;
    }

    private function enrichCachedResult(array $cached): array
    {
        return array_merge($cached, [
            '_cache_hit' => true,
            '_cached_at' => $cached['_cached_at'] ?? now(),
            '_cache_age' => now()->diffInSeconds($cached['_cached_at'] ?? now()),
        ]);
    }

    private function enrichFreshResult(array $result): array
    {
        return array_merge($result, [
            '_cache_hit' => false,
            '_cached_at' => now(),
            '_cache_age' => 0,
        ]);
    }

    // Helper methods for cache strategy determination
    private function isRealTimeData(array $params): bool
    {
        return in_array($params['data_type'] ?? '', ['stock_price', 'sensor_data', 'live_metrics']);
    }

    private function isHistoricalData(array $params): bool
    {
        return isset($params['date']) &&
               now()->diffInDays($params['date']) > 1;
    }

    private function isUserSpecificData(array $params): bool
    {
        return isset($params['user_id']) ||
               str_contains($params['query'] ?? '', 'my ') ||
               str_contains($params['query'] ?? '', 'user');
    }

    private function isTimeSensitive(array $params): bool
    {
        $timeSensitiveTypes = ['weather', 'traffic', 'availability', 'status'];
        return in_array($params['type'] ?? '', $timeSensitiveTypes);
    }
}
```

### Database Query Tool with Advanced Caching

```php
<?php

namespace App\Mcp\Tools;

use MCP\Laravel\Laravel\LaravelTool;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CachedDatabaseTool extends LaravelTool
{
    public function name(): string
    {
        return 'cached_database_query';
    }

    public function description(): string
    {
        return 'Execute database queries with intelligent caching and invalidation';
    }

    protected function properties(): array
    {
        return [
            'query' => ['type' => 'string'],
            'bindings' => ['type' => 'array', 'default' => []],
            'cache_strategy' => [
                'type' => 'string',
                'enum' => ['auto', 'aggressive', 'conservative', 'none'],
                'default' => 'auto'
            ],
        ];
    }

    public function handle(array $params): array
    {
        $query = $params['query'];
        $bindings = $params['bindings'] ?? [];
        $strategy = $params['cache_strategy'] ?? 'auto';

        // Analyze query for cache strategy
        $cacheInfo = $this->analyzeQueryForCaching($query, $strategy);

        if ($cacheInfo['cacheable']) {
            $cacheKey = $this->buildQueryCacheKey($query, $bindings);

            // Check cache first
            $cached = Cache::tags($cacheInfo['tags'])
                ->get($cacheKey);

            if ($cached !== null) {
                $this->log('info', 'Database query served from cache', [
                    'cache_key' => $cacheKey,
                    'query_hash' => md5($query),
                ]);

                return $this->enrichCachedResult($cached, $cacheInfo);
            }
        }

        // Execute query
        $startTime = microtime(true);
        $results = DB::select($query, $bindings);
        $executionTime = microtime(true) - $startTime;

        $result = [
            'data' => $results,
            'execution_time' => $executionTime,
            'row_count' => count($results),
            'query_hash' => md5($query),
        ];

        // Cache if appropriate
        if ($cacheInfo['cacheable'] && $this->shouldCacheResult($result, $cacheInfo)) {
            Cache::tags($cacheInfo['tags'])
                ->put($cacheKey, $result, $cacheInfo['ttl']);

            $this->log('info', 'Database query result cached', [
                'cache_key' => $cacheKey,
                'ttl' => $cacheInfo['ttl'],
                'row_count' => count($results),
            ]);
        }

        return $this->textContent(
            "Query executed in {$executionTime}s. Rows: " . count($results) . "\n\n" .
            json_encode($results, JSON_PRETTY_PRINT)
        );
    }

    private function analyzeQueryForCaching(string $query, string $strategy): array
    {
        $queryUpper = strtoupper(trim($query));

        // Determine base cacheability
        $isSelect = str_starts_with($queryUpper, 'SELECT');
        $hasNow = str_contains($queryUpper, 'NOW()') || str_contains($queryUpper, 'CURRENT_TIMESTAMP');
        $hasRandom = str_contains($queryUpper, 'RAND()') || str_contains($queryUpper, 'RANDOM()');

        $cacheable = $isSelect && !$hasNow && !$hasRandom;

        // Determine tables involved
        $tables = $this->extractTablesFromQuery($query);

        // Determine TTL based on query characteristics and strategy
        $ttl = $this->calculateTtl($query, $tables, $strategy);

        // Build cache tags
        $tags = array_merge(['database_queries'], $tables);

        return [
            'cacheable' => $cacheable,
            'ttl' => $ttl,
            'tags' => $tags,
            'tables' => $tables,
            'strategy' => $strategy,
        ];
    }

    private function extractTablesFromQuery(string $query): array
    {
        // Simple regex to extract table names (can be enhanced)
        preg_match_all('/FROM\s+`?(\w+)`?/i', $query, $fromMatches);
        preg_match_all('/JOIN\s+`?(\w+)`?/i', $query, $joinMatches);

        $tables = array_merge(
            $fromMatches[1] ?? [],
            $joinMatches[1] ?? []
        );

        return array_unique($tables);
    }

    private function calculateTtl(string $query, array $tables, string $strategy): int
    {
        $baseTtl = match ($strategy) {
            'aggressive' => 3600,   // 1 hour
            'conservative' => 300,  // 5 minutes
            'none' => 0,           // No caching
            'auto' => 1800,        // 30 minutes
        };

        if ($strategy === 'none') {
            return 0;
        }

        // Adjust based on table characteristics
        foreach ($tables as $table) {
            if (in_array($table, ['sessions', 'cache', 'job_batches'])) {
                $baseTtl = min($baseTtl, 60); // 1 minute for volatile tables
            } elseif (in_array($table, ['users', 'posts', 'products'])) {
                $baseTtl = min($baseTtl, 1800); // 30 minutes for semi-static data
            } elseif (in_array($table, ['settings', 'configurations'])) {
                $baseTtl = max($baseTtl, 3600); // 1 hour for static data
            }
        }

        // Adjust based on query complexity
        if (str_contains(strtoupper($query), 'COUNT(')) {
            $baseTtl *= 2; // Count queries can be cached longer
        }

        return $baseTtl;
    }

    private function buildQueryCacheKey(string $query, array $bindings): string
    {
        return 'db_query:' . md5($query . serialize($bindings));
    }

    private function shouldCacheResult(array $result, array $cacheInfo): bool
    {
        // Don't cache empty results or very large results
        $rowCount = $result['row_count'];

        if ($rowCount === 0) {
            return false;
        }

        if ($rowCount > 1000) {
            return false; // Too large to cache effectively
        }

        // Don't cache slow queries that might be one-off
        if ($result['execution_time'] > 5.0) {
            return false;
        }

        return true;
    }
}
```

## Resource Caching

### File-Based Resource with Intelligent Caching

```php
<?php

namespace App\Mcp\Resources;

use MCP\Laravel\Laravel\LaravelResource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class CachedFileResource extends LaravelResource
{
    public function uri(): string
    {
        return 'cached_file://{path}';
    }

    public function description(): string
    {
        return 'File resource with intelligent caching based on file metadata';
    }

    public function read(string $uri): array
    {
        $variables = $this->extractUriVariables($uri);
        $filePath = $variables['path'];

        // Get file metadata for cache decisions
        $fileInfo = $this->getFileInfo($filePath);
        $cacheStrategy = $this->determineCacheStrategy($fileInfo);

        $cacheKey = $this->buildFileCacheKey($filePath, $fileInfo);

        // Check cache if file hasn't changed
        if ($cacheStrategy['use_cache']) {
            $cached = Cache::get($cacheKey);
            if ($cached && $cached['file_modified'] === $fileInfo['modified']) {
                return $this->enrichCachedResult($cached);
            }
        }

        // Read file content
        $content = $this->readFileContent($filePath);

        // Process content based on file type
        $processedContent = $this->processFileContent($content, $fileInfo);

        $result = [
            'contents' => [[
                'uri' => $uri,
                'mimeType' => $fileInfo['mime_type'],
                'text' => $processedContent,
            ]],
            'file_size' => $fileInfo['size'],
            'file_modified' => $fileInfo['modified'],
            'processed_at' => now(),
        ];

        // Cache the result
        if ($cacheStrategy['cache_result']) {
            Cache::put($cacheKey, $result, $cacheStrategy['ttl']);
        }

        return $result;
    }

    private function getFileInfo(string $filePath): array
    {
        if (!Storage::exists($filePath)) {
            throw new \Exception("File not found: {$filePath}");
        }

        $size = Storage::size($filePath);
        $modified = Storage::lastModified($filePath);
        $mimeType = Storage::mimeType($filePath);

        return [
            'path' => $filePath,
            'size' => $size,
            'modified' => $modified,
            'mime_type' => $mimeType,
            'extension' => pathinfo($filePath, PATHINFO_EXTENSION),
        ];
    }

    private function determineCacheStrategy(array $fileInfo): array
    {
        $size = $fileInfo['size'];
        $extension = $fileInfo['extension'];
        $age = time() - $fileInfo['modified'];

        // Very large files - don't cache content
        if ($size > 10 * 1024 * 1024) { // 10MB
            return [
                'use_cache' => false,
                'cache_result' => false,
                'ttl' => 0,
                'reason' => 'file_too_large',
            ];
        }

        // Recently modified files - short cache
        if ($age < 3600) { // Modified in last hour
            return [
                'use_cache' => true,
                'cache_result' => true,
                'ttl' => 300, // 5 minutes
                'reason' => 'recently_modified',
            ];
        }

        // Static file types - long cache
        if (in_array($extension, ['pdf', 'jpg', 'png', 'mp4', 'mp3'])) {
            return [
                'use_cache' => true,
                'cache_result' => true,
                'ttl' => 86400, // 24 hours
                'reason' => 'static_content',
            ];
        }

        // Configuration files - medium cache
        if (in_array($extension, ['json', 'xml', 'yaml', 'ini'])) {
            return [
                'use_cache' => true,
                'cache_result' => true,
                'ttl' => 3600, // 1 hour
                'reason' => 'config_file',
            ];
        }

        // Default strategy
        return [
            'use_cache' => true,
            'cache_result' => true,
            'ttl' => 1800, // 30 minutes
            'reason' => 'default',
        ];
    }

    private function buildFileCacheKey(string $filePath, array $fileInfo): string
    {
        return 'file_resource:' . md5($filePath) . ':' . $fileInfo['modified'];
    }

    private function readFileContent(string $filePath): string
    {
        return Storage::get($filePath);
    }

    private function processFileContent(string $content, array $fileInfo): string
    {
        $extension = $fileInfo['extension'];

        // Process based on file type
        return match ($extension) {
            'json' => $this->formatJson($content),
            'xml' => $this->formatXml($content),
            'csv' => $this->formatCsv($content),
            'md' => $this->formatMarkdown($content),
            default => $content,
        };
    }

    private function formatJson(string $content): string
    {
        $decoded = json_decode($content, true);
        return $decoded ? json_encode($decoded, JSON_PRETTY_PRINT) : $content;
    }

    private function formatXml(string $content): string
    {
        $dom = new \DOMDocument();
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = true;

        if (@$dom->loadXML($content)) {
            return $dom->saveXML();
        }

        return $content;
    }

    private function formatCsv(string $content): string
    {
        $lines = array_slice(explode("\n", $content), 0, 10); // First 10 lines
        return "CSV Preview (first 10 lines):\n" . implode("\n", $lines);
    }

    private function formatMarkdown(string $content): string
    {
        // Could integrate markdown parser here
        return $content;
    }
}
```

## OpenAI Response Caching

### Conversation and Response Caching

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use OpenAI\Laravel\Facades\OpenAI;

class OpenAICacheManager
{
    /**
     * Cache OpenAI responses with intelligent strategies
     */
    public function getCachedResponse(array $messages, array $options = []): ?array
    {
        if (!$this->shouldCacheRequest($messages, $options)) {
            return null;
        }

        $cacheKey = $this->buildResponseCacheKey($messages, $options);
        $cached = Cache::get($cacheKey);

        if ($cached) {
            $this->logCacheHit($cacheKey, $messages);
            return $this->enrichCachedResponse($cached);
        }

        return null;
    }

    /**
     * Store OpenAI response in cache
     */
    public function cacheResponse(array $messages, array $options, array $response): void
    {
        if (!$this->shouldCacheResponse($messages, $options, $response)) {
            return;
        }

        $cacheKey = $this->buildResponseCacheKey($messages, $options);
        $ttl = $this->calculateResponseTtl($messages, $response);

        $cacheData = [
            'response' => $response,
            'cached_at' => now(),
            'messages_hash' => $this->hashMessages($messages),
            'options' => $options,
        ];

        Cache::put($cacheKey, $cacheData, $ttl);

        $this->logCacheStore($cacheKey, $ttl, $response);
    }

    /**
     * Cache conversation context for faster follow-ups
     */
    public function cacheConversationContext(string $conversationId, array $context): void
    {
        $cacheKey = "conversation_context:{$conversationId}";
        Cache::put($cacheKey, $context, 3600); // 1 hour
    }

    /**
     * Get cached conversation context
     */
    public function getConversationContext(string $conversationId): ?array
    {
        $cacheKey = "conversation_context:{$conversationId}";
        return Cache::get($cacheKey);
    }

    /**
     * Cache tool schemas for faster tool calling
     */
    public function cacheToolSchemas(array $tools): void
    {
        $cacheKey = 'openai_tool_schemas:' . md5(json_encode($tools));
        Cache::put($cacheKey, $tools, 86400); // 24 hours
    }

    /**
     * Get cached tool schemas
     */
    public function getToolSchemas(array $toolNames): ?array
    {
        $cacheKey = 'openai_tool_schemas:' . md5(json_encode($toolNames));
        return Cache::get($cacheKey);
    }

    private function shouldCacheRequest(array $messages, array $options): bool
    {
        // Don't cache if explicitly disabled
        if ($options['disable_cache'] ?? false) {
            return false;
        }

        // Don't cache requests with high temperature (creative responses)
        if (($options['temperature'] ?? 0.7) > 0.8) {
            return false;
        }

        // Don't cache if tools are involved (may have side effects)
        if (!empty($options['tools'])) {
            return false;
        }

        // Don't cache very long conversations
        if (count($messages) > 20) {
            return false;
        }

        return true;
    }

    private function shouldCacheResponse(array $messages, array $options, array $response): bool
    {
        // Don't cache error responses
        if (isset($response['error'])) {
            return false;
        }

        // Don't cache responses with tool calls
        $choice = $response['choices'][0] ?? [];
        if (!empty($choice['message']['tool_calls'])) {
            return false;
        }

        // Don't cache very short responses (likely errors or incomplete)
        $content = $choice['message']['content'] ?? '';
        if (strlen($content) < 10) {
            return false;
        }

        return true;
    }

    private function buildResponseCacheKey(array $messages, array $options): string
    {
        $keyParts = [
            'openai_response',
            $this->hashMessages($messages),
            md5(json_encode($this->getCacheableOptions($options))),
        ];

        return implode(':', $keyParts);
    }

    private function hashMessages(array $messages): string
    {
        // Create hash of message content only (ignore metadata)
        $messageContent = array_map(function ($message) {
            return [
                'role' => $message['role'],
                'content' => $message['content'],
            ];
        }, $messages);

        return md5(json_encode($messageContent, JSON_SORT_KEYS));
    }

    private function getCacheableOptions(array $options): array
    {
        // Only include options that affect response content
        return array_intersect_key($options, [
            'model' => true,
            'temperature' => true,
            'max_tokens' => true,
            'top_p' => true,
            'frequency_penalty' => true,
            'presence_penalty' => true,
        ]);
    }

    private function calculateResponseTtl(array $messages, array $response): int
    {
        $lastMessage = end($messages);
        $content = $response['choices'][0]['message']['content'] ?? '';

        // Shorter TTL for questions about current events
        if ($this->isCurrentEventQuery($lastMessage['content'] ?? '')) {
            return 300; // 5 minutes
        }

        // Longer TTL for factual/educational content
        if ($this->isFactualContent($content)) {
            return 3600; // 1 hour
        }

        // Medium TTL for general responses
        return 1800; // 30 minutes
    }

    private function isCurrentEventQuery(string $content): bool
    {
        $currentEventKeywords = [
            'today', 'now', 'current', 'latest', 'recent',
            'weather', 'stock price', 'news'
        ];

        foreach ($currentEventKeywords as $keyword) {
            if (str_contains(strtolower($content), $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function isFactualContent(string $content): bool
    {
        // Simple heuristics for factual content
        $factualIndicators = [
            'definition', 'explanation', 'formula', 'algorithm',
            'history', 'theory', 'concept'
        ];

        foreach ($factualIndicators as $indicator) {
            if (str_contains(strtolower($content), $indicator)) {
                return true;
            }
        }

        return false;
    }

    private function enrichCachedResponse(array $cached): array
    {
        return array_merge($cached['response'], [
            '_cache_hit' => true,
            '_cached_at' => $cached['cached_at'],
            '_cache_age' => now()->diffInSeconds($cached['cached_at']),
        ]);
    }

    private function logCacheHit(string $cacheKey, array $messages): void
    {
        Log::info('OpenAI response cache hit', [
            'cache_key' => substr($cacheKey, 0, 32) . '...',
            'message_count' => count($messages),
        ]);
    }

    private function logCacheStore(string $cacheKey, int $ttl, array $response): void
    {
        $usage = $response['usage'] ?? [];

        Log::info('OpenAI response cached', [
            'cache_key' => substr($cacheKey, 0, 32) . '...',
            'ttl' => $ttl,
            'prompt_tokens' => $usage['prompt_tokens'] ?? 0,
            'completion_tokens' => $usage['completion_tokens'] ?? 0,
        ]);
    }
}
```

## Cache Invalidation Strategies

### Event-Driven Cache Invalidation

```php
<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CacheInvalidationListener
{
    /**
     * Handle database model updates
     */
    public function handleModelUpdated($event): void
    {
        $model = $event->model;
        $tableName = $model->getTable();

        // Invalidate related database query caches
        Cache::tags(['database_queries', $tableName])->flush();

        // Invalidate user-specific caches if user model
        if ($model instanceof \App\Models\User) {
            Cache::tags(["user_{$model->id}"])->flush();
        }

        Log::info('Cache invalidated for model update', [
            'model' => get_class($model),
            'id' => $model->getKey(),
            'table' => $tableName,
        ]);
    }

    /**
     * Handle file system changes
     */
    public function handleFileChanged(string $filePath): void
    {
        // Invalidate file resource caches
        $pattern = 'file_resource:' . md5($filePath) . ':*';
        $this->invalidateByPattern($pattern);

        // If it's a configuration file, invalidate config caches
        if (str_contains($filePath, 'config/')) {
            Cache::tags(['config_files'])->flush();
        }

        Log::info('Cache invalidated for file change', [
            'file_path' => $filePath,
        ]);
    }

    /**
     * Handle tool registration changes
     */
    public function handleToolsChanged(): void
    {
        // Invalidate tool schema caches
        Cache::tags(['mcp_tools', 'openai_tool_schemas'])->flush();

        Log::info('Cache invalidated for tool changes');
    }

    private function invalidateByPattern(string $pattern): void
    {
        // Note: This requires Redis cache driver for pattern matching
        if (config('cache.default') === 'redis') {
            $redis = Cache::getRedis();
            $keys = $redis->keys($pattern);
            if (!empty($keys)) {
                $redis->del($keys);
            }
        }
    }
}
```

### Scheduled Cache Maintenance

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class CacheMaintenanceCommand extends Command
{
    protected $signature = 'mcp:cache-maintenance
                           {--clean-expired : Remove expired cache entries}
                           {--optimize : Optimize cache performance}
                           {--stats : Show cache statistics}';

    protected $description = 'Perform MCP cache maintenance tasks';

    public function handle(): int
    {
        if ($this->option('clean-expired')) {
            $this->cleanExpiredEntries();
        }

        if ($this->option('optimize')) {
            $this->optimizeCache();
        }

        if ($this->option('stats')) {
            $this->showCacheStats();
        }

        if (!$this->hasOption()) {
            $this->performFullMaintenance();
        }

        return 0;
    }

    private function cleanExpiredEntries(): void
    {
        $this->info('Cleaning expired cache entries...');

        // Clean up old conversation histories
        $this->cleanOldConversations();

        // Clean up orphaned tool result caches
        $this->cleanOrphanedToolCaches();

        $this->info('✓ Expired entries cleaned');
    }

    private function optimizeCache(): void
    {
        $this->info('Optimizing cache performance...');

        // Warm frequently used caches
        $this->warmFrequentCaches();

        // Compress large cache entries
        $this->compressLargeCaches();

        $this->info('✓ Cache optimized');
    }

    private function showCacheStats(): void
    {
        $stats = $this->gatherCacheStats();

        $this->table(['Metric', 'Value'], [
            ['Total Entries', number_format($stats['total_entries'])],
            ['Memory Usage', $this->formatBytes($stats['memory_usage'])],
            ['Hit Rate', $stats['hit_rate'] . '%'],
            ['Tool Cache Entries', number_format($stats['tool_entries'])],
            ['OpenAI Cache Entries', number_format($stats['openai_entries'])],
            ['File Cache Entries', number_format($stats['file_entries'])],
        ]);
    }

    private function performFullMaintenance(): void
    {
        $this->cleanExpiredEntries();
        $this->optimizeCache();
        $this->showCacheStats();
    }

    private function cleanOldConversations(): void
    {
        // Remove conversations older than 7 days
        $pattern = 'conversation:*';
        $cutoff = now()->subDays(7);

        // Implementation depends on cache driver
        $this->info('Cleaned old conversations');
    }

    private function warmFrequentCaches(): void
    {
        // Warm commonly used tool results
        $commonQueries = [
            ['tool' => 'system_status', 'params' => []],
            ['tool' => 'user_count', 'params' => []],
        ];

        foreach ($commonQueries as $query) {
            // Execute to warm cache
            $this->info("Warming cache for {$query['tool']}");
        }
    }

    private function gatherCacheStats(): array
    {
        // Implementation depends on cache driver
        return [
            'total_entries' => 1000,
            'memory_usage' => 1024 * 1024 * 50, // 50MB
            'hit_rate' => 85.5,
            'tool_entries' => 250,
            'openai_entries' => 150,
            'file_entries' => 75,
        ];
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

    private function hasOption(): bool
    {
        return $this->option('clean-expired') ||
               $this->option('optimize') ||
               $this->option('stats');
    }
}
```

## Performance Monitoring

### Cache Performance Metrics

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CacheMetricsCollector
{
    private array $metrics = [];

    /**
     * Record cache hit
     */
    public function recordHit(string $key, string $category = 'general'): void
    {
        $this->incrementMetric("cache.{$category}.hits");
        $this->incrementMetric('cache.total.hits');
    }

    /**
     * Record cache miss
     */
    public function recordMiss(string $key, string $category = 'general'): void
    {
        $this->incrementMetric("cache.{$category}.misses");
        $this->incrementMetric('cache.total.misses');
    }

    /**
     * Record cache write
     */
    public function recordWrite(string $key, int $size, int $ttl, string $category = 'general'): void
    {
        $this->incrementMetric("cache.{$category}.writes");
        $this->incrementMetric('cache.total.writes');
        $this->recordGauge("cache.{$category}.avg_size", $size);
        $this->recordGauge("cache.{$category}.avg_ttl", $ttl);
    }

    /**
     * Get cache performance report
     */
    public function getPerformanceReport(): array
    {
        $report = [
            'hit_rates' => [],
            'write_volumes' => [],
            'performance_issues' => [],
            'recommendations' => [],
        ];

        foreach (['tools', 'openai', 'files', 'database'] as $category) {
            $hits = $this->getMetric("cache.{$category}.hits", 0);
            $misses = $this->getMetric("cache.{$category}.misses", 0);
            $total = $hits + $misses;

            if ($total > 0) {
                $hitRate = ($hits / $total) * 100;
                $report['hit_rates'][$category] = round($hitRate, 2);

                // Identify performance issues
                if ($hitRate < 50) {
                    $report['performance_issues'][] = "Low hit rate for {$category}: {$hitRate}%";
                    $report['recommendations'][] = "Consider increasing TTL for {$category} cache";
                }
            }

            $writes = $this->getMetric("cache.{$category}.writes", 0);
            $report['write_volumes'][$category] = $writes;

            // Check for excessive writes
            if ($writes > $hits * 2) {
                $report['performance_issues'][] = "High write-to-hit ratio for {$category}";
                $report['recommendations'][] = "Review {$category} caching strategy";
            }
        }

        return $report;
    }

    /**
     * Monitor cache size and suggest cleanup
     */
    public function monitorCacheSize(): array
    {
        $sizeReport = [
            'total_size' => $this->getTotalCacheSize(),
            'category_sizes' => $this->getCategorySizes(),
            'cleanup_suggestions' => [],
        ];

        // Suggest cleanup if total size is too large
        if ($sizeReport['total_size'] > 100 * 1024 * 1024) { // 100MB
            $sizeReport['cleanup_suggestions'][] = 'Total cache size exceeds 100MB - consider cleanup';
        }

        // Check individual categories
        foreach ($sizeReport['category_sizes'] as $category => $size) {
            if ($size > 20 * 1024 * 1024) { // 20MB
                $sizeReport['cleanup_suggestions'][] = "Category {$category} is using {$this->formatBytes($size)}";
            }
        }

        return $sizeReport;
    }

    private function incrementMetric(string $key): void
    {
        $this->metrics[$key] = ($this->metrics[$key] ?? 0) + 1;
    }

    private function recordGauge(string $key, float $value): void
    {
        if (!isset($this->metrics[$key . '_values'])) {
            $this->metrics[$key . '_values'] = [];
        }
        $this->metrics[$key . '_values'][] = $value;
    }

    private function getMetric(string $key, $default = null)
    {
        return $this->metrics[$key] ?? $default;
    }

    private function getTotalCacheSize(): int
    {
        // Implementation depends on cache driver
        return 50 * 1024 * 1024; // Placeholder: 50MB
    }

    private function getCategorySizes(): array
    {
        // Implementation depends on cache driver
        return [
            'tools' => 20 * 1024 * 1024,
            'openai' => 15 * 1024 * 1024,
            'files' => 10 * 1024 * 1024,
            'database' => 5 * 1024 * 1024,
        ];
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

## Testing Cache Implementation

### Cache Testing Utilities

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Cache;

class CacheImplementationTest extends TestCase
{
    public function test_tool_result_caching_works(): void
    {
        $tool = new \App\Mcp\Tools\SmartCachedTool();

        // First call should miss cache
        $result1 = $tool->handle(['test' => 'value']);
        $this->assertFalse($result1['_cache_hit']);

        // Second call should hit cache
        $result2 = $tool->handle(['test' => 'value']);
        $this->assertTrue($result2['_cache_hit']);

        // Different parameters should miss cache
        $result3 = $tool->handle(['test' => 'different']);
        $this->assertFalse($result3['_cache_hit']);
    }

    public function test_cache_invalidation_on_data_change(): void
    {
        // Create initial cached result
        $tool = new \App\Mcp\Tools\CachedDatabaseTool();
        $result1 = $tool->handle([
            'query' => 'SELECT COUNT(*) FROM users',
            'bindings' => []
        ]);

        // Simulate data change
        \App\Models\User::factory()->create();

        // Should invalidate cache and return fresh data
        $result2 = $tool->handle([
            'query' => 'SELECT COUNT(*) FROM users',
            'bindings' => []
        ]);

        $this->assertNotEquals(
            $result1['data'][0]->count,
            $result2['data'][0]->count
        );
    }

    public function test_openai_response_caching(): void
    {
        $cacheManager = app(\App\Services\OpenAICacheManager::class);

        $messages = [
            ['role' => 'user', 'content' => 'What is 2+2?']
        ];

        $options = ['temperature' => 0.1]; // Low temperature for caching

        // Should not have cached response initially
        $cached = $cacheManager->getCachedResponse($messages, $options);
        $this->assertNull($cached);

        // Mock OpenAI response
        $response = [
            'choices' => [
                ['message' => ['content' => '2+2 equals 4']]
            ],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5]
        ];

        // Cache the response
        $cacheManager->cacheResponse($messages, $options, $response);

        // Should now return cached response
        $cached = $cacheManager->getCachedResponse($messages, $options);
        $this->assertNotNull($cached);
        $this->assertTrue($cached['_cache_hit']);
    }

    public function test_cache_performance_monitoring(): void
    {
        $metrics = app(\App\Services\CacheMetricsCollector::class);

        // Record some cache operations
        $metrics->recordHit('test_key', 'tools');
        $metrics->recordMiss('test_key2', 'tools');
        $metrics->recordWrite('test_key3', 1024, 3600, 'tools');

        $report = $metrics->getPerformanceReport();

        $this->assertArrayHasKey('hit_rates', $report);
        $this->assertArrayHasKey('tools', $report['hit_rates']);
        $this->assertEquals(50.0, $report['hit_rates']['tools']); // 1 hit, 1 miss = 50%
    }
}
```

## Best Practices Summary

### 1. Cache Strategy Selection

- **Real-time data**: Short TTL (1-5 minutes)
- **Semi-static data**: Medium TTL (30 minutes - 1 hour)
- **Static data**: Long TTL (1-24 hours)
- **User-specific data**: Tagged for easy invalidation

### 2. Cache Key Design

- Include all relevant parameters
- Use consistent naming conventions
- Include version/timestamp for time-sensitive data
- Keep keys reasonably short but descriptive

### 3. Invalidation Strategies

- Use cache tags for grouped invalidation
- Implement event-driven invalidation
- Monitor cache hit rates
- Regular maintenance and cleanup

### 4. Performance Optimization

- Monitor cache metrics
- Implement cache warming for common queries
- Use appropriate cache drivers (Redis for production)
- Compress large cache entries

### 5. Error Handling

- Graceful fallback when cache fails
- Don't cache error responses
- Log cache operations for debugging
- Implement circuit breakers for cache dependencies

## See Also

- [Server Implementation](server-implementation.md)
- [Client Implementation](client-implementation.md)
- [OpenAI Integration](openai-integration.md)
- [Performance Guide](../guide/performance.md)
