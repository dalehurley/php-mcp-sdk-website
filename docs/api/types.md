# Types & Schemas Reference

Complete reference for all type definitions, validation schemas, and data structures used in the PHP MCP SDK.

## Core Types

### Implementation

Represents server or client implementation information.

```php
class Implementation
{
    public function __construct(
        public readonly string $name,
        public readonly string $version,
        public readonly ?string $description = null
    ) {}
}
```

**Usage:**

```php
$implementation = new Implementation(
    'my-server',
    '1.0.0',
    'My MCP Server Description'
);
```

### McpError

Standard error type for MCP operations.

```php
class McpError extends \Exception
{
    public function __construct(
        public readonly ErrorCode $code,
        string $message,
        public readonly mixed $data = null,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code->value, $previous);
    }
}
```

**Usage:**

```php
throw new McpError(
    ErrorCode::InvalidParams,
    'Invalid parameter value',
    ['parameter' => 'email', 'value' => 'invalid-email']
);
```

### ErrorCode

Enumeration of standard MCP error codes.

```php
enum ErrorCode: int
{
    // Standard JSON-RPC errors
    case ParseError = -32700;
    case InvalidRequest = -32600;
    case MethodNotFound = -32601;
    case InvalidParams = -32602;
    case InternalError = -32603;

    // MCP-specific errors
    case ConnectionClosed = -32000;
    case RequestTimeout = -32001;
    case Unauthorized = -32002;
    case Forbidden = -32003;
    case ResourceNotFound = -32004;
    case ToolNotFound = -32005;
    case PromptNotFound = -32006;
}
```

## Tool Types

### ToolDefinition

Defines a tool that can be called by clients.

```php
class ToolDefinition
{
    public function __construct(
        public readonly string $name,
        public readonly string $description,
        public readonly array $inputSchema,
        public readonly callable $handler
    ) {}
}
```

**Input Schema Format:**

```php
$inputSchema = [
    'type' => 'object',
    'properties' => [
        'param1' => [
            'type' => 'string',
            'description' => 'First parameter',
            'minLength' => 1,
            'maxLength' => 100
        ],
        'param2' => [
            'type' => 'integer',
            'description' => 'Second parameter',
            'minimum' => 0,
            'maximum' => 1000
        ],
        'param3' => [
            'type' => 'array',
            'items' => ['type' => 'string'],
            'description' => 'Array of strings'
        ]
    ],
    'required' => ['param1'],
    'additionalProperties' => false
];
```

### ToolResult

Result returned by tool execution.

```php
class ToolResult
{
    public function __construct(
        public readonly array $content,
        public readonly bool $isError = false,
        public readonly ?array $metadata = null
    ) {}
}
```

**Content Format:**

```php
$content = [
    [
        'type' => 'text',
        'text' => 'Tool execution result'
    ],
    [
        'type' => 'image',
        'data' => base64_encode($imageData),
        'mimeType' => 'image/png'
    ]
];
```

## Resource Types

### ResourceDefinition

Defines a resource that can be read by clients.

```php
class ResourceDefinition
{
    public function __construct(
        public readonly string $name,
        public readonly string $uri,
        public readonly string $description,
        public readonly string $mimeType,
        public readonly callable $handler
    ) {}
}
```

### ResourceContent

Content returned when reading a resource.

```php
class ResourceContent
{
    public function __construct(
        public readonly string $uri,
        public readonly string $mimeType,
        public readonly string $text,
        public readonly ?string $blob = null
    ) {}
}
```

**Usage:**

```php
return [
    'contents' => [
        [
            'uri' => 'file:///config.json',
            'mimeType' => 'application/json',
            'text' => json_encode($config, JSON_PRETTY_PRINT)
        ]
    ]
];
```

## Prompt Types

### PromptDefinition

Defines a prompt template.

```php
class PromptDefinition
{
    public function __construct(
        public readonly string $name,
        public readonly string $description,
        public readonly array $arguments,
        public readonly callable $handler
    ) {}
}
```

**Arguments Format:**

```php
$arguments = [
    [
        'name' => 'language',
        'description' => 'Programming language',
        'required' => true
    ],
    [
        'name' => 'complexity',
        'description' => 'Code complexity level',
        'required' => false
    ]
];
```

### PromptResult

Result returned by prompt generation.

```php
class PromptResult
{
    public function __construct(
        public readonly string $description,
        public readonly array $messages
    ) {}
}
```

**Messages Format:**

```php
$messages = [
    [
        'role' => 'system',
        'content' => [
            [
                'type' => 'text',
                'text' => 'System prompt content'
            ]
        ]
    ],
    [
        'role' => 'user',
        'content' => [
            [
                'type' => 'text',
                'text' => 'User message content'
            ]
        ]
    ]
];
```

## Sampling Types

### SamplingRequest

Request for LLM text completion.

```php
class SamplingRequest
{
    public function __construct(
        public readonly array $messages,
        public readonly ?int $maxTokens = null,
        public readonly ?float $temperature = null,
        public readonly ?array $stopSequences = null,
        public readonly ?array $metadata = null
    ) {}
}
```

### SamplingResult

Result from LLM completion.

```php
class SamplingResult
{
    public function __construct(
        public readonly string $completion,
        public readonly string $stopReason,
        public readonly ?array $metadata = null
    ) {}
}
```

## Validation Schemas

### JSON Schema Validation

The SDK uses JSON Schema for input validation:

```php
use Respect\Validation\Validator as v;

// String validation
$schema = [
    'type' => 'string',
    'minLength' => 1,
    'maxLength' => 255,
    'pattern' => '^[a-zA-Z0-9_-]+$'
];

// Number validation
$schema = [
    'type' => 'number',
    'minimum' => 0,
    'maximum' => 100,
    'multipleOf' => 0.5
];

// Array validation
$schema = [
    'type' => 'array',
    'items' => ['type' => 'string'],
    'minItems' => 1,
    'maxItems' => 10,
    'uniqueItems' => true
];

// Object validation
$schema = [
    'type' => 'object',
    'properties' => [
        'name' => ['type' => 'string'],
        'age' => ['type' => 'integer', 'minimum' => 0]
    ],
    'required' => ['name'],
    'additionalProperties' => false
];
```

### Custom Validators

```php
class CustomValidators
{
    public static function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function validateUrl(string $url): bool
    {
        return filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    public static function validatePath(string $path): bool
    {
        return preg_match('/^[a-zA-Z0-9\/\._-]+$/', $path) === 1;
    }

    public static function validateJson(string $json): bool
    {
        json_decode($json);
        return json_last_error() === JSON_ERROR_NONE;
    }
}
```

## Transport Types

### Transport Interface

Base interface for all transport implementations.

```php
interface Transport
{
    public function start(): Promise;
    public function send(array $message): Promise;
    public function close(): Promise;
    public function setMessageHandler(callable $handler): void;
    public function setCloseHandler(callable $handler): void;
    public function setErrorHandler(callable $handler): void;
}
```

### TransportOptions

Configuration options for transport layers.

```php
class StdioTransportOptions
{
    public function __construct(
        public readonly string $command,
        public readonly array $args = [],
        public readonly ?string $cwd = null,
        public readonly ?array $env = null,
        public readonly int $timeout = 30
    ) {}
}

class HttpTransportOptions
{
    public function __construct(
        public readonly string $baseUrl,
        public readonly int $timeout = 30,
        public readonly array $headers = [],
        public readonly bool $ssl = true,
        public readonly ?array $auth = null
    ) {}
}

class WebSocketTransportOptions
{
    public function __construct(
        public readonly string $url,
        public readonly int $timeout = 30,
        public readonly array $headers = [],
        public readonly int $maxFrameSize = 1024 * 1024,
        public readonly bool $enableCompression = true
    ) {}
}
```

## Protocol Message Types

### Request Message

```php
class RequestMessage
{
    public function __construct(
        public readonly string $jsonrpc = '2.0',
        public readonly string $method,
        public readonly mixed $params = null,
        public readonly mixed $id = null
    ) {}
}
```

### Response Message

```php
class ResponseMessage
{
    public function __construct(
        public readonly string $jsonrpc = '2.0',
        public readonly mixed $result = null,
        public readonly ?array $error = null,
        public readonly mixed $id = null
    ) {}
}
```

### Notification Message

```php
class NotificationMessage
{
    public function __construct(
        public readonly string $jsonrpc = '2.0',
        public readonly string $method,
        public readonly mixed $params = null
    ) {}
}
```

## Utility Types

### UriTemplate

For handling URI templates with parameters.

```php
class UriTemplate
{
    public function __construct(
        public readonly string $template
    ) {}

    public function expand(array $variables): string
    {
        $uri = $this->template;

        foreach ($variables as $name => $value) {
            $uri = str_replace("{{$name}}", urlencode($value), $uri);
        }

        return $uri;
    }

    public function extract(string $uri): array
    {
        // Extract variables from URI using template
        $pattern = preg_replace('/\{([^}]+)\}/', '([^/]+)', $this->template);
        $pattern = '#^' . str_replace('/', '\/', $pattern) . '$#';

        if (preg_match($pattern, $uri, $matches)) {
            array_shift($matches); // Remove full match
            return $matches;
        }

        return [];
    }
}
```

### Promise Utilities

```php
class PromiseUtils
{
    public static function timeout(Promise $promise, int $seconds): Promise
    {
        return async(function () use ($promise, $seconds) {
            $cancellation = new TimeoutCancellation($seconds);
            return $promise->await($cancellation);
        });
    }

    public static function retry(callable $operation, int $maxAttempts = 3): Promise
    {
        return async(function () use ($operation, $maxAttempts) {
            $attempt = 0;

            while ($attempt < $maxAttempts) {
                try {
                    return yield $operation();
                } catch (\Exception $e) {
                    $attempt++;

                    if ($attempt >= $maxAttempts) {
                        throw $e;
                    }

                    yield delay(pow(2, $attempt) * 1000); // Exponential backoff
                }
            }
        });
    }
}
```

## Content Types

### Text Content

```php
[
    'type' => 'text',
    'text' => 'Plain text content'
]
```

### Image Content

```php
[
    'type' => 'image',
    'data' => base64_encode($imageData),
    'mimeType' => 'image/png'
]
```

### Resource Content

```php
[
    'type' => 'resource',
    'resource' => [
        'uri' => 'file:///path/to/resource',
        'text' => 'Resource content'
    ]
]
```

## Validation Examples

### Tool Parameter Validation

```php
// Email validation
$emailSchema = [
    'type' => 'string',
    'format' => 'email',
    'description' => 'Valid email address'
];

// URL validation
$urlSchema = [
    'type' => 'string',
    'format' => 'uri',
    'description' => 'Valid URL'
];

// Date validation
$dateSchema = [
    'type' => 'string',
    'format' => 'date',
    'description' => 'Date in YYYY-MM-DD format'
];

// Enum validation
$statusSchema = [
    'type' => 'string',
    'enum' => ['active', 'inactive', 'pending'],
    'description' => 'Status value'
];
```

### Complex Object Validation

```php
$userSchema = [
    'type' => 'object',
    'properties' => [
        'name' => [
            'type' => 'string',
            'minLength' => 1,
            'maxLength' => 100
        ],
        'email' => [
            'type' => 'string',
            'format' => 'email'
        ],
        'age' => [
            'type' => 'integer',
            'minimum' => 0,
            'maximum' => 150
        ],
        'tags' => [
            'type' => 'array',
            'items' => ['type' => 'string'],
            'uniqueItems' => true
        ],
        'preferences' => [
            'type' => 'object',
            'properties' => [
                'theme' => ['type' => 'string', 'enum' => ['light', 'dark']],
                'notifications' => ['type' => 'boolean']
            ],
            'additionalProperties' => false
        ]
    ],
    'required' => ['name', 'email'],
    'additionalProperties' => false
];
```

## Type Guards

### Runtime Type Checking

```php
class TypeGuards
{
    public static function isString(mixed $value): bool
    {
        return is_string($value);
    }

    public static function isInteger(mixed $value): bool
    {
        return is_int($value);
    }

    public static function isArray(mixed $value): bool
    {
        return is_array($value);
    }

    public static function isValidEmail(mixed $value): bool
    {
        return is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function isValidUrl(mixed $value): bool
    {
        return is_string($value) && filter_var($value, FILTER_VALIDATE_URL) !== false;
    }

    public static function isValidJson(mixed $value): bool
    {
        if (!is_string($value)) return false;

        json_decode($value);
        return json_last_error() === JSON_ERROR_NONE;
    }
}
```

### Schema Validation

```php
use Respect\Validation\Validator as v;

class SchemaValidator
{
    public static function validate(array $data, array $schema): bool
    {
        try {
            $validator = self::buildValidator($schema);
            $validator->assert($data);
            return true;
        } catch (\Exception $e) {
            throw new McpError(
                ErrorCode::InvalidParams,
                'Validation failed: ' . $e->getMessage()
            );
        }
    }

    private static function buildValidator(array $schema): v
    {
        $type = $schema['type'] ?? 'mixed';

        return match($type) {
            'string' => self::buildStringValidator($schema),
            'integer' => self::buildIntegerValidator($schema),
            'number' => self::buildNumberValidator($schema),
            'boolean' => v::boolType(),
            'array' => self::buildArrayValidator($schema),
            'object' => self::buildObjectValidator($schema),
            default => v::alwaysValid()
        };
    }

    private static function buildStringValidator(array $schema): v
    {
        $validator = v::stringType();

        if (isset($schema['minLength'])) {
            $validator = $validator->length($schema['minLength'], null);
        }

        if (isset($schema['maxLength'])) {
            $validator = $validator->length(null, $schema['maxLength']);
        }

        if (isset($schema['pattern'])) {
            $validator = $validator->regex($schema['pattern']);
        }

        if (isset($schema['format'])) {
            $validator = match($schema['format']) {
                'email' => $validator->email(),
                'uri' => $validator->url(),
                'date' => $validator->date(),
                default => $validator
            };
        }

        return $validator;
    }
}
```

## Content Type Definitions

### MIME Types

Common MIME types used in MCP:

```php
class MimeTypes
{
    public const TEXT_PLAIN = 'text/plain';
    public const TEXT_HTML = 'text/html';
    public const TEXT_MARKDOWN = 'text/markdown';
    public const APPLICATION_JSON = 'application/json';
    public const APPLICATION_XML = 'application/xml';
    public const APPLICATION_PDF = 'application/pdf';
    public const IMAGE_PNG = 'image/png';
    public const IMAGE_JPEG = 'image/jpeg';
    public const IMAGE_GIF = 'image/gif';
    public const IMAGE_SVG = 'image/svg+xml';
}
```

### Content Encoding

```php
class ContentEncoding
{
    public static function encodeBase64(string $data): string
    {
        return base64_encode($data);
    }

    public static function decodeBase64(string $data): string
    {
        $decoded = base64_decode($data, true);
        if ($decoded === false) {
            throw new \InvalidArgumentException('Invalid base64 data');
        }
        return $decoded;
    }

    public static function encodeJson(mixed $data): string
    {
        $json = json_encode($data, JSON_THROW_ON_ERROR);
        return $json;
    }

    public static function decodeJson(string $json): mixed
    {
        return json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    }
}
```

## Authentication Types

### AuthProvider Interface

```php
interface AuthProvider
{
    public function authenticate(array $credentials): Promise;
    public function validateToken(string $token): Promise;
    public function refreshToken(string $refreshToken): Promise;
    public function getScopes(string $token): array;
}
```

### OAuth2 Types

```php
class OAuth2Credentials
{
    public function __construct(
        public readonly string $clientId,
        public readonly string $clientSecret,
        public readonly string $redirectUri,
        public readonly array $scopes = [],
        public readonly bool $pkce = true
    ) {}
}

class OAuth2Token
{
    public function __construct(
        public readonly string $accessToken,
        public readonly string $tokenType,
        public readonly int $expiresIn,
        public readonly ?string $refreshToken = null,
        public readonly array $scopes = []
    ) {}
}
```

## See Also

- [Server API](server) - Server implementation reference
- [Client API](client) - Client implementation reference
- [Transport APIs](transports) - Transport layer reference
- [Examples](../examples/) - Working examples with type usage
