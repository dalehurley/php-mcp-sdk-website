# Authentication API Reference

Complete reference for authentication and authorization in the PHP MCP SDK.

## Overview

The PHP MCP SDK provides comprehensive authentication support including OAuth 2.0, custom providers, and role-based access control.

## AuthProvider Interface

Base interface for all authentication providers:

```php
interface AuthProvider
{
    public function authenticate(array $credentials): Promise;
    public function validateToken(string $token): Promise;
    public function refreshToken(string $refreshToken): Promise;
    public function getScopes(string $token): array;
    public function revokeToken(string $token): Promise;
}
```

## OAuth 2.0 Provider

### OAuth2Provider

```php
use MCP\Server\Auth\OAuth2Provider;

$authProvider = new OAuth2Provider([
    'clientId' => 'your-client-id',
    'clientSecret' => 'your-client-secret',
    'redirectUri' => 'http://localhost:3000/callback',
    'scopes' => ['read', 'write', 'admin'],
    'pkce' => true,
    'tokenUrl' => 'https://auth.example.com/token',
    'authUrl' => 'https://auth.example.com/authorize',
    'userInfoUrl' => 'https://auth.example.com/userinfo'
]);

$server->setAuthProvider($authProvider);
```

### OAuth 2.0 Flow

```php
// Authorization URL generation
$authUrl = $authProvider->getAuthorizationUrl([
    'scope' => 'read write',
    'state' => 'random-state-value'
]);

// Token exchange
$token = $authProvider->exchangeCodeForToken($authCode, $codeVerifier)->await();

// Token validation
$isValid = $authProvider->validateToken($token->accessToken)->await();

// Token refresh
$newToken = $authProvider->refreshToken($token->refreshToken)->await();
```

## Custom Authentication

### Custom AuthProvider

```php
class ApiKeyAuthProvider implements AuthProvider
{
    private array $validApiKeys;

    public function __construct(array $validApiKeys)
    {
        $this->validApiKeys = $validApiKeys;
    }

    public function authenticate(array $credentials): Promise
    {
        return async(function () use ($credentials) {
            $apiKey = $credentials['api_key'] ?? null;

            if (!$apiKey || !in_array($apiKey, $this->validApiKeys)) {
                throw new McpError(
                    ErrorCode::Unauthorized,
                    'Invalid API key'
                );
            }

            return [
                'token' => $apiKey,
                'scopes' => ['read', 'write'],
                'expires_at' => time() + 3600
            ];
        });
    }

    public function validateToken(string $token): Promise
    {
        return async(function () use ($token) {
            return in_array($token, $this->validApiKeys);
        });
    }

    public function getScopes(string $token): array
    {
        return in_array($token, $this->validApiKeys) ? ['read', 'write'] : [];
    }
}
```

### Database AuthProvider

```php
class DatabaseAuthProvider implements AuthProvider
{
    private \PDO $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function authenticate(array $credentials): Promise
    {
        return async(function () use ($credentials) {
            $username = $credentials['username'] ?? null;
            $password = $credentials['password'] ?? null;

            if (!$username || !$password) {
                throw new McpError(
                    ErrorCode::InvalidParams,
                    'Username and password required'
                );
            }

            $stmt = $this->pdo->prepare(
                'SELECT id, password_hash, scopes FROM users WHERE username = ?'
            );
            $stmt->execute([$username]);
            $user = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$user || !password_verify($password, $user['password_hash'])) {
                throw new McpError(
                    ErrorCode::Unauthorized,
                    'Invalid credentials'
                );
            }

            // Generate JWT token
            $token = $this->generateJwtToken($user);

            return [
                'token' => $token,
                'scopes' => json_decode($user['scopes'] ?? '[]'),
                'expires_at' => time() + 3600
            ];
        });
    }

    private function generateJwtToken(array $user): string
    {
        // JWT generation logic
        return jwt_encode([
            'sub' => $user['id'],
            'iat' => time(),
            'exp' => time() + 3600
        ], $_ENV['JWT_SECRET']);
    }
}
```

## Authorization

### Role-Based Access Control

```php
class RoleBasedAuthProvider implements AuthProvider
{
    private array $userRoles;
    private array $rolePermissions;

    public function __construct(array $userRoles, array $rolePermissions)
    {
        $this->userRoles = $userRoles;
        $this->rolePermissions = $rolePermissions;
    }

    public function hasPermission(string $token, string $permission): bool
    {
        $userId = $this->getUserIdFromToken($token);
        $userRole = $this->userRoles[$userId] ?? 'guest';
        $permissions = $this->rolePermissions[$userRole] ?? [];

        return in_array($permission, $permissions);
    }

    public function requirePermission(string $token, string $permission): void
    {
        if (!$this->hasPermission($token, $permission)) {
            throw new McpError(
                ErrorCode::Forbidden,
                "Permission '{$permission}' required"
            );
        }
    }
}
```

### Tool-Level Authorization

```php
$server->tool(
    'admin_tool',
    'Administrative function',
    $schema,
    function (array $params, ?array $context = null): array {
        $token = $context['auth_token'] ?? null;

        if (!$token) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Authentication required'
            );
        }

        $authProvider = $context['auth_provider'];
        $authProvider->requirePermission($token, 'admin');

        // Tool logic here...
        return $result;
    }
);
```

## Authentication Middleware

### Server Middleware

```php
class AuthenticationMiddleware
{
    private AuthProvider $authProvider;

    public function __construct(AuthProvider $authProvider)
    {
        $this->authProvider = $authProvider;
    }

    public function handle(array $request, callable $next): array
    {
        // Skip authentication for initialize method
        if ($request['method'] === 'initialize') {
            return $next($request);
        }

        $token = $this->extractToken($request);

        if (!$token) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Authentication token required'
            );
        }

        $isValid = $this->authProvider->validateToken($token)->await();

        if (!$isValid) {
            throw new McpError(
                ErrorCode::Unauthorized,
                'Invalid authentication token'
            );
        }

        // Add auth context to request
        $request['auth_context'] = [
            'token' => $token,
            'scopes' => $this->authProvider->getScopes($token)
        ];

        return $next($request);
    }

    private function extractToken(array $request): ?string
    {
        // Extract from Authorization header
        $headers = $request['headers'] ?? [];
        $authHeader = $headers['Authorization'] ?? null;

        if ($authHeader && preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
            return $matches[1];
        }

        // Extract from parameters
        return $request['params']['auth_token'] ?? null;
    }
}
```

### Client Middleware

```php
class ClientAuthMiddleware
{
    private string $token;

    public function __construct(string $token)
    {
        $this->token = $token;
    }

    public function handle(array $request, callable $next): array
    {
        // Add authentication to all requests
        $request['headers'] = array_merge(
            $request['headers'] ?? [],
            ['Authorization' => "Bearer {$this->token}"]
        );

        return $next($request);
    }
}
```

## Security Best Practices

### Token Storage

```php
class SecureTokenStorage
{
    private string $encryptionKey;

    public function __construct(string $encryptionKey)
    {
        $this->encryptionKey = $encryptionKey;
    }

    public function store(string $key, string $token): void
    {
        $encrypted = openssl_encrypt(
            $token,
            'AES-256-GCM',
            $this->encryptionKey,
            0,
            $iv,
            $tag
        );

        file_put_contents(
            $this->getTokenPath($key),
            base64_encode($iv . $tag . $encrypted)
        );
    }

    public function retrieve(string $key): ?string
    {
        $path = $this->getTokenPath($key);

        if (!file_exists($path)) {
            return null;
        }

        $data = base64_decode(file_get_contents($path));
        $iv = substr($data, 0, 12);
        $tag = substr($data, 12, 16);
        $encrypted = substr($data, 28);

        $token = openssl_decrypt(
            $encrypted,
            'AES-256-GCM',
            $this->encryptionKey,
            0,
            $iv,
            $tag
        );

        return $token ?: null;
    }

    private function getTokenPath(string $key): string
    {
        return sys_get_temp_dir() . '/mcp_token_' . hash('sha256', $key);
    }
}
```

### Rate Limiting

```php
class RateLimitingAuthProvider implements AuthProvider
{
    private AuthProvider $provider;
    private array $attempts = [];
    private int $maxAttempts = 5;
    private int $timeWindow = 300; // 5 minutes

    public function __construct(AuthProvider $provider)
    {
        $this->provider = $provider;
    }

    public function authenticate(array $credentials): Promise
    {
        return async(function () use ($credentials) {
            $clientId = $credentials['client_id'] ?? 'unknown';

            if (!$this->isAllowed($clientId)) {
                throw new McpError(
                    ErrorCode::TooManyRequests,
                    'Too many authentication attempts'
                );
            }

            try {
                $result = $this->provider->authenticate($credentials)->await();
                $this->resetAttempts($clientId);
                return $result;
            } catch (McpError $e) {
                $this->recordAttempt($clientId);
                throw $e;
            }
        });
    }

    private function isAllowed(string $clientId): bool
    {
        $now = time();
        $attempts = $this->attempts[$clientId] ?? [];

        // Remove old attempts
        $attempts = array_filter($attempts, fn($time) => $now - $time < $this->timeWindow);
        $this->attempts[$clientId] = $attempts;

        return count($attempts) < $this->maxAttempts;
    }

    private function recordAttempt(string $clientId): void
    {
        $this->attempts[$clientId][] = time();
    }

    private function resetAttempts(string $clientId): void
    {
        unset($this->attempts[$clientId]);
    }
}
```

## Complete Authentication Example

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\HttpServerTransport;
use MCP\Server\Auth\OAuth2Provider;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use function Amp\async;

// Create server with OAuth authentication
$server = new McpServer(new Implementation('secure-server', '1.0.0'));

// Set up OAuth provider
$authProvider = new OAuth2Provider([
    'clientId' => $_ENV['OAUTH_CLIENT_ID'],
    'clientSecret' => $_ENV['OAUTH_CLIENT_SECRET'],
    'redirectUri' => 'http://localhost:3000/callback',
    'scopes' => ['read', 'write', 'admin']
]);

$server->setAuthProvider($authProvider);

// Public tool (no auth required)
$server->tool(
    'public_info',
    'Get public server information',
    ['type' => 'object'],
    function (): array {
        return [
            'content' => [[
                'type' => 'text',
                'text' => 'This is public information available to all users.'
            ]]
        ];
    }
);

// Protected tool (requires authentication)
$server->tool(
    'user_data',
    'Get user-specific data',
    ['type' => 'object'],
    function (array $params, array $context): array {
        // Authentication is handled by middleware
        $scopes = $context['auth_context']['scopes'] ?? [];

        if (!in_array('read', $scopes)) {
            throw new McpError(
                ErrorCode::Forbidden,
                'Read scope required'
            );
        }

        return [
            'content' => [[
                'type' => 'text',
                'text' => 'This is protected user data.'
            ]]
        ];
    }
);

// Admin tool (requires admin scope)
$server->tool(
    'admin_action',
    'Perform administrative action',
    ['type' => 'object'],
    function (array $params, array $context): array {
        $scopes = $context['auth_context']['scopes'] ?? [];

        if (!in_array('admin', $scopes)) {
            throw new McpError(
                ErrorCode::Forbidden,
                'Admin scope required'
            );
        }

        return [
            'content' => [[
                'type' => 'text',
                'text' => 'Administrative action completed.'
            ]]
        ];
    }
);

// Start server
async(function () use ($server) {
    $transport = new HttpServerTransport([
        'host' => 'localhost',
        'port' => 3000,
        'ssl' => false
    ]);

    echo "Secure MCP server starting on http://localhost:3000\n";
    echo "OAuth endpoints:\n";
    echo "  - Authorization: http://localhost:3000/auth\n";
    echo "  - Token: http://localhost:3000/token\n";
    echo "  - MCP: http://localhost:3000/mcp\n\n";

    $server->connect($transport)->await();
})->await();
```

## See Also

- [Server API](server) - Server implementation with auth
- [Client API](client) - Client authentication patterns
- [Security Guide](../guide/security) - Security best practices
- [OAuth Examples](../integrations/openai) - Working OAuth implementations
