# Agentic AI Security

Security considerations and best practices for building secure AI agents with PHP MCP SDK.

## Overview

This guide covers security patterns specific to agentic AI systems, including agent authentication, tool access control, and protecting against AI-specific threats.

## Agent Authentication

### Agent Identity Management

```php
<?php
// src/AgenticAI/Security/AgentAuthenticator.php

class AgentAuthenticator
{
    private array $agents = [];
    private JwtTokenManager $tokenManager;

    public function __construct(JwtTokenManager $tokenManager)
    {
        $this->tokenManager = $tokenManager;
    }

    public function registerAgent(string $agentId, array $capabilities, array $restrictions = []): string
    {
        $agent = [
            'id' => $agentId,
            'capabilities' => $capabilities,
            'restrictions' => $restrictions,
            'created_at' => time(),
            'last_active' => null,
        ];

        $this->agents[$agentId] = $agent;

        return $this->tokenManager->generateToken([
            'agent_id' => $agentId,
            'capabilities' => $capabilities,
            'type' => 'agent',
        ]);
    }

    public function authenticateAgent(string $token): array
    {
        try {
            $payload = $this->tokenManager->validateToken($token);

            if ($payload['type'] !== 'agent') {
                throw new AuthenticationException('Invalid token type');
            }

            $agentId = $payload['agent_id'];

            if (!isset($this->agents[$agentId])) {
                throw new AuthenticationException('Agent not found');
            }

            $this->agents[$agentId]['last_active'] = time();

            return $this->agents[$agentId];
        } catch (Exception $e) {
            throw new AuthenticationException('Agent authentication failed: ' . $e->getMessage());
        }
    }

    public function revokeAgent(string $agentId): bool
    {
        if (isset($this->agents[$agentId])) {
            unset($this->agents[$agentId]);
            return true;
        }

        return false;
    }
}
```

## Tool Access Control

### Capability-Based Security

```php
<?php
// src/AgenticAI/Security/CapabilityManager.php

class CapabilityManager
{
    private array $capabilities = [];
    private array $toolCapabilities = [];

    public function defineCapability(string $name, string $description, array $permissions): void
    {
        $this->capabilities[$name] = [
            'description' => $description,
            'permissions' => $permissions,
            'created_at' => time(),
        ];
    }

    public function assignToolCapability(string $toolName, array $requiredCapabilities): void
    {
        $this->toolCapabilities[$toolName] = $requiredCapabilities;
    }

    public function checkToolAccess(array $agentCapabilities, string $toolName): bool
    {
        if (!isset($this->toolCapabilities[$toolName])) {
            // Tool has no specific requirements
            return true;
        }

        $requiredCapabilities = $this->toolCapabilities[$toolName];

        foreach ($requiredCapabilities as $required) {
            if (!in_array($required, $agentCapabilities, true)) {
                return false;
            }
        }

        return true;
    }

    public function getToolRequirements(string $toolName): array
    {
        return $this->toolCapabilities[$toolName] ?? [];
    }

    public function validateCapabilities(array $capabilities): bool
    {
        foreach ($capabilities as $capability) {
            if (!isset($this->capabilities[$capability])) {
                return false;
            }
        }

        return true;
    }
}
```

## Input Sanitization for AI

### AI-Specific Input Validation

```php
<?php
// src/AgenticAI/Security/AiInputValidator.php

class AiInputValidator
{
    private array $dangerousPatterns = [
        // Prompt injection patterns
        '/ignore\s+previous\s+instructions/i',
        '/forget\s+everything\s+above/i',
        '/system:\s*you\s+are\s+now/i',
        '/\[SYSTEM\]/i',
        '/\[\/INST\]/i',

        // Data exfiltration attempts
        '/print\s+all\s+users/i',
        '/show\s+database\s+schema/i',
        '/list\s+all\s+files/i',

        // Code injection
        '/exec\s*\(/i',
        '/eval\s*\(/i',
        '/system\s*\(/i',
        '/shell_exec\s*\(/i',
    ];

    private array $sensitiveKeywords = [
        'password', 'secret', 'token', 'key', 'credential',
        'private', 'confidential', 'internal', 'admin',
    ];

    public function validateInput(string $input): array
    {
        $issues = [];

        // Check for dangerous patterns
        foreach ($this->dangerousPatterns as $pattern) {
            if (preg_match($pattern, $input)) {
                $issues[] = [
                    'type' => 'dangerous_pattern',
                    'pattern' => $pattern,
                    'severity' => 'high',
                    'message' => 'Potential prompt injection detected',
                ];
            }
        }

        // Check for sensitive keywords
        $lowerInput = strtolower($input);
        foreach ($this->sensitiveKeywords as $keyword) {
            if (strpos($lowerInput, $keyword) !== false) {
                $issues[] = [
                    'type' => 'sensitive_keyword',
                    'keyword' => $keyword,
                    'severity' => 'medium',
                    'message' => 'Sensitive keyword detected',
                ];
            }
        }

        // Check input length
        if (strlen($input) > 10000) {
            $issues[] = [
                'type' => 'length_limit',
                'severity' => 'low',
                'message' => 'Input exceeds maximum length',
            ];
        }

        return $issues;
    }

    public function sanitizeInput(string $input): string
    {
        // Remove potential injection markers
        $sanitized = preg_replace('/\[SYSTEM\].*?\[\/SYSTEM\]/is', '', $input);
        $sanitized = preg_replace('/\[INST\].*?\[\/INST\]/is', '', $sanitized);

        // Remove excessive whitespace
        $sanitized = preg_replace('/\s+/', ' ', $sanitized);

        // Trim and limit length
        $sanitized = substr(trim($sanitized), 0, 10000);

        return $sanitized;
    }

    public function isInputSafe(string $input): bool
    {
        $issues = $this->validateInput($input);

        // Check if any high severity issues exist
        foreach ($issues as $issue) {
            if ($issue['severity'] === 'high') {
                return false;
            }
        }

        return true;
    }
}
```

## Agent Sandboxing

### Secure Execution Environment

```php
<?php
// src/AgenticAI/Security/AgentSandbox.php

class AgentSandbox
{
    private array $allowedFunctions = [];
    private array $blockedFunctions = [
        'exec', 'shell_exec', 'system', 'passthru',
        'file_get_contents', 'file_put_contents',
        'fopen', 'fwrite', 'unlink', 'rmdir',
        'eval', 'assert', 'create_function',
    ];

    private int $memoryLimit;
    private int $timeLimit;

    public function __construct(int $memoryLimit = 128 * 1024 * 1024, int $timeLimit = 30)
    {
        $this->memoryLimit = $memoryLimit;
        $this->timeLimit = $timeLimit;
    }

    public function executeInSandbox(callable $callback, array $context = []): array
    {
        // Set resource limits
        ini_set('memory_limit', $this->memoryLimit);
        set_time_limit($this->timeLimit);

        // Create isolated context
        $sandbox = new SandboxContext($context, $this->allowedFunctions);

        $startTime = microtime(true);
        $startMemory = memory_get_usage(true);

        try {
            // Execute in controlled environment
            $result = $sandbox->execute($callback);

            $endTime = microtime(true);
            $endMemory = memory_get_usage(true);

            return [
                'success' => true,
                'result' => $result,
                'execution_time' => $endTime - $startTime,
                'memory_used' => $endMemory - $startMemory,
                'peak_memory' => memory_get_peak_usage(true),
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'execution_time' => microtime(true) - $startTime,
                'memory_used' => memory_get_usage(true) - $startMemory,
            ];
        } finally {
            // Reset limits
            ini_restore('memory_limit');
            set_time_limit(0);
        }
    }

    public function addAllowedFunction(string $function): void
    {
        if (!in_array($function, $this->blockedFunctions)) {
            $this->allowedFunctions[] = $function;
        }
    }

    public function blockFunction(string $function): void
    {
        $this->blockedFunctions[] = $function;

        // Remove from allowed if present
        $key = array_search($function, $this->allowedFunctions);
        if ($key !== false) {
            unset($this->allowedFunctions[$key]);
        }
    }
}

class SandboxContext
{
    private array $context;
    private array $allowedFunctions;

    public function __construct(array $context, array $allowedFunctions)
    {
        $this->context = $context;
        $this->allowedFunctions = $allowedFunctions;
    }

    public function execute(callable $callback)
    {
        // Disable dangerous functions
        foreach (get_defined_functions()['internal'] as $function) {
            if (!in_array($function, $this->allowedFunctions) &&
                in_array($function, $this->getBlockedFunctions())) {
                // Function is blocked but we can't actually disable it in PHP
                // This is a conceptual implementation
            }
        }

        return $callback($this->context);
    }

    private function getBlockedFunctions(): array
    {
        return [
            'exec', 'shell_exec', 'system', 'passthru',
            'file_get_contents', 'file_put_contents',
            'fopen', 'fwrite', 'unlink', 'rmdir',
            'eval', 'assert', 'create_function',
        ];
    }
}
```

## Audit Logging for AI

### AI-Specific Audit Trail

```php
<?php
// src/AgenticAI/Security/AiAuditLogger.php

class AiAuditLogger
{
    private StructuredLogger $logger;
    private EncryptionService $encryption;

    public function __construct(StructuredLogger $logger, EncryptionService $encryption)
    {
        $this->logger = $logger;
        $this->encryption = $encryption;
    }

    public function logAgentAction(string $agentId, string $action, array $context = []): void
    {
        $logEntry = [
            'event_type' => 'agent_action',
            'agent_id' => $agentId,
            'action' => $action,
            'context' => $this->sanitizeContext($context),
            'timestamp' => time(),
            'session_id' => $context['session_id'] ?? null,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ];

        // Encrypt sensitive data
        if (isset($context['sensitive_data'])) {
            $logEntry['encrypted_data'] = $this->encryption->encrypt(
                json_encode($context['sensitive_data'])
            );
            unset($logEntry['context']['sensitive_data']);
        }

        $this->logger->info('Agent Action', $logEntry);
    }

    public function logToolExecution(string $agentId, string $toolName, array $params, array $result): void
    {
        $logEntry = [
            'event_type' => 'tool_execution',
            'agent_id' => $agentId,
            'tool_name' => $toolName,
            'parameters' => $this->sanitizeParameters($params),
            'result_summary' => $this->summarizeResult($result),
            'timestamp' => time(),
            'execution_time' => $result['execution_time'] ?? null,
        ];

        $this->logger->info('Tool Execution', $logEntry);
    }

    public function logSecurityEvent(string $agentId, string $eventType, array $details): void
    {
        $logEntry = [
            'event_type' => 'security_event',
            'agent_id' => $agentId,
            'security_event_type' => $eventType,
            'details' => $details,
            'timestamp' => time(),
            'severity' => $details['severity'] ?? 'medium',
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ];

        $this->logger->warning('Security Event', $logEntry);

        // Alert on critical security events
        if (($details['severity'] ?? 'medium') === 'critical') {
            $this->alertSecurityTeam($logEntry);
        }
    }

    public function logDataAccess(string $agentId, string $dataType, string $operation, array $metadata = []): void
    {
        $logEntry = [
            'event_type' => 'data_access',
            'agent_id' => $agentId,
            'data_type' => $dataType,
            'operation' => $operation,
            'metadata' => $metadata,
            'timestamp' => time(),
        ];

        $this->logger->info('Data Access', $logEntry);
    }

    private function sanitizeContext(array $context): array
    {
        $sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];

        foreach ($sensitiveKeys as $key) {
            if (isset($context[$key])) {
                $context[$key] = '[REDACTED]';
            }
        }

        return $context;
    }

    private function sanitizeParameters(array $params): array
    {
        // Remove or mask sensitive parameters
        $sanitized = [];

        foreach ($params as $key => $value) {
            if (is_string($value) && strlen($value) > 1000) {
                $sanitized[$key] = substr($value, 0, 100) . '... [TRUNCATED]';
            } elseif (in_array(strtolower($key), ['password', 'secret', 'token'])) {
                $sanitized[$key] = '[REDACTED]';
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    private function summarizeResult(array $result): array
    {
        return [
            'success' => $result['success'] ?? true,
            'error' => $result['error'] ?? null,
            'data_size' => isset($result['data']) ? strlen(json_encode($result['data'])) : 0,
            'execution_time' => $result['execution_time'] ?? null,
        ];
    }

    private function alertSecurityTeam(array $logEntry): void
    {
        // Implementation for alerting security team
        // This could send emails, Slack messages, etc.
        error_log('CRITICAL SECURITY EVENT: ' . json_encode($logEntry));
    }
}
```

## Rate Limiting for AI

### AI-Specific Rate Limiting

```php
<?php
// src/AgenticAI/Security/AiRateLimiter.php

class AiRateLimiter extends RateLimiter
{
    private array $agentLimits = [];
    private array $toolLimits = [];

    public function setAgentLimit(string $agentId, int $requestsPerMinute, int $tokensPerHour = null): void
    {
        $this->agentLimits[$agentId] = [
            'requests_per_minute' => $requestsPerMinute,
            'tokens_per_hour' => $tokensPerHour,
        ];
    }

    public function setToolLimit(string $toolName, int $executionsPerMinute, int $costLimit = null): void
    {
        $this->toolLimits[$toolName] = [
            'executions_per_minute' => $executionsPerMinute,
            'cost_limit' => $costLimit,
        ];
    }

    public function checkAgentLimit(string $agentId, int $tokenCount = 0): bool
    {
        if (!isset($this->agentLimits[$agentId])) {
            return parent::isAllowed($agentId);
        }

        $limits = $this->agentLimits[$agentId];

        // Check request rate limit
        $requestKey = "agent_requests:{$agentId}";
        if (!$this->checkRateLimit($requestKey, $limits['requests_per_minute'], 60)) {
            return false;
        }

        // Check token limit if specified
        if ($limits['tokens_per_hour'] !== null && $tokenCount > 0) {
            $tokenKey = "agent_tokens:{$agentId}";
            if (!$this->checkTokenLimit($tokenKey, $tokenCount, $limits['tokens_per_hour'], 3600)) {
                return false;
            }
        }

        return true;
    }

    public function checkToolLimit(string $agentId, string $toolName, float $cost = 0): bool
    {
        if (!isset($this->toolLimits[$toolName])) {
            return true;
        }

        $limits = $this->toolLimits[$toolName];

        // Check execution rate limit
        $executionKey = "tool_executions:{$agentId}:{$toolName}";
        if (!$this->checkRateLimit($executionKey, $limits['executions_per_minute'], 60)) {
            return false;
        }

        // Check cost limit if specified
        if ($limits['cost_limit'] !== null && $cost > 0) {
            $costKey = "tool_cost:{$agentId}:{$toolName}";
            if (!$this->checkCostLimit($costKey, $cost, $limits['cost_limit'], 3600)) {
                return false;
            }
        }

        return true;
    }

    private function checkRateLimit(string $key, int $limit, int $window): bool
    {
        $current = $this->redis->incr($key);

        if ($current === 1) {
            $this->redis->expire($key, $window);
        }

        return $current <= $limit;
    }

    private function checkTokenLimit(string $key, int $tokens, int $limit, int $window): bool
    {
        $current = $this->redis->incrBy($key, $tokens);

        if ($current === $tokens) {
            $this->redis->expire($key, $window);
        }

        return $current <= $limit;
    }

    private function checkCostLimit(string $key, float $cost, float $limit, int $window): bool
    {
        $current = $this->redis->incrByFloat($key, $cost);

        if (abs($current - $cost) < 0.01) { // First increment
            $this->redis->expire($key, $window);
        }

        return $current <= $limit;
    }
}
```

## Security Best Practices for AI Agents

### 1. Agent Identity & Authentication

- Unique agent identities with strong authentication
- Capability-based access control
- Regular token rotation
- Agent behavior monitoring

### 2. Input Validation & Sanitization

- AI-specific input validation patterns
- Prompt injection prevention
- Content filtering and moderation
- Input length and complexity limits

### 3. Execution Environment Security

- Sandboxed execution environments
- Resource limits (memory, CPU, time)
- Function whitelisting/blacklisting
- Network access restrictions

### 4. Data Protection

- Encryption of sensitive data
- Secure data handling practices
- Data minimization principles
- Privacy-preserving techniques

### 5. Monitoring & Auditing

- Comprehensive audit logging
- Real-time security monitoring
- Anomaly detection
- Incident response procedures

## Next Steps

- [Performance Optimization](performance) - AI performance considerations
- [Multi-Agent Systems](multi-agent) - Security in multi-agent environments
- [Best Practices](best-practices) - General AI development best practices

Secure your AI agents with comprehensive security measures! 🔒

