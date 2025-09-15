# Error Handling

Comprehensive guide to error handling patterns and best practices in the PHP MCP SDK.

## Error Types

### McpError

The primary error type for MCP operations:

```php
use MCP\Types\McpError;
use MCP\Types\ErrorCode;

throw new McpError(
    ErrorCode::InvalidParams,
    'Parameter validation failed',
    ['field' => 'email', 'issue' => 'Invalid format']
);
```

### Error Codes

Standard error codes following JSON-RPC 2.0 specification:

- `ParseError` (-32700) - Invalid JSON
- `InvalidRequest` (-32600) - Invalid request format
- `MethodNotFound` (-32601) - Method not found
- `InvalidParams` (-32602) - Invalid parameters
- `InternalError` (-32603) - Internal server error

## Error Handling Patterns

### Server Error Handling

```php
$server->tool(
    'safe_tool',
    'Tool with comprehensive error handling',
    $schema,
    function (array $params): array {
        try {
            // Validate inputs
            if (!isset($params['required_field'])) {
                throw new McpError(
                    ErrorCode::InvalidParams,
                    'Missing required field: required_field'
                );
            }

            // Process request
            $result = $this->processRequest($params);

            return ['content' => [['type' => 'text', 'text' => $result]]];

        } catch (McpError $e) {
            // Re-throw MCP errors as-is
            throw $e;
        } catch (\Exception $e) {
            // Wrap other exceptions
            throw new McpError(
                ErrorCode::InternalError,
                'Processing failed: ' . $e->getMessage()
            );
        }
    }
);
```

### Client Error Handling

```php
async(function () use ($client) {
    try {
        $result = $client->callTool('example_tool', $params)->await();
        return $result;
    } catch (McpError $e) {
        match($e->getCode()) {
            ErrorCode::MethodNotFound => echo "Tool not available\n",
            ErrorCode::InvalidParams => echo "Invalid parameters: {$e->getMessage()}\n",
            ErrorCode::Unauthorized => echo "Authentication required\n",
            default => echo "MCP Error: {$e->getMessage()}\n"
        };
    } catch (\Exception $e) {
        echo "Unexpected error: {$e->getMessage()}\n";
    }
})->await();
```

## See Also

- [API Reference](../api/)
- [Testing Guide](testing)
- [Security Guide](security)
