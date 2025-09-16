# Security & Compliance

Enterprise security patterns and compliance frameworks for PHP MCP SDK applications.

## Overview

This guide covers comprehensive security implementation for PHP MCP SDK applications, including authentication, authorization, data protection, and compliance with industry standards.

## Authentication & Authorization

### OAuth 2.0 Implementation

```php
<?php
// src/Auth/OAuth2Provider.php

use League\OAuth2\Server\AuthorizationServer;
use League\OAuth2\Server\Grant\ClientCredentialsGrant;
use League\OAuth2\Server\Repositories\AccessTokenRepositoryInterface;
use League\OAuth2\Server\Repositories\ClientRepositoryInterface;
use League\OAuth2\Server\Repositories\ScopeRepositoryInterface;

class OAuth2Provider
{
    private AuthorizationServer $server;

    public function __construct(
        ClientRepositoryInterface $clientRepository,
        AccessTokenRepositoryInterface $accessTokenRepository,
        ScopeRepositoryInterface $scopeRepository,
        string $privateKey,
        string $encryptionKey
    ) {
        $this->server = new AuthorizationServer(
            $clientRepository,
            $accessTokenRepository,
            $scopeRepository,
            $privateKey,
            $encryptionKey
        );

        // Enable Client Credentials Grant
        $this->server->enableGrantType(
            new ClientCredentialsGrant(),
            new \DateInterval('PT1H') // 1 hour
        );
    }

    public function generateAccessToken(array $request): array
    {
        $request = ServerRequestFactory::fromGlobals();
        $response = new Response();

        try {
            $response = $this->server->respondToAccessTokenRequest($request, $response);
            return json_decode($response->getBody()->getContents(), true);
        } catch (OAuthServerException $exception) {
            throw new AuthenticationException($exception->getMessage());
        }
    }

    public function validateToken(string $token): array
    {
        $request = (new ServerRequest())
            ->withHeader('Authorization', "Bearer {$token}");

        try {
            $request = $this->server->validateAuthenticatedRequest($request);
            return [
                'client_id' => $request->getAttribute('oauth_client_id'),
                'scopes' => $request->getAttribute('oauth_scopes'),
                'user_id' => $request->getAttribute('oauth_user_id'),
            ];
        } catch (OAuthServerException $exception) {
            throw new AuthenticationException('Invalid token');
        }
    }
}
```

### Role-Based Access Control (RBAC)

```php
<?php
// src/Auth/RoleBasedAccessControl.php

class RoleBasedAccessControl
{
    private array $permissions = [];
    private array $roles = [];

    public function __construct()
    {
        $this->definePermissions();
        $this->defineRoles();
    }

    private function definePermissions(): void
    {
        $this->permissions = [
            'tools.execute' => 'Execute MCP tools',
            'tools.list' => 'List available tools',
            'resources.read' => 'Read MCP resources',
            'resources.write' => 'Write MCP resources',
            'prompts.use' => 'Use MCP prompts',
            'admin.manage' => 'Administrative access',
        ];
    }

    private function defineRoles(): void
    {
        $this->roles = [
            'guest' => ['tools.list'],
            'user' => ['tools.list', 'tools.execute', 'resources.read', 'prompts.use'],
            'power_user' => ['tools.list', 'tools.execute', 'resources.read', 'resources.write', 'prompts.use'],
            'admin' => array_keys($this->permissions),
        ];
    }

    public function hasPermission(string $role, string $permission): bool
    {
        return in_array($permission, $this->roles[$role] ?? [], true);
    }

    public function checkPermission(string $role, string $permission): void
    {
        if (!$this->hasPermission($role, $permission)) {
            throw new AuthorizationException(
                "Role '{$role}' does not have permission '{$permission}'"
            );
        }
    }

    public function getRolePermissions(string $role): array
    {
        return $this->roles[$role] ?? [];
    }
}
```

### JWT Token Management

```php
<?php
// src/Auth/JwtTokenManager.php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtTokenManager
{
    private string $secretKey;
    private string $algorithm;
    private int $expiration;

    public function __construct(string $secretKey, string $algorithm = 'HS256', int $expiration = 3600)
    {
        $this->secretKey = $secretKey;
        $this->algorithm = $algorithm;
        $this->expiration = $expiration;
    }

    public function generateToken(array $payload): string
    {
        $now = time();

        $token = [
            'iat' => $now,
            'exp' => $now + $this->expiration,
            'iss' => 'mcp-server',
            'data' => $payload,
        ];

        return JWT::encode($token, $this->secretKey, $this->algorithm);
    }

    public function validateToken(string $token): array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->secretKey, $this->algorithm));
            return (array) $decoded->data;
        } catch (Exception $e) {
            throw new AuthenticationException('Invalid token: ' . $e->getMessage());
        }
    }

    public function refreshToken(string $token): string
    {
        $payload = $this->validateToken($token);
        return $this->generateToken($payload);
    }
}
```

## Input Validation & Sanitization

### Comprehensive Input Validator

```php
<?php
// src/Security/InputValidator.php

class InputValidator
{
    private array $rules = [];
    private array $sanitizers = [];

    public function __construct()
    {
        $this->defineSanitizers();
    }

    private function defineSanitizers(): void
    {
        $this->sanitizers = [
            'string' => fn($value) => filter_var($value, FILTER_SANITIZE_STRING),
            'email' => fn($value) => filter_var($value, FILTER_SANITIZE_EMAIL),
            'url' => fn($value) => filter_var($value, FILTER_SANITIZE_URL),
            'int' => fn($value) => filter_var($value, FILTER_SANITIZE_NUMBER_INT),
            'float' => fn($value) => filter_var($value, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION),
            'html' => fn($value) => htmlspecialchars($value, ENT_QUOTES, 'UTF-8'),
            'sql' => fn($value) => addslashes($value),
            'path' => fn($value) => str_replace(['../', './'], '', $value),
        ];
    }

    public function validate(array $data, array $rules): array
    {
        $errors = [];
        $sanitized = [];

        foreach ($rules as $field => $rule) {
            $value = $data[$field] ?? null;

            try {
                $sanitized[$field] = $this->validateField($field, $value, $rule);
            } catch (ValidationException $e) {
                $errors[$field] = $e->getMessage();
            }
        }

        if (!empty($errors)) {
            throw new ValidationException('Validation failed', $errors);
        }

        return $sanitized;
    }

    private function validateField(string $field, $value, array $rule)
    {
        // Required check
        if (($rule['required'] ?? false) && ($value === null || $value === '')) {
            throw new ValidationException("Field '{$field}' is required");
        }

        if ($value === null || $value === '') {
            return $value;
        }

        // Type validation
        if (isset($rule['type'])) {
            $this->validateType($field, $value, $rule['type']);
        }

        // Sanitization
        if (isset($rule['sanitize'])) {
            $value = $this->sanitize($value, $rule['sanitize']);
        }

        // Length validation
        if (isset($rule['max_length']) && strlen($value) > $rule['max_length']) {
            throw new ValidationException("Field '{$field}' exceeds maximum length");
        }

        // Pattern validation
        if (isset($rule['pattern']) && !preg_match($rule['pattern'], $value)) {
            throw new ValidationException("Field '{$field}' does not match required pattern");
        }

        return $value;
    }

    private function sanitize($value, string $type)
    {
        if (!isset($this->sanitizers[$type])) {
            throw new InvalidArgumentException("Unknown sanitizer: {$type}");
        }

        return $this->sanitizers[$type]($value);
    }
}
```

### SQL Injection Prevention

```php
<?php
// src/Security/SafeQueryBuilder.php

class SafeQueryBuilder
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function select(string $table, array $columns = ['*'], array $where = [], array $options = []): array
    {
        $this->validateTableName($table);
        $this->validateColumnNames($columns);

        $sql = "SELECT " . implode(', ', $columns) . " FROM `{$table}`";
        $params = [];

        if (!empty($where)) {
            $conditions = [];
            foreach ($where as $column => $value) {
                $this->validateColumnName($column);
                $conditions[] = "`{$column}` = :{$column}";
                $params[$column] = $value;
            }
            $sql .= " WHERE " . implode(' AND ', $conditions);
        }

        if (isset($options['order_by'])) {
            $this->validateColumnName($options['order_by']);
            $direction = strtoupper($options['order_direction'] ?? 'ASC');
            if (!in_array($direction, ['ASC', 'DESC'])) {
                throw new InvalidArgumentException('Invalid order direction');
            }
            $sql .= " ORDER BY `{$options['order_by']}` {$direction}";
        }

        if (isset($options['limit'])) {
            $limit = (int) $options['limit'];
            $sql .= " LIMIT {$limit}";
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function validateTableName(string $table): void
    {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $table)) {
            throw new InvalidArgumentException('Invalid table name');
        }
    }

    private function validateColumnName(string $column): void
    {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column)) {
            throw new InvalidArgumentException('Invalid column name');
        }
    }

    private function validateColumnNames(array $columns): void
    {
        foreach ($columns as $column) {
            if ($column !== '*') {
                $this->validateColumnName($column);
            }
        }
    }
}
```

## Data Encryption

### Encryption Service

```php
<?php
// src/Security/EncryptionService.php

class EncryptionService
{
    private string $key;
    private string $cipher;

    public function __construct(string $key, string $cipher = 'aes-256-gcm')
    {
        $this->key = $key;
        $this->cipher = $cipher;
    }

    public function encrypt(string $data): string
    {
        $iv = random_bytes(openssl_cipher_iv_length($this->cipher));
        $tag = '';

        $encrypted = openssl_encrypt(
            $data,
            $this->cipher,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($encrypted === false) {
            throw new EncryptionException('Encryption failed');
        }

        return base64_encode($iv . $tag . $encrypted);
    }

    public function decrypt(string $encryptedData): string
    {
        $data = base64_decode($encryptedData);

        $ivLength = openssl_cipher_iv_length($this->cipher);
        $iv = substr($data, 0, $ivLength);
        $tag = substr($data, $ivLength, 16);
        $encrypted = substr($data, $ivLength + 16);

        $decrypted = openssl_decrypt(
            $encrypted,
            $this->cipher,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($decrypted === false) {
            throw new EncryptionException('Decryption failed');
        }

        return $decrypted;
    }

    public function hash(string $data, string $salt = ''): string
    {
        return hash_hmac('sha256', $data, $this->key . $salt);
    }

    public function generateSecureToken(int $length = 32): string
    {
        return bin2hex(random_bytes($length));
    }
}
```

### Database Encryption

```php
<?php
// src/Security/EncryptedDatabase.php

class EncryptedDatabase
{
    private PDO $pdo;
    private EncryptionService $encryption;
    private array $encryptedFields = [];

    public function __construct(PDO $pdo, EncryptionService $encryption)
    {
        $this->pdo = $pdo;
        $this->encryption = $encryption;
    }

    public function addEncryptedField(string $table, string $field): void
    {
        $this->encryptedFields[$table][] = $field;
    }

    public function insert(string $table, array $data): bool
    {
        $encryptedData = $this->encryptFields($table, $data);

        $columns = array_keys($encryptedData);
        $placeholders = array_map(fn($col) => ":{$col}", $columns);

        $sql = "INSERT INTO `{$table}` (`" . implode('`, `', $columns) . "`) VALUES (" . implode(', ', $placeholders) . ")";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($encryptedData);
    }

    public function select(string $table, array $where = []): array
    {
        $sql = "SELECT * FROM `{$table}`";
        $params = [];

        if (!empty($where)) {
            $conditions = [];
            foreach ($where as $column => $value) {
                $conditions[] = "`{$column}` = :{$column}";
                $params[$column] = $this->shouldEncrypt($table, $column)
                    ? $this->encryption->encrypt($value)
                    : $value;
            }
            $sql .= " WHERE " . implode(' AND ', $conditions);
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn($row) => $this->decryptFields($table, $row), $results);
    }

    private function encryptFields(string $table, array $data): array
    {
        $encrypted = [];

        foreach ($data as $field => $value) {
            $encrypted[$field] = $this->shouldEncrypt($table, $field)
                ? $this->encryption->encrypt($value)
                : $value;
        }

        return $encrypted;
    }

    private function decryptFields(string $table, array $data): array
    {
        $decrypted = [];

        foreach ($data as $field => $value) {
            try {
                $decrypted[$field] = $this->shouldEncrypt($table, $field)
                    ? $this->encryption->decrypt($value)
                    : $value;
            } catch (EncryptionException $e) {
                // Handle decryption failure gracefully
                $decrypted[$field] = null;
            }
        }

        return $decrypted;
    }

    private function shouldEncrypt(string $table, string $field): bool
    {
        return in_array($field, $this->encryptedFields[$table] ?? []);
    }
}
```

## Security Middleware

### Rate Limiting

```php
<?php
// src/Security/RateLimiter.php

class RateLimiter
{
    private Redis $redis;
    private int $maxRequests;
    private int $windowSize;

    public function __construct(Redis $redis, int $maxRequests = 100, int $windowSize = 60)
    {
        $this->redis = $redis;
        $this->maxRequests = $maxRequests;
        $this->windowSize = $windowSize;
    }

    public function isAllowed(string $identifier): bool
    {
        $key = "rate_limit:{$identifier}";
        $current = $this->redis->incr($key);

        if ($current === 1) {
            $this->redis->expire($key, $this->windowSize);
        }

        return $current <= $this->maxRequests;
    }

    public function getRemainingRequests(string $identifier): int
    {
        $key = "rate_limit:{$identifier}";
        $current = $this->redis->get($key) ?? 0;

        return max(0, $this->maxRequests - $current);
    }

    public function getResetTime(string $identifier): int
    {
        $key = "rate_limit:{$identifier}";
        return $this->redis->ttl($key);
    }
}
```

### Security Headers

```php
<?php
// src/Security/SecurityHeaders.php

class SecurityHeaders
{
    public static function apply(): void
    {
        // Prevent XSS attacks
        header('X-XSS-Protection: 1; mode=block');

        // Prevent MIME type sniffing
        header('X-Content-Type-Options: nosniff');

        // Prevent clickjacking
        header('X-Frame-Options: DENY');

        // Enforce HTTPS
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');

        // Content Security Policy
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';");

        // Referrer Policy
        header('Referrer-Policy: strict-origin-when-cross-origin');

        // Feature Policy
        header("Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()");
    }
}
```

## Compliance Frameworks

### SOC 2 Compliance

```php
<?php
// src/Compliance/Soc2Auditor.php

class Soc2Auditor
{
    private array $auditLog = [];

    public function logAccess(string $userId, string $resource, string $action, array $context = []): void
    {
        $this->auditLog[] = [
            'timestamp' => time(),
            'user_id' => $userId,
            'resource' => $resource,
            'action' => $action,
            'context' => $context,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        ];

        $this->persistAuditLog();
    }

    public function logDataChange(string $userId, string $table, string $recordId, array $changes): void
    {
        $this->auditLog[] = [
            'timestamp' => time(),
            'type' => 'data_change',
            'user_id' => $userId,
            'table' => $table,
            'record_id' => $recordId,
            'changes' => $changes,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ];

        $this->persistAuditLog();
    }

    public function generateComplianceReport(int $startTime, int $endTime): array
    {
        // Generate SOC 2 compliance report
        return [
            'period' => ['start' => $startTime, 'end' => $endTime],
            'access_controls' => $this->auditAccessControls($startTime, $endTime),
            'data_integrity' => $this->auditDataIntegrity($startTime, $endTime),
            'availability' => $this->auditAvailability($startTime, $endTime),
            'confidentiality' => $this->auditConfidentiality($startTime, $endTime),
            'privacy' => $this->auditPrivacy($startTime, $endTime),
        ];
    }

    private function persistAuditLog(): void
    {
        // Persist audit log to secure, immutable storage
        file_put_contents(
            '/var/log/audit/mcp-audit.log',
            json_encode(end($this->auditLog)) . "\n",
            FILE_APPEND | LOCK_EX
        );
    }
}
```

### GDPR Compliance

```php
<?php
// src/Compliance/GdprManager.php

class GdprManager
{
    private PDO $pdo;
    private EncryptionService $encryption;

    public function __construct(PDO $pdo, EncryptionService $encryption)
    {
        $this->pdo = $pdo;
        $this->encryption = $encryption;
    }

    public function exportUserData(string $userId): array
    {
        $tables = $this->getTablesWithUserData();
        $userData = [];

        foreach ($tables as $table => $userIdColumn) {
            $stmt = $this->pdo->prepare("SELECT * FROM `{$table}` WHERE `{$userIdColumn}` = ?");
            $stmt->execute([$userId]);
            $userData[$table] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return $userData;
    }

    public function deleteUserData(string $userId): bool
    {
        $this->pdo->beginTransaction();

        try {
            $tables = $this->getTablesWithUserData();

            foreach ($tables as $table => $userIdColumn) {
                $stmt = $this->pdo->prepare("DELETE FROM `{$table}` WHERE `{$userIdColumn}` = ?");
                $stmt->execute([$userId]);
            }

            // Log deletion for compliance
            $this->logDataDeletion($userId);

            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function anonymizeUserData(string $userId): bool
    {
        $anonymousId = 'anon_' . hash('sha256', $userId . time());

        $this->pdo->beginTransaction();

        try {
            $tables = $this->getTablesWithUserData();

            foreach ($tables as $table => $userIdColumn) {
                // Replace user ID with anonymous ID
                $stmt = $this->pdo->prepare("UPDATE `{$table}` SET `{$userIdColumn}` = ? WHERE `{$userIdColumn}` = ?");
                $stmt->execute([$anonymousId, $userId]);

                // Anonymize PII fields
                $this->anonymizePiiFields($table, $userIdColumn, $anonymousId);
            }

            $this->logDataAnonymization($userId, $anonymousId);

            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    private function getTablesWithUserData(): array
    {
        return [
            'users' => 'id',
            'user_sessions' => 'user_id',
            'user_preferences' => 'user_id',
            'audit_logs' => 'user_id',
        ];
    }
}
```

## Security Monitoring

### Intrusion Detection

```php
<?php
// src/Security/IntrusionDetector.php

class IntrusionDetector
{
    private array $suspiciousPatterns = [
        'sql_injection' => [
            '/union\s+select/i',
            '/drop\s+table/i',
            '/insert\s+into/i',
            '/delete\s+from/i',
        ],
        'xss' => [
            '/<script/i',
            '/javascript:/i',
            '/on\w+\s*=/i',
        ],
        'path_traversal' => [
            '/\.\.\//',
            '/\.\.\\\\/',
            '/\/etc\/passwd/',
            '/\/proc\//',
        ],
        'command_injection' => [
            '/;\s*\w+/',
            '/\|\s*\w+/',
            '/`[^`]*`/',
            '/\$\([^)]*\)/',
        ],
    ];

    public function analyzeRequest(array $request): array
    {
        $threats = [];

        foreach ($this->suspiciousPatterns as $type => $patterns) {
            foreach ($patterns as $pattern) {
                if ($this->matchesPattern($request, $pattern)) {
                    $threats[] = [
                        'type' => $type,
                        'pattern' => $pattern,
                        'severity' => $this->getSeverity($type),
                        'timestamp' => time(),
                    ];
                }
            }
        }

        if (!empty($threats)) {
            $this->logSecurityThreat($request, $threats);
        }

        return $threats;
    }

    private function matchesPattern(array $request, string $pattern): bool
    {
        $content = json_encode($request);
        return preg_match($pattern, $content) === 1;
    }

    private function getSeverity(string $type): string
    {
        $severityMap = [
            'sql_injection' => 'high',
            'xss' => 'medium',
            'path_traversal' => 'high',
            'command_injection' => 'critical',
        ];

        return $severityMap[$type] ?? 'low';
    }

    private function logSecurityThreat(array $request, array $threats): void
    {
        $logEntry = [
            'timestamp' => time(),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'request' => $request,
            'threats' => $threats,
        ];

        error_log(json_encode($logEntry), 3, '/var/log/security/intrusion.log');

        // Alert security team for critical threats
        foreach ($threats as $threat) {
            if ($threat['severity'] === 'critical') {
                $this->alertSecurityTeam($logEntry);
                break;
            }
        }
    }
}
```

## Penetration Testing

### Security Test Suite

```php
<?php
// tests/Security/SecurityTest.php

class SecurityTest extends TestCase
{
    public function testSqlInjectionPrevention(): void
    {
        $maliciousInputs = [
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "1' OR '1'='1",
        ];

        foreach ($maliciousInputs as $input) {
            $response = $this->makeRequest(['query' => $input]);
            $this->assertNotContains('users', $response['data'] ?? '');
        }
    }

    public function testXssProtection(): void
    {
        $xssPayloads = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src="x" onerror="alert(\'xss\')">',
        ];

        foreach ($xssPayloads as $payload) {
            $response = $this->makeRequest(['content' => $payload]);
            $this->assertNotContains('<script', $response['output'] ?? '');
        }
    }

    public function testAuthenticationBypass(): void
    {
        // Test without token
        $response = $this->makeRequest([]);
        $this->assertEquals(401, $response['status']);

        // Test with invalid token
        $response = $this->makeRequestWithToken('invalid-token', []);
        $this->assertEquals(401, $response['status']);

        // Test with expired token
        $expiredToken = $this->generateExpiredToken();
        $response = $this->makeRequestWithToken($expiredToken, []);
        $this->assertEquals(401, $response['status']);
    }

    public function testRateLimiting(): void
    {
        $identifier = 'test-client';

        // Make requests up to the limit
        for ($i = 0; $i < 100; $i++) {
            $response = $this->makeRequest([], $identifier);
            $this->assertEquals(200, $response['status']);
        }

        // Next request should be rate limited
        $response = $this->makeRequest([], $identifier);
        $this->assertEquals(429, $response['status']);
    }
}
```

## Security Best Practices

### 1. Defense in Depth

- Multiple layers of security controls
- Fail-safe defaults
- Principle of least privilege

### 2. Secure Development

- Input validation at all boundaries
- Output encoding for all contexts
- Parameterized queries for database access

### 3. Monitoring & Response

- Real-time threat detection
- Automated incident response
- Regular security assessments

### 4. Compliance Management

- Regular compliance audits
- Documentation and evidence collection
- Staff training and awareness

## Next Steps

- [Scaling & Performance](scaling) - Security considerations for scaling
- [Deployment Strategies](deployment) - Secure deployment practices
- [Monitoring & Observability](monitoring) - Security monitoring integration

Secure your PHP MCP SDK applications with enterprise-grade security! 🔒

