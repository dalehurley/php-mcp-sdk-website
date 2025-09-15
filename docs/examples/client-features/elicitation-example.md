# Elicitation (User Input) Example

Complete example demonstrating user input elicitation in MCP clients with schema validation, multiple interface types, and security considerations.

## Overview

This example shows how to implement a comprehensive elicitation system that:

- Collects structured user input with JSON schema validation
- Supports multiple interface types (CLI, web, GUI)
- Implements security and privacy protections
- Handles all user response actions (accept/decline/cancel)

## Complete Implementation

```php
#!/usr/bin/env php
<?php

/**
 * Elicitation (User Input) Example
 *
 * Demonstrates comprehensive user input collection including:
 * - Schema-based form generation
 * - Multiple interface types
 * - Security and privacy protection
 * - Complete user interaction flows
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use function Amp\async;

class InteractiveElicitationClient extends Client
{
    private UserInterface $ui;
    private ElicitationValidator $validator;
    private SecurityManager $security;
    private array $elicitationHistory = [];

    public function __construct(UserInterface $ui)
    {
        parent::__construct(
            new Implementation('interactive-client', '1.0.0'),
            [
                'capabilities' => [
                    'elicitation' => [
                        'supportsCancel' => true,
                        'supportsDecline' => true
                    ]
                ]
            ]
        );

        $this->ui = $ui;
        $this->validator = new ElicitationValidator();
        $this->security = new SecurityManager();

        $this->setElicitationHandler([$this, 'handleElicitationRequest']);
    }

    public function handleElicitationRequest(array $request): array
    {
        try {
            echo "📝 Elicitation request received\n";

            $message = $request['message'] ?? 'Please provide the requested information';
            $schema = $request['requestedSchema'] ?? ['type' => 'object'];

            // Security check
            $securityCheck = $this->security->validateElicitationRequest($request);

            if (!$securityCheck->allowed) {
                echo "🛡️ Request blocked for security reasons: {$securityCheck->reason}\n";
                return ['action' => 'decline'];
            }

            // Show request to user
            echo "💬 Server message: {$message}\n";

            $userResponse = $this->ui->collectUserInput($message, $schema);

            // Record elicitation in history
            $this->recordElicitation($request, $userResponse);

            return $this->processUserResponse($userResponse, $schema);

        } catch (\Exception $e) {
            echo "❌ Elicitation error: {$e->getMessage()}\n";

            return [
                'action' => 'cancel',
                'error' => $e->getMessage()
            ];
        }
    }

    private function processUserResponse(array $userResponse, array $schema): array
    {
        $action = $userResponse['action'];

        if ($action === 'accept') {
            // Validate user input
            $validation = $this->validator->validate($userResponse['content'] ?? [], $schema);

            if (!$validation->isValid) {
                echo "⚠️ Validation failed: " . implode(', ', $validation->errors) . "\n";

                // Ask user if they want to try again
                $retry = $this->ui->askRetry($validation->errors);

                if ($retry) {
                    // Re-collect input (simplified for example)
                    return ['action' => 'cancel']; // In real implementation, would retry
                }

                return ['action' => 'cancel'];
            }

            echo "✅ Input validated successfully\n";

            return [
                'action' => 'accept',
                'content' => $userResponse['content']
            ];
        }

        echo "ℹ️ User {$action}d the request\n";

        return ['action' => $action];
    }

    private function recordElicitation(array $request, array $response): void
    {
        $this->elicitationHistory[] = [
            'timestamp' => time(),
            'message' => $request['message'] ?? '',
            'schema' => $request['requestedSchema'] ?? [],
            'action' => $response['action'],
            'server_id' => $this->getCurrentServerId()
        ];
    }

    public function getElicitationHistory(): array
    {
        return $this->elicitationHistory;
    }
}

// Command-line user interface
class CliUserInterface implements UserInterface
{
    public function collectUserInput(string $message, array $schema): array
    {
        echo "\n" . str_repeat("=", 50) . "\n";
        echo "📋 Information Request\n";
        echo str_repeat("=", 50) . "\n";
        echo "Message: {$message}\n\n";

        if ($schema['type'] === 'object') {
            echo "Required information:\n";
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $title = $propSchema['title'] ?? ucfirst(str_replace('_', ' ', $propName));
                $description = $propSchema['description'] ?? '';
                $required = in_array($propName, $schema['required'] ?? []);

                echo "  - {$title}" . ($required ? ' (required)' : ' (optional)');
                if ($description) {
                    echo ": {$description}";
                }
                echo "\n";
            }
        }

        echo "\nOptions:\n";
        echo "  (a)ccept - Provide the requested information\n";
        echo "  (d)ecline - Decline to provide information\n";
        echo "  (c)ancel - Cancel the request\n";

        while (true) {
            echo "\nYour choice (a/d/c): ";
            $choice = strtolower(trim(fgets(STDIN)));

            if ($choice === 'a' || $choice === 'accept') {
                $content = $this->collectSchemaInput($schema);
                return ['action' => 'accept', 'content' => $content];
            } elseif ($choice === 'd' || $choice === 'decline') {
                return ['action' => 'decline'];
            } elseif ($choice === 'c' || $choice === 'cancel') {
                return ['action' => 'cancel'];
            }

            echo "Invalid choice. Please enter 'a', 'd', or 'c'.\n";
        }
    }

    private function collectSchemaInput(array $schema): array
    {
        $content = [];

        if ($schema['type'] !== 'object') {
            return $content;
        }

        echo "\n📝 Please provide the following information:\n";
        echo str_repeat("-", 40) . "\n";

        foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
            $value = $this->collectFieldInput($propName, $propSchema, $schema['required'] ?? []);

            if ($value !== null) {
                $content[$propName] = $value;
            }
        }

        return $content;
    }

    private function collectFieldInput(string $fieldName, array $fieldSchema, array $required): mixed
    {
        $title = $fieldSchema['title'] ?? ucfirst(str_replace('_', ' ', $fieldName));
        $description = $fieldSchema['description'] ?? '';
        $type = $fieldSchema['type'] ?? 'string';
        $isRequired = in_array($fieldName, $required);

        while (true) {
            echo "\n{$title}" . ($isRequired ? ' (required)' : ' (optional)');
            if ($description) {
                echo "\n  {$description}";
            }

            // Show options for enum fields
            if (isset($fieldSchema['enum'])) {
                $options = $fieldSchema['enum'];
                $optionNames = $fieldSchema['enumNames'] ?? $options;

                echo "\n  Options:";
                foreach ($options as $i => $option) {
                    $name = $optionNames[$i] ?? $option;
                    echo "\n    {$option} - {$name}";
                }
            }

            // Show constraints
            if ($type === 'integer' || $type === 'number') {
                $min = $fieldSchema['minimum'] ?? null;
                $max = $fieldSchema['maximum'] ?? null;
                if ($min !== null || $max !== null) {
                    echo "\n  Range: " . ($min ?? 'no min') . " to " . ($max ?? 'no max');
                }
            }

            if ($type === 'string') {
                $minLen = $fieldSchema['minLength'] ?? null;
                $maxLen = $fieldSchema['maxLength'] ?? null;
                if ($minLen !== null || $maxLen !== null) {
                    echo "\n  Length: " . ($minLen ?? 'no min') . " to " . ($maxLen ?? 'no max') . " characters";
                }
            }

            echo "\n> ";
            $input = trim(fgets(STDIN));

            // Handle empty input
            if (empty($input)) {
                if ($isRequired) {
                    echo "This field is required. Please provide a value.";
                    continue;
                }
                return null;
            }

            // Validate and convert input
            $validation = $this->validateFieldInput($input, $fieldSchema);

            if ($validation->isValid) {
                return $this->convertInputType($input, $type);
            }

            echo "Invalid input: " . implode(', ', $validation->errors) . "\n";
            echo "Please try again.";
        }
    }

    private function validateFieldInput(string $input, array $schema): ValidationResult
    {
        $errors = [];
        $type = $schema['type'] ?? 'string';

        // Type validation
        if ($type === 'integer' && !ctype_digit($input)) {
            $errors[] = 'Must be an integer';
        } elseif ($type === 'number' && !is_numeric($input)) {
            $errors[] = 'Must be a number';
        } elseif ($type === 'boolean' && !in_array(strtolower($input), ['true', 'false', '1', '0', 'yes', 'no'])) {
            $errors[] = 'Must be true/false, yes/no, or 1/0';
        }

        // Enum validation
        if (isset($schema['enum']) && !in_array($input, $schema['enum'])) {
            $errors[] = 'Must be one of: ' . implode(', ', $schema['enum']);
        }

        // String constraints
        if ($type === 'string') {
            if (isset($schema['minLength']) && strlen($input) < $schema['minLength']) {
                $errors[] = "Must be at least {$schema['minLength']} characters";
            }
            if (isset($schema['maxLength']) && strlen($input) > $schema['maxLength']) {
                $errors[] = "Must be no more than {$schema['maxLength']} characters";
            }
            if (isset($schema['pattern']) && !preg_match('/' . $schema['pattern'] . '/', $input)) {
                $errors[] = 'Does not match required pattern';
            }
        }

        // Number constraints
        if ($type === 'integer' || $type === 'number') {
            $numValue = (float)$input;
            if (isset($schema['minimum']) && $numValue < $schema['minimum']) {
                $errors[] = "Must be at least {$schema['minimum']}";
            }
            if (isset($schema['maximum']) && $numValue > $schema['maximum']) {
                $errors[] = "Must be no more than {$schema['maximum']}";
            }
        }

        return new ValidationResult(empty($errors), $errors);
    }

    private function convertInputType(string $input, string $type): mixed
    {
        return match($type) {
            'integer' => (int)$input,
            'number' => (float)$input,
            'boolean' => in_array(strtolower($input), ['true', '1', 'yes']),
            default => $input
        };
    }

    public function askRetry(array $errors): bool
    {
        echo "\nValidation errors occurred:\n";
        foreach ($errors as $error) {
            echo "  - {$error}\n";
        }

        echo "\nWould you like to try again? (y/n): ";
        $response = strtolower(trim(fgets(STDIN)));

        return in_array($response, ['y', 'yes']);
    }
}

// Security manager for elicitation
class SecurityManager
{
    private array $sensitiveFields = [
        'password', 'token', 'secret', 'key', 'credential',
        'ssn', 'social_security', 'passport', 'license'
    ];
    private array $requestCounts = [];
    private int $maxRequestsPerHour = 10;

    public function validateElicitationRequest(array $request): SecurityCheckResult
    {
        // Check for sensitive fields
        if ($this->containsSensitiveFields($request['requestedSchema'] ?? [])) {
            return new SecurityCheckResult(
                false,
                'Request contains sensitive fields that cannot be collected'
            );
        }

        // Check rate limiting
        $serverId = $this->extractServerId($request);
        if (!$this->isRateLimitOk($serverId)) {
            return new SecurityCheckResult(
                false,
                'Rate limit exceeded for this server'
            );
        }

        // Check message content for suspicious patterns
        $message = $request['message'] ?? '';
        if ($this->containsSuspiciousContent($message)) {
            return new SecurityCheckResult(
                false,
                'Request message contains suspicious content'
            );
        }

        $this->recordRequest($serverId);

        return new SecurityCheckResult(true, 'Request approved');
    }

    private function containsSensitiveFields(array $schema): bool
    {
        if ($schema['type'] === 'object') {
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $lowerName = strtolower($propName);
                $title = strtolower($propSchema['title'] ?? '');
                $description = strtolower($propSchema['description'] ?? '');

                foreach ($this->sensitiveFields as $sensitiveField) {
                    if (strpos($lowerName, $sensitiveField) !== false ||
                        strpos($title, $sensitiveField) !== false ||
                        strpos($description, $sensitiveField) !== false) {
                        return true;
                    }
                }

                // Check nested objects
                if ($propSchema['type'] === 'object') {
                    if ($this->containsSensitiveFields($propSchema)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private function containsSuspiciousContent(string $message): bool
    {
        $suspiciousPatterns = [
            '/password/i',
            '/credit\s*card/i',
            '/ssn|social\s*security/i',
            '/bank\s*account/i',
            '/personal\s*identification/i'
        ];

        foreach ($suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $message)) {
                return true;
            }
        }

        return false;
    }

    private function isRateLimitOk(string $serverId): bool
    {
        $now = time();
        $hourAgo = $now - 3600;

        // Clean old requests
        if (isset($this->requestCounts[$serverId])) {
            $this->requestCounts[$serverId] = array_filter(
                $this->requestCounts[$serverId],
                fn($timestamp) => $timestamp > $hourAgo
            );
        }

        $currentCount = count($this->requestCounts[$serverId] ?? []);

        return $currentCount < $this->maxRequestsPerHour;
    }

    private function recordRequest(string $serverId): void
    {
        if (!isset($this->requestCounts[$serverId])) {
            $this->requestCounts[$serverId] = [];
        }

        $this->requestCounts[$serverId][] = time();
    }

    private function extractServerId(array $request): string
    {
        // Extract server ID from request context
        return $request['server_id'] ?? 'unknown';
    }
}

// Validation system
class ElicitationValidator
{
    public function validate(array $data, array $schema): ValidationResult
    {
        $errors = [];

        if ($schema['type'] === 'object') {
            // Check required fields
            foreach ($schema['required'] ?? [] as $requiredField) {
                if (!isset($data[$requiredField]) || $data[$requiredField] === '') {
                    $errors[] = "Field '{$requiredField}' is required";
                }
            }

            // Validate each field
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                if (isset($data[$propName])) {
                    $fieldErrors = $this->validateField($data[$propName], $propSchema, $propName);
                    $errors = array_merge($errors, $fieldErrors);
                }
            }
        }

        return new ValidationResult(empty($errors), $errors);
    }

    private function validateField(mixed $value, array $schema, string $fieldName): array
    {
        $errors = [];
        $type = $schema['type'] ?? 'string';

        // Type validation
        if (!$this->isCorrectType($value, $type)) {
            $errors[] = "Field '{$fieldName}' must be of type {$type}";
            return $errors; // Don't continue if type is wrong
        }

        // Type-specific validation
        if ($type === 'string') {
            $errors = array_merge($errors, $this->validateString($value, $schema, $fieldName));
        } elseif ($type === 'integer' || $type === 'number') {
            $errors = array_merge($errors, $this->validateNumber($value, $schema, $fieldName));
        } elseif ($type === 'array') {
            $errors = array_merge($errors, $this->validateArray($value, $schema, $fieldName));
        }

        return $errors;
    }

    private function isCorrectType(mixed $value, string $expectedType): bool
    {
        return match($expectedType) {
            'string' => is_string($value),
            'integer' => is_int($value),
            'number' => is_numeric($value),
            'boolean' => is_bool($value),
            'array' => is_array($value),
            default => true
        };
    }

    private function validateString(string $value, array $schema, string $fieldName): array
    {
        $errors = [];

        if (isset($schema['minLength']) && strlen($value) < $schema['minLength']) {
            $errors[] = "Field '{$fieldName}' must be at least {$schema['minLength']} characters";
        }

        if (isset($schema['maxLength']) && strlen($value) > $schema['maxLength']) {
            $errors[] = "Field '{$fieldName}' must be no more than {$schema['maxLength']} characters";
        }

        if (isset($schema['pattern']) && !preg_match('/' . $schema['pattern'] . '/', $value)) {
            $errors[] = "Field '{$fieldName}' does not match required pattern";
        }

        if (isset($schema['enum']) && !in_array($value, $schema['enum'])) {
            $errors[] = "Field '{$fieldName}' must be one of: " . implode(', ', $schema['enum']);
        }

        if (isset($schema['format'])) {
            $formatErrors = $this->validateFormat($value, $schema['format'], $fieldName);
            $errors = array_merge($errors, $formatErrors);
        }

        return $errors;
    }

    private function validateFormat(string $value, string $format, string $fieldName): array
    {
        $errors = [];

        switch ($format) {
            case 'email':
                if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = "Field '{$fieldName}' must be a valid email address";
                }
                break;
            case 'uri':
                if (!filter_var($value, FILTER_VALIDATE_URL)) {
                    $errors[] = "Field '{$fieldName}' must be a valid URL";
                }
                break;
            case 'date':
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !strtotime($value)) {
                    $errors[] = "Field '{$fieldName}' must be a valid date in YYYY-MM-DD format";
                }
                break;
        }

        return $errors;
    }
}

// Demo server that uses elicitation
class ElicitationDemoServer
{
    private McpServer $server;
    private InteractiveElicitationClient $elicitationClient;

    public function __construct(InteractiveElicitationClient $elicitationClient)
    {
        $this->server = new McpServer(
            new Implementation('elicitation-demo-server', '1.0.0')
        );
        $this->elicitationClient = $elicitationClient;

        $this->registerElicitationTools();
    }

    private function registerElicitationTools(): void
    {
        $this->server->tool(
            'setup_user_profile',
            'Interactive user profile setup',
            ['type' => 'object'],
            function (): array {
                $result = $this->elicitationClient->requestElicitation([
                    'message' => 'Please set up your user profile to personalize your experience:',
                    'requestedSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'display_name' => [
                                'type' => 'string',
                                'title' => 'Display Name',
                                'description' => 'How you\'d like to be addressed',
                                'minLength' => 1,
                                'maxLength' => 50
                            ],
                            'email' => [
                                'type' => 'string',
                                'title' => 'Email Address',
                                'description' => 'Your email for notifications',
                                'format' => 'email'
                            ],
                            'role' => [
                                'type' => 'string',
                                'title' => 'Professional Role',
                                'enum' => ['developer', 'designer', 'manager', 'analyst', 'student', 'other'],
                                'enumNames' => ['Developer', 'Designer', 'Manager', 'Analyst', 'Student', 'Other']
                            ],
                            'experience_years' => [
                                'type' => 'integer',
                                'title' => 'Years of Experience',
                                'description' => 'Years of professional experience',
                                'minimum' => 0,
                                'maximum' => 50
                            ],
                            'interests' => [
                                'type' => 'array',
                                'title' => 'Areas of Interest',
                                'items' => ['type' => 'string'],
                                'description' => 'Technologies or topics you\'re interested in'
                            ],
                            'notifications' => [
                                'type' => 'boolean',
                                'title' => 'Enable Notifications',
                                'description' => 'Receive email notifications for important updates',
                                'default' => true
                            ]
                        ],
                        'required' => ['display_name', 'email', 'role']
                    ]
                ])->await();

                if ($result['action'] === 'accept') {
                    $profile = $result['content'];

                    // Save profile (in real implementation)
                    $this->saveUserProfile($profile);

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => "Profile created successfully for {$profile['display_name']}!\n\n" .
                                     "Summary:\n" .
                                     "- Email: {$profile['email']}\n" .
                                     "- Role: {$profile['role']}\n" .
                                     "- Experience: {$profile['experience_years']} years\n" .
                                     "- Notifications: " . ($profile['notifications'] ? 'enabled' : 'disabled')
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Profile setup was {$result['action']}led by user"
                    ]]
                ];
            }
        );

        $this->server->tool(
            'collect_feedback',
            'Collect user feedback with structured questions',
            [
                'type' => 'object',
                'properties' => [
                    'feature' => [
                        'type' => 'string',
                        'description' => 'Feature to collect feedback about'
                    ]
                ]
            ],
            function (array $params): array {
                $feature = $params['feature'] ?? 'general';

                $result = $this->elicitationClient->requestElicitation([
                    'message' => "Please provide feedback about: {$feature}",
                    'requestedSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'rating' => [
                                'type' => 'integer',
                                'title' => 'Overall Rating',
                                'description' => 'Rate from 1 (poor) to 5 (excellent)',
                                'minimum' => 1,
                                'maximum' => 5
                            ],
                            'liked' => [
                                'type' => 'string',
                                'title' => 'What did you like?',
                                'description' => 'What worked well for you',
                                'maxLength' => 500
                            ],
                            'disliked' => [
                                'type' => 'string',
                                'title' => 'What could be improved?',
                                'description' => 'Areas for improvement',
                                'maxLength' => 500
                            ],
                            'would_recommend' => [
                                'type' => 'boolean',
                                'title' => 'Would you recommend this to others?',
                                'default' => true
                            ]
                        ],
                        'required' => ['rating']
                    ]
                ])->await();

                if ($result['action'] === 'accept') {
                    $feedback = $result['content'];

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => "Thank you for your feedback!\n\n" .
                                     "Rating: {$feedback['rating']}/5 stars\n" .
                                     "Recommendation: " . ($feedback['would_recommend'] ? 'Yes' : 'No') . "\n" .
                                     "Your feedback has been recorded and will help us improve."
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Feedback collection was {$result['action']}led"
                    ]]
                ];
            }
        );
    }

    private function saveUserProfile(array $profile): void
    {
        // In a real implementation, save to database
        echo "💾 Saving user profile: {$profile['display_name']}\n";
    }

    public function start(): void
    {
        async(function () {
            echo "🔧 Interactive Elicitation Demo Server starting...\n";
            echo "This server demonstrates user input collection capabilities.\n\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Supporting classes
class ValidationResult
{
    public function __construct(
        public readonly bool $isValid,
        public readonly array $errors = []
    ) {}
}

class SecurityCheckResult
{
    public function __construct(
        public readonly bool $allowed,
        public readonly string $reason
    ) {}
}

interface UserInterface
{
    public function collectUserInput(string $message, array $schema): array;
    public function askRetry(array $errors): bool;
}

// Usage example
echo "🚀 Interactive Elicitation Client Demo\n";
echo "=====================================\n";

// Create client with CLI interface
$ui = new CliUserInterface();
$client = new InteractiveElicitationClient($ui);

// Create demo server
$demoServer = new ElicitationDemoServer($client);

echo "📋 Available tools:\n";
echo "  - setup_user_profile: Interactive profile setup\n";
echo "  - collect_feedback: Structured feedback collection\n\n";

echo "🎯 Starting demo server...\n";
echo "Connect with an MCP client and try the interactive tools!\n\n";

$demoServer->start();
```

## Web Interface Example

### HTML Form Generation

```php
class WebElicitationInterface implements UserInterface
{
    private string $sessionId;

    public function collectUserInput(string $message, array $schema): array
    {
        // Generate HTML form from schema
        $formHtml = $this->generateFormHtml($message, $schema);

        // Send to web interface (WebSocket, HTTP, etc.)
        $this->sendToWebInterface([
            'type' => 'elicitation_form',
            'message' => $message,
            'form_html' => $formHtml,
            'schema' => $schema
        ]);

        // Wait for user response
        return $this->waitForWebResponse();
    }

    private function generateFormHtml(string $message, array $schema): string
    {
        $html = "<div class='elicitation-form'>\n";
        $html .= "<h3>Information Required</h3>\n";
        $html .= "<p class='message'>" . htmlspecialchars($message) . "</p>\n";
        $html .= "<form id='elicitation-form'>\n";

        if ($schema['type'] === 'object') {
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $html .= $this->generateFieldHtml($propName, $propSchema, $schema['required'] ?? []);
            }
        }

        $html .= "<div class='form-actions'>\n";
        $html .= "<button type='submit' class='btn btn-primary'>Submit</button>\n";
        $html .= "<button type='button' class='btn btn-secondary' onclick='declineRequest()'>Decline</button>\n";
        $html .= "<button type='button' class='btn btn-outline' onclick='cancelRequest()'>Cancel</button>\n";
        $html .= "</div>\n";
        $html .= "</form>\n";
        $html .= "</div>\n";

        return $html;
    }

    private function generateFieldHtml(string $fieldName, array $fieldSchema, array $required): string
    {
        $type = $fieldSchema['type'] ?? 'string';
        $title = $fieldSchema['title'] ?? ucfirst(str_replace('_', ' ', $fieldName));
        $description = $fieldSchema['description'] ?? '';
        $isRequired = in_array($fieldName, $required);

        $html = "<div class='form-field'>\n";
        $html .= "<label for='{$fieldName}'>{$title}" . ($isRequired ? ' *' : '') . "</label>\n";

        if ($description) {
            $html .= "<p class='field-description'>{$description}</p>\n";
        }

        $html .= $this->generateInputHtml($fieldName, $fieldSchema) . "\n";
        $html .= "</div>\n";

        return $html;
    }

    private function generateInputHtml(string $fieldName, array $fieldSchema): string
    {
        $type = $fieldSchema['type'] ?? 'string';

        return match($type) {
            'string' => $this->generateStringInput($fieldName, $fieldSchema),
            'integer', 'number' => $this->generateNumberInput($fieldName, $fieldSchema),
            'boolean' => $this->generateBooleanInput($fieldName, $fieldSchema),
            'array' => $this->generateArrayInput($fieldName, $fieldSchema),
            default => "<input type='text' name='{$fieldName}' id='{$fieldName}'>"
        };
    }

    private function generateStringInput(string $fieldName, array $fieldSchema): string
    {
        if (isset($fieldSchema['enum'])) {
            $html = "<select name='{$fieldName}' id='{$fieldName}'>\n";

            $options = $fieldSchema['enum'];
            $optionNames = $fieldSchema['enumNames'] ?? $options;

            foreach ($options as $index => $value) {
                $label = $optionNames[$index] ?? $value;
                $html .= "<option value='{$value}'>{$label}</option>\n";
            }

            $html .= "</select>";
            return $html;
        }

        $attributes = [
            'type' => 'text',
            'name' => $fieldName,
            'id' => $fieldName
        ];

        if (isset($fieldSchema['minLength'])) {
            $attributes['minlength'] = $fieldSchema['minLength'];
        }

        if (isset($fieldSchema['maxLength'])) {
            $attributes['maxlength'] = $fieldSchema['maxLength'];
        }

        if (isset($fieldSchema['pattern'])) {
            $attributes['pattern'] = $fieldSchema['pattern'];
        }

        $attrString = implode(' ', array_map(
            fn($k, $v) => "{$k}='{$v}'",
            array_keys($attributes),
            $attributes
        ));

        return "<input {$attrString}>";
    }

    private function generateNumberInput(string $fieldName, array $fieldSchema): string
    {
        $inputType = $fieldSchema['type'] === 'integer' ? 'number' : 'number';

        $attributes = [
            'type' => $inputType,
            'name' => $fieldName,
            'id' => $fieldName
        ];

        if (isset($fieldSchema['minimum'])) {
            $attributes['min'] = $fieldSchema['minimum'];
        }

        if (isset($fieldSchema['maximum'])) {
            $attributes['max'] = $fieldSchema['maximum'];
        }

        if ($fieldSchema['type'] === 'number' && !isset($attributes['step'])) {
            $attributes['step'] = 'any';
        }

        $attrString = implode(' ', array_map(
            fn($k, $v) => "{$k}='{$v}'",
            array_keys($attributes),
            $attributes
        ));

        return "<input {$attrString}>";
    }

    private function generateBooleanInput(string $fieldName, array $fieldSchema): string
    {
        $default = $fieldSchema['default'] ?? false;
        $checked = $default ? 'checked' : '';

        return "<input type='checkbox' name='{$fieldName}' id='{$fieldName}' {$checked}>";
    }
}

// Usage demonstration
echo "🎯 Starting elicitation demonstration...\n";

$client = new InteractiveElicitationClient(new CliUserInterface());
$server = new ElicitationDemoServer($client);

echo "Try these commands:\n";
echo "  - setup_user_profile: Interactive profile creation\n";
echo "  - collect_feedback: Structured feedback collection\n\n";

$server->start();
```

## Key Features Demonstrated

### 1. Schema-Based Input Collection

- **Dynamic Form Generation**: Creates appropriate inputs based on JSON schema
- **Type Validation**: Validates input types (string, integer, boolean, array)
- **Constraint Checking**: Enforces length limits, ranges, patterns
- **Format Validation**: Validates emails, URLs, dates

### 2. Security and Privacy

- **Sensitive Field Detection**: Prevents collection of passwords, tokens, etc.
- **Rate Limiting**: Limits elicitation requests per server per hour
- **Content Filtering**: Blocks suspicious request messages
- **User Consent**: Always requires explicit user action

### 3. User Experience

- **Clear Messaging**: Explains what information is needed and why
- **Progressive Disclosure**: Shows field descriptions and constraints
- **Error Feedback**: Provides specific validation error messages
- **Multiple Actions**: Supports accept, decline, and cancel actions

### 4. Multiple Interface Types

- **Command Line**: Interactive CLI with prompts and validation
- **Web Interface**: HTML form generation with JavaScript handling
- **GUI Support**: Framework for desktop application interfaces

## Testing

### Elicitation Testing

```php
class ElicitationExampleTest extends TestCase
{
    private InteractiveElicitationClient $client;
    private MockUserInterface $mockUI;

    protected function setUp(): void
    {
        $this->mockUI = new MockUserInterface();
        $this->client = new InteractiveElicitationClient($this->mockUI);
    }

    public function testUserAcceptance(): void
    {
        $this->mockUI->setResponse([
            'action' => 'accept',
            'content' => [
                'username' => 'testuser',
                'email' => 'test@example.com'
            ]
        ]);

        $result = $this->client->handleElicitationRequest([
            'message' => 'Enter your details',
            'requestedSchema' => [
                'type' => 'object',
                'properties' => [
                    'username' => ['type' => 'string'],
                    'email' => ['type' => 'string', 'format' => 'email']
                ],
                'required' => ['username', 'email']
            ]
        ]);

        $this->assertEquals('accept', $result['action']);
        $this->assertEquals('testuser', $result['content']['username']);
    }

    public function testSecurityBlocking(): void
    {
        $result = $this->client->handleElicitationRequest([
            'message' => 'Enter your password',
            'requestedSchema' => [
                'type' => 'object',
                'properties' => [
                    'password' => ['type' => 'string']
                ]
            ]
        ]);

        $this->assertEquals('decline', $result['action']);
    }
}
```

## See Also

- [MCP Elicitation Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)
- [User Interface Examples](../interactive/)
- [Elicitation Guide](../../guide/elicitation)
- [Security Best Practices](../../guide/security)
