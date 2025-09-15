# Authentication & Security

Learn how to implement secure authentication and authorization in your MCP servers and clients.

## Overview

The PHP MCP SDK provides comprehensive security features including OAuth 2.0, custom authentication providers, and role-based access control.

## Authentication Providers

### OAuth 2.0 Provider

```php
use MCP\Server\Auth\OAuth2Provider;

$authProvider = new OAuth2Provider([
    'clientId' => $_ENV['OAUTH_CLIENT_ID'],
    'clientSecret' => $_ENV['OAUTH_CLIENT_SECRET'],
    'redirectUri' => 'http://localhost:3000/callback',
    'scopes' => ['read', 'write', 'admin'],
    'pkce' => true
]);

$server->setAuthProvider($authProvider);
```

### Custom Authentication

```php
class ApiKeyAuthProvider implements AuthProvider
{
    private array $validApiKeys;

    public function authenticate(array $credentials): Promise
    {
        return async(function () use ($credentials) {
            $apiKey = $credentials['api_key'] ?? null;

            if (!$apiKey || !in_array($apiKey, $this->validApiKeys)) {
                throw new McpError(ErrorCode::Unauthorized, 'Invalid API key');
            }

            return ['token' => $apiKey, 'scopes' => ['read', 'write']];
        });
    }
}
```

## Authorization Patterns

### Role-Based Access Control

```php
$server->tool(
    'admin_tool',
    'Administrative function',
    $schema,
    function (array $params, array $context): array {
        $scopes = $context['auth_context']['scopes'] ?? [];

        if (!in_array('admin', $scopes)) {
            throw new McpError(ErrorCode::Forbidden, 'Admin access required');
        }

        // Tool logic here...
        return $result;
    }
);
```

### Resource-Level Security

```php
$server->resource(
    'sensitive-data',
    'secure://data/{id}',
    'application/json',
    function (string $uri, array $context): array {
        $scopes = $context['auth_context']['scopes'] ?? [];

        if (!in_array('read:sensitive', $scopes)) {
            throw new McpError(ErrorCode::Forbidden, 'Sensitive data access denied');
        }

        // Resource logic here...
        return $result;
    }
);
```

## Security Best Practices

### Input Validation

```php
function validateAndSanitizeInput(array $params, array $schema): array
{
    // Validate against JSON schema
    $validator = new JsonSchemaValidator();
    $validator->validate($params, $schema);

    // Additional sanitization
    $sanitized = [];
    foreach ($params as $key => $value) {
        if (is_string($value)) {
            $sanitized[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        } else {
            $sanitized[$key] = $value;
        }
    }

    return $sanitized;
}
```

### Secure Token Storage

```php
class SecureTokenStorage
{
    private string $encryptionKey;

    public function store(string $key, string $token): void
    {
        $encrypted = openssl_encrypt($token, 'AES-256-GCM', $this->encryptionKey, 0, $iv, $tag);
        file_put_contents($this->getTokenPath($key), base64_encode($iv . $tag . $encrypted));
    }

    public function retrieve(string $key): ?string
    {
        // Decryption logic...
    }
}
```

## See Also

- [Authentication API](../api/authentication)
- [Security Best Practices](security)
- [OAuth Examples](../examples/oauth/)
