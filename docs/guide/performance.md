# Performance Optimization

Learn how to optimize your MCP servers and clients for high performance and scalability.

## Caching Strategies

### Tool Result Caching

```php
class CachingServer
{
    private array $cache = [];
    private int $ttl = 300;

    public function cachedTool(string $name, array $params, callable $handler): array
    {
        $cacheKey = md5($name . json_encode($params));

        if (isset($this->cache[$cacheKey])) {
            $cached = $this->cache[$cacheKey];
            if (time() - $cached['timestamp'] < $this->ttl) {
                return $cached['result'];
            }
        }

        $result = $handler($params);

        $this->cache[$cacheKey] = [
            'result' => $result,
            'timestamp' => time()
        ];

        return $result;
    }
}
```

## Async Optimization

### Parallel Operations

```php
async(function () use ($client) {
    // Execute tools in parallel
    $promises = [
        $client->callTool('tool1', $params1),
        $client->callTool('tool2', $params2),
        $client->callTool('tool3', $params3)
    ];

    $results = Promise::all($promises)->await();
})->await();
```

## Memory Management

### Streaming Large Responses

```php
function streamLargeResource(string $filePath): \Generator
{
    $handle = fopen($filePath, 'r');

    while (!feof($handle)) {
        yield fread($handle, 8192); // Read in 8KB chunks
    }

    fclose($handle);
}
```

## See Also

- [Server API](../api/server)
- [Client API](../api/client)
- [Enterprise Scaling](../enterprise/scaling)
