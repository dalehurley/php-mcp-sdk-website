# Security Best Practices

Essential security guidelines for building secure MCP applications with the PHP MCP SDK.

## Input Validation

Always validate and sanitize all inputs:

```php
function validateInput(array $params, array $schema): array
{
    // JSON Schema validation
    $validator = new JsonSchemaValidator();
    $validator->validate($params, $schema);

    // Additional sanitization
    return array_map(function($value) {
        return is_string($value) ? htmlspecialchars($value, ENT_QUOTES, 'UTF-8') : $value;
    }, $params);
}
```

## Authentication

### Secure Token Storage

```php
class SecureTokenStorage
{
    public function store(string $token): void
    {
        $encrypted = openssl_encrypt($token, 'AES-256-GCM', $this->key, 0, $iv, $tag);
        // Store securely...
    }
}
```

### Rate Limiting

```php
class RateLimiter
{
    public function isAllowed(string $clientId): bool
    {
        // Implement rate limiting logic
        return $this->checkRateLimit($clientId);
    }
}
```

## Path Security

For file operations, always validate paths:

```php
function validatePath(string $path, array $allowedPaths): string
{
    $realPath = realpath($path);

    foreach ($allowedPaths as $allowed) {
        if (strpos($realPath, realpath($allowed)) === 0) {
            return $realPath;
        }
    }

    throw new McpError(ErrorCode::Forbidden, 'Path access denied');
}
```

## See Also

- [Authentication Guide](authentication)
- [Error Handling](error-handling)
- [API Reference](../api/authentication)
