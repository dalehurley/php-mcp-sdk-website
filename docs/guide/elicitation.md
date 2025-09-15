# Elicitation (User Input)

Learn how to implement user input elicitation in MCP clients, enabling servers to request structured data from users with schema validation.

## Overview

Elicitation in MCP allows servers to request additional information from users through the client during interactions. Based on the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation), elicitation provides:

- **Dynamic User Input**: Servers can request user data as needed
- **Schema Validation**: Structured data collection with JSON schemas
- **User Control**: Users can accept, decline, or cancel requests
- **Security**: Clients maintain control over user interactions

## Client Implementation

### Declaring Elicitation Capability

Clients that support elicitation must declare the capability during initialization:

```php
use MCP\Client\Client;
use MCP\Types\Implementation;

$client = new Client(
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
```

### Basic Elicitation Handler

```php
class ElicitationClient extends Client
{
    private UserInterface $ui;
    private InputValidator $validator;

    public function __construct(UserInterface $ui)
    {
        parent::__construct(new Implementation('elicitation-client', '1.0.0'));

        $this->ui = $ui;
        $this->validator = new InputValidator();

        $this->setElicitationHandler([$this, 'handleElicitationRequest']);
    }

    public function handleElicitationRequest(array $request): array
    {
        try {
            $message = $request['message'] ?? 'Please provide the requested information';
            $schema = $request['requestedSchema'] ?? ['type' => 'object'];

            // Show request to user
            $userResponse = $this->ui->showElicitationDialog($message, $schema);

            // Handle user action
            return match($userResponse['action']) {
                'accept' => $this->handleAcceptAction($userResponse, $schema),
                'decline' => $this->handleDeclineAction(),
                'cancel' => $this->handleCancelAction(),
                default => throw new \InvalidArgumentException('Invalid user action')
            };

        } catch (\Exception $e) {
            return [
                'action' => 'cancel',
                'error' => $e->getMessage()
            ];
        }
    }

    private function handleAcceptAction(array $userResponse, array $schema): array
    {
        $content = $userResponse['content'] ?? [];

        // Validate user input against schema
        $validation = $this->validator->validate($content, $schema);

        if (!$validation->isValid) {
            // Re-prompt user with validation errors
            $this->ui->showValidationErrors($validation->errors);

            // For now, return cancel (in real implementation, could re-prompt)
            return ['action' => 'cancel'];
        }

        return [
            'action' => 'accept',
            'content' => $content
        ];
    }

    private function handleDeclineAction(): array
    {
        return ['action' => 'decline'];
    }

    private function handleCancelAction(): array
    {
        return ['action' => 'cancel'];
    }
}
```

### Advanced User Interface

```php
class WebElicitationInterface implements UserInterface
{
    private string $sessionId;
    private WebSocketConnection $websocket;

    public function showElicitationDialog(string $message, array $schema): array
    {
        // Generate form based on schema
        $formHtml = $this->generateFormFromSchema($schema);

        // Send to web interface
        $this->websocket->send([
            'type' => 'elicitation_request',
            'message' => $message,
            'form_html' => $formHtml,
            'schema' => $schema
        ]);

        // Wait for user response
        return $this->waitForUserResponse();
    }

    private function generateFormFromSchema(array $schema): string
    {
        $formBuilder = new FormBuilder();

        if ($schema['type'] === 'object') {
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $formBuilder->addField($propName, $propSchema);
            }
        }

        return $formBuilder->generateHtml();
    }

    private function waitForUserResponse(): array
    {
        // Wait for WebSocket response from user interface
        $timeout = 300; // 5 minutes
        $startTime = time();

        while (time() - $startTime < $timeout) {
            $message = $this->websocket->receive(1000); // 1 second timeout

            if ($message && $message['type'] === 'elicitation_response') {
                return $message['response'];
            }
        }

        throw new \TimeoutException('User did not respond within timeout period');
    }
}

class FormBuilder
{
    private string $html = '';

    public function addField(string $name, array $schema): void
    {
        $type = $schema['type'] ?? 'string';
        $title = $schema['title'] ?? ucfirst(str_replace('_', ' ', $name));
        $description = $schema['description'] ?? '';
        $required = in_array($name, $schema['required'] ?? []);

        $this->html .= "<div class='form-field'>\n";
        $this->html .= "<label for='{$name}'>{$title}" . ($required ? ' *' : '') . "</label>\n";

        if ($description) {
            $this->html .= "<p class='description'>{$description}</p>\n";
        }

        $this->html .= $this->generateInputElement($name, $schema) . "\n";
        $this->html .= "</div>\n";
    }

    private function generateInputElement(string $name, array $schema): string
    {
        $type = $schema['type'] ?? 'string';

        return match($type) {
            'string' => $this->generateStringInput($name, $schema),
            'integer', 'number' => $this->generateNumberInput($name, $schema),
            'boolean' => $this->generateBooleanInput($name, $schema),
            'array' => $this->generateArrayInput($name, $schema),
            default => "<input type='text' name='{$name}' id='{$name}'>"
        };
    }

    private function generateStringInput(string $name, array $schema): string
    {
        if (isset($schema['enum'])) {
            return $this->generateSelectInput($name, $schema);
        }

        $attributes = [
            'type' => 'text',
            'name' => $name,
            'id' => $name
        ];

        if (isset($schema['minLength'])) {
            $attributes['minlength'] = $schema['minLength'];
        }

        if (isset($schema['maxLength'])) {
            $attributes['maxlength'] = $schema['maxLength'];
        }

        if (isset($schema['pattern'])) {
            $attributes['pattern'] = $schema['pattern'];
        }

        $attrString = implode(' ', array_map(
            fn($k, $v) => "{$k}='{$v}'",
            array_keys($attributes),
            $attributes
        ));

        return "<input {$attrString}>";
    }

    private function generateSelectInput(string $name, array $schema): string
    {
        $options = $schema['enum'] ?? [];
        $optionNames = $schema['enumNames'] ?? $options;

        $html = "<select name='{$name}' id='{$name}'>\n";

        foreach ($options as $index => $value) {
            $label = $optionNames[$index] ?? $value;
            $html .= "<option value='{$value}'>{$label}</option>\n";
        }

        $html .= "</select>";

        return $html;
    }

    public function generateHtml(): string
    {
        return "<form class='elicitation-form'>\n{$this->html}</form>";
    }
}
```

## Server-Side Elicitation

### Requesting User Input

```php
class InteractiveServer
{
    private McpServer $server;
    private ElicitationClient $elicitationClient;

    public function __construct(ElicitationClient $elicitationClient)
    {
        $this->server = new McpServer(
            new Implementation('interactive-server', '1.0.0')
        );
        $this->elicitationClient = $elicitationClient;

        $this->registerInteractiveTools();
    }

    private function registerInteractiveTools(): void
    {
        // Tool that requires user configuration
        $this->server->tool(
            'setup_integration',
            'Set up external service integration',
            [
                'type' => 'object',
                'properties' => [
                    'service' => [
                        'type' => 'string',
                        'enum' => ['github', 'slack', 'trello', 'jira'],
                        'description' => 'Service to integrate with'
                    ]
                ],
                'required' => ['service']
            ],
            function (array $params): array {
                $service = $params['service'];

                // Request service-specific configuration from user
                $config = $this->requestServiceConfiguration($service);

                if ($config['action'] !== 'accept') {
                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => "Integration setup cancelled by user"
                        ]]
                    ];
                }

                // Set up integration with provided configuration
                $result = $this->setupServiceIntegration($service, $config['content']);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Successfully configured {$service} integration"
                    ]]
                ];
            }
        );

        // Tool for collecting user preferences
        $this->server->tool(
            'collect_preferences',
            'Collect user preferences for personalization',
            ['type' => 'object'],
            function (): array {
                $preferences = $this->requestUserPreferences();

                if ($preferences['action'] === 'accept') {
                    $this->saveUserPreferences($preferences['content']);

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => 'User preferences saved successfully'
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => 'User preferences not collected'
                    ]]
                ];
            }
        );

        // Tool for interactive data entry
        $this->server->tool(
            'enter_data',
            'Interactive data entry with validation',
            [
                'type' => 'object',
                'properties' => [
                    'data_type' => [
                        'type' => 'string',
                        'enum' => ['contact', 'product', 'task', 'note'],
                        'description' => 'Type of data to enter'
                    ]
                ],
                'required' => ['data_type']
            ],
            function (array $params): array {
                $dataType = $params['data_type'];
                $schema = $this->getSchemaForDataType($dataType);

                $result = $this->elicitationClient->requestElicitation([
                    'message' => "Please enter {$dataType} information:",
                    'requestedSchema' => $schema
                ])->await();

                if ($result['action'] === 'accept') {
                    $savedData = $this->saveData($dataType, $result['content']);

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => "Successfully saved {$dataType} with ID: {$savedData['id']}"
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Data entry was {$result['action']}led by user"
                    ]]
                ];
            }
        );
    }

    private function requestServiceConfiguration(string $service): array
    {
        $schemas = [
            'github' => [
                'type' => 'object',
                'properties' => [
                    'username' => [
                        'type' => 'string',
                        'title' => 'GitHub Username',
                        'description' => 'Your GitHub username'
                    ],
                    'token' => [
                        'type' => 'string',
                        'title' => 'Personal Access Token',
                        'description' => 'GitHub personal access token with appropriate scopes'
                    ],
                    'repositories' => [
                        'type' => 'array',
                        'title' => 'Repositories',
                        'items' => ['type' => 'string'],
                        'description' => 'Repository names to access'
                    ]
                ],
                'required' => ['username', 'token']
            ],
            'slack' => [
                'type' => 'object',
                'properties' => [
                    'workspace' => [
                        'type' => 'string',
                        'title' => 'Slack Workspace',
                        'description' => 'Your Slack workspace URL'
                    ],
                    'bot_token' => [
                        'type' => 'string',
                        'title' => 'Bot Token',
                        'description' => 'Slack bot token for API access'
                    ],
                    'channels' => [
                        'type' => 'array',
                        'title' => 'Channels',
                        'items' => ['type' => 'string'],
                        'description' => 'Channels to monitor or post to'
                    ]
                ],
                'required' => ['workspace', 'bot_token']
            ]
        ];

        $schema = $schemas[$service] ?? ['type' => 'object'];

        return $this->elicitationClient->requestElicitation([
            'message' => "Please provide configuration for {$service} integration:",
            'requestedSchema' => $schema
        ])->await();
    }

    private function requestUserPreferences(): array
    {
        $schema = [
            'type' => 'object',
            'properties' => [
                'theme' => [
                    'type' => 'string',
                    'title' => 'Theme Preference',
                    'enum' => ['light', 'dark', 'auto'],
                    'enumNames' => ['Light', 'Dark', 'Auto'],
                    'default' => 'auto'
                ],
                'notifications' => [
                    'type' => 'boolean',
                    'title' => 'Enable Notifications',
                    'description' => 'Receive notifications for important events',
                    'default' => true
                ],
                'language' => [
                    'type' => 'string',
                    'title' => 'Preferred Language',
                    'enum' => ['en', 'es', 'fr', 'de', 'ja'],
                    'enumNames' => ['English', 'Spanish', 'French', 'German', 'Japanese'],
                    'default' => 'en'
                ],
                'timezone' => [
                    'type' => 'string',
                    'title' => 'Timezone',
                    'description' => 'Your timezone (e.g., America/New_York)'
                ]
            ]
        ];

        return $this->elicitationClient->requestElicitation([
            'message' => 'Please configure your preferences:',
            'requestedSchema' => $schema
        ])->await();
    }

    private function getSchemaForDataType(string $dataType): array
    {
        $schemas = [
            'contact' => [
                'type' => 'object',
                'properties' => [
                    'name' => [
                        'type' => 'string',
                        'title' => 'Full Name',
                        'minLength' => 1,
                        'maxLength' => 100
                    ],
                    'email' => [
                        'type' => 'string',
                        'title' => 'Email Address',
                        'format' => 'email'
                    ],
                    'phone' => [
                        'type' => 'string',
                        'title' => 'Phone Number',
                        'pattern' => '^[+]?[0-9\s\-\(\)]+$'
                    ],
                    'company' => [
                        'type' => 'string',
                        'title' => 'Company',
                        'maxLength' => 100
                    ]
                ],
                'required' => ['name', 'email']
            ],
            'task' => [
                'type' => 'object',
                'properties' => [
                    'title' => [
                        'type' => 'string',
                        'title' => 'Task Title',
                        'minLength' => 1,
                        'maxLength' => 200
                    ],
                    'description' => [
                        'type' => 'string',
                        'title' => 'Description',
                        'maxLength' => 1000
                    ],
                    'priority' => [
                        'type' => 'integer',
                        'title' => 'Priority',
                        'minimum' => 1,
                        'maximum' => 5,
                        'default' => 3
                    ],
                    'due_date' => [
                        'type' => 'string',
                        'title' => 'Due Date',
                        'format' => 'date'
                    ],
                    'tags' => [
                        'type' => 'array',
                        'title' => 'Tags',
                        'items' => ['type' => 'string'],
                        'maxItems' => 10
                    ]
                ],
                'required' => ['title']
            ]
        ];

        return $schemas[$dataType] ?? ['type' => 'object'];
    }
}
```

## Command-Line Elicitation

### CLI Elicitation Interface

```php
class CliElicitationInterface implements UserInterface
{
    private InputReader $inputReader;
    private OutputFormatter $formatter;

    public function __construct()
    {
        $this->inputReader = new InputReader();
        $this->formatter = new OutputFormatter();
    }

    public function showElicitationDialog(string $message, array $schema): array
    {
        $this->formatter->printHeader('Information Required');
        $this->formatter->printMessage($message);
        $this->formatter->printSeparator();

        // Show what information is being requested
        $this->showSchemaDescription($schema);

        // Collect user input
        $content = $this->collectUserInput($schema);

        // Confirm with user
        $action = $this->confirmSubmission($content);

        return [
            'action' => $action,
            'content' => $action === 'accept' ? $content : null
        ];
    }

    private function showSchemaDescription(array $schema): void
    {
        if ($schema['type'] === 'object') {
            $this->formatter->printSubheader('Required Information:');

            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $title = $propSchema['title'] ?? ucfirst(str_replace('_', ' ', $propName));
                $description = $propSchema['description'] ?? '';
                $required = in_array($propName, $schema['required'] ?? []);

                $this->formatter->printField($title, $description, $required);
            }

            $this->formatter->printSeparator();
        }
    }

    private function collectUserInput(array $schema): array
    {
        $content = [];

        if ($schema['type'] === 'object') {
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $value = $this->collectFieldInput($propName, $propSchema);

                if ($value !== null) {
                    $content[$propName] = $value;
                }
            }
        }

        return $content;
    }

    private function collectFieldInput(string $fieldName, array $fieldSchema): mixed
    {
        $title = $fieldSchema['title'] ?? ucfirst(str_replace('_', ' ', $fieldName));
        $type = $fieldSchema['type'] ?? 'string';
        $required = $fieldSchema['required'] ?? false;

        while (true) {
            $prompt = "{$title}" . ($required ? ' (required)' : ' (optional)') . ': ';

            if (isset($fieldSchema['enum'])) {
                $options = array_combine($fieldSchema['enum'], $fieldSchema['enumNames'] ?? $fieldSchema['enum']);
                $prompt .= "\nOptions: " . implode(', ', array_values($options)) . "\n> ";
            }

            $input = $this->inputReader->read($prompt);

            // Handle empty input
            if (empty($input)) {
                if ($required) {
                    $this->formatter->printError("This field is required. Please provide a value.");
                    continue;
                }
                return null;
            }

            // Validate input
            $validation = $this->validateFieldInput($input, $fieldSchema);

            if ($validation->isValid) {
                return $this->convertInputType($input, $type);
            }

            $this->formatter->printError("Invalid input: " . implode(', ', $validation->errors));
        }
    }

    private function confirmSubmission(array $content): string
    {
        $this->formatter->printSubheader('Review Your Input:');

        foreach ($content as $field => $value) {
            $displayValue = is_array($value) ? implode(', ', $value) : $value;
            $this->formatter->printKeyValue($field, $displayValue);
        }

        $this->formatter->printSeparator();

        while (true) {
            $response = $this->inputReader->read('Submit this information? (y)es/(n)o/(c)ancel: ');

            return match(strtolower($response)) {
                'y', 'yes' => 'accept',
                'n', 'no' => 'decline',
                'c', 'cancel' => 'cancel',
                default => null
            } ?? continue;
        }
    }
}
```

## Complete Elicitation Example

### Interactive Configuration Tool

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use function Amp\async;

class ConfigurationServer
{
    private McpServer $server;
    private ElicitationClient $elicitationClient;
    private array $configurations = [];

    public function __construct()
    {
        $this->server = new McpServer(
            new Implementation('config-server', '1.0.0')
        );

        // Set up elicitation client for user input
        $this->elicitationClient = new ElicitationClient(new CliElicitationInterface());

        $this->registerConfigurationTools();
    }

    private function registerConfigurationTools(): void
    {
        $this->server->tool(
            'configure_database',
            'Configure database connection',
            ['type' => 'object'],
            function (): array {
                $result = $this->elicitationClient->requestElicitation([
                    'message' => 'Please provide database connection details:',
                    'requestedSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'host' => [
                                'type' => 'string',
                                'title' => 'Database Host',
                                'description' => 'Database server hostname or IP',
                                'default' => 'localhost'
                            ],
                            'port' => [
                                'type' => 'integer',
                                'title' => 'Port',
                                'description' => 'Database port number',
                                'minimum' => 1,
                                'maximum' => 65535,
                                'default' => 3306
                            ],
                            'database' => [
                                'type' => 'string',
                                'title' => 'Database Name',
                                'description' => 'Name of the database to connect to'
                            ],
                            'username' => [
                                'type' => 'string',
                                'title' => 'Username',
                                'description' => 'Database username'
                            ],
                            'ssl' => [
                                'type' => 'boolean',
                                'title' => 'Use SSL',
                                'description' => 'Enable SSL/TLS connection',
                                'default' => true
                            ]
                        ],
                        'required' => ['host', 'database', 'username']
                    ]
                ])->await();

                if ($result['action'] === 'accept') {
                    $config = $result['content'];
                    $this->configurations['database'] = $config;

                    // Test connection
                    $testResult = $this->testDatabaseConnection($config);

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => $testResult['success']
                                ? 'Database configuration saved and tested successfully'
                                : 'Database configuration saved but connection test failed: ' . $testResult['error']
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Database configuration {$result['action']}led by user"
                    ]]
                ];
            }
        );

        $this->server->tool(
            'setup_user_profile',
            'Set up user profile with preferences',
            ['type' => 'object'],
            function (): array {
                $result = $this->elicitationClient->requestElicitation([
                    'message' => 'Please set up your user profile:',
                    'requestedSchema' => [
                        'type' => 'object',
                        'properties' => [
                            'display_name' => [
                                'type' => 'string',
                                'title' => 'Display Name',
                                'description' => 'How you\'d like to be addressed'
                            ],
                            'email' => [
                                'type' => 'string',
                                'title' => 'Email Address',
                                'format' => 'email'
                            ],
                            'role' => [
                                'type' => 'string',
                                'title' => 'Role',
                                'enum' => ['developer', 'designer', 'manager', 'analyst', 'other'],
                                'enumNames' => ['Developer', 'Designer', 'Manager', 'Analyst', 'Other']
                            ],
                            'experience_level' => [
                                'type' => 'integer',
                                'title' => 'Years of Experience',
                                'minimum' => 0,
                                'maximum' => 50
                            ],
                            'skills' => [
                                'type' => 'array',
                                'title' => 'Skills',
                                'items' => ['type' => 'string'],
                                'description' => 'Your key skills and technologies'
                            ],
                            'notifications' => [
                                'type' => 'boolean',
                                'title' => 'Enable Notifications',
                                'default' => true
                            ]
                        ],
                        'required' => ['display_name', 'email', 'role']
                    ]
                ])->await();

                if ($result['action'] === 'accept') {
                    $profile = $result['content'];
                    $this->configurations['user_profile'] = $profile;

                    return [
                        'content' => [[
                            'type' => 'text',
                            'text' => "User profile created for {$profile['display_name']}"
                        ]]
                    ];
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Profile setup {$result['action']}led by user"
                    ]]
                ];
            }
        );
    }

    private function testDatabaseConnection(array $config): array
    {
        try {
            $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']}";

            if ($config['ssl'] ?? true) {
                $dsn .= ";ssl_mode=REQUIRED";
            }

            $pdo = new \PDO($dsn, $config['username'], '', [
                \PDO::ATTR_TIMEOUT => 5,
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION
            ]);

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function start(): void
    {
        async(function () {
            echo "🔧 Interactive Configuration Server starting...\n";
            echo "This server can collect user configuration through interactive prompts.\n\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Start the server
$server = new ConfigurationServer();
$server->start();
```

## Security and Privacy

### Secure Elicitation Handling

```php
class SecureElicitationClient extends Client
{
    private array $sensitiveFields = [
        'password', 'token', 'secret', 'key', 'credential'
    ];
    private UserConsentManager $consentManager;

    public function handleElicitationRequest(array $request): array
    {
        // Security check: Prevent sensitive information requests
        if ($this->containsSensitiveFields($request['requestedSchema'] ?? [])) {
            return [
                'action' => 'decline',
                'error' => 'Request contains sensitive fields that cannot be collected'
            ];
        }

        // Get user consent
        $consent = $this->consentManager->requestConsent($request);

        if (!$consent->granted) {
            return ['action' => 'decline'];
        }

        // Proceed with normal elicitation handling
        return parent::handleElicitationRequest($request);
    }

    private function containsSensitiveFields(array $schema): bool
    {
        if ($schema['type'] === 'object') {
            foreach ($schema['properties'] ?? [] as $propName => $propSchema) {
                $lowerName = strtolower($propName);

                foreach ($this->sensitiveFields as $sensitiveField) {
                    if (strpos($lowerName, $sensitiveField) !== false) {
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
}
```

### Rate Limiting

```php
class RateLimitedElicitationClient extends Client
{
    private array $requestCounts = [];
    private int $maxRequestsPerHour = 10;

    public function handleElicitationRequest(array $request): array
    {
        $serverId = $this->getCurrentServerId();

        if (!$this->isRequestAllowed($serverId)) {
            return [
                'action' => 'decline',
                'error' => 'Rate limit exceeded for elicitation requests'
            ];
        }

        $this->recordRequest($serverId);

        return parent::handleElicitationRequest($request);
    }

    private function isRequestAllowed(string $serverId): bool
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
}
```

## Testing

### Elicitation Testing

```php
class ElicitationTest extends TestCase
{
    private ElicitationClient $client;
    private MockUserInterface $mockUI;

    protected function setUp(): void
    {
        $this->mockUI = new MockUserInterface();
        $this->client = new ElicitationClient($this->mockUI);
    }

    public function testSuccessfulElicitation(): void
    {
        $this->mockUI->setUserResponse([
            'action' => 'accept',
            'content' => ['username' => 'testuser']
        ]);

        $result = $this->client->handleElicitationRequest([
            'message' => 'Enter username',
            'requestedSchema' => [
                'type' => 'object',
                'properties' => [
                    'username' => ['type' => 'string']
                ]
            ]
        ]);

        $this->assertEquals('accept', $result['action']);
        $this->assertEquals('testuser', $result['content']['username']);
    }

    public function testUserDecline(): void
    {
        $this->mockUI->setUserResponse(['action' => 'decline']);

        $result = $this->client->handleElicitationRequest([
            'message' => 'Enter sensitive data',
            'requestedSchema' => ['type' => 'object']
        ]);

        $this->assertEquals('decline', $result['action']);
    }
}
```

## Best Practices

### 1. User Experience

- **Clear messaging**: Explain why information is needed
- **Progressive disclosure**: Only ask for necessary information
- **Validation feedback**: Provide helpful error messages
- **Easy cancellation**: Always allow users to cancel

### 2. Security

- **Never request sensitive data** like passwords or tokens
- **Validate all inputs** against schemas
- **Implement rate limiting** to prevent abuse
- **Log all elicitation requests** for audit

### 3. Schema Design

- **Use appropriate types** for each field
- **Provide helpful descriptions** and examples
- **Set reasonable limits** on input lengths
- **Use enums** for constrained choices

### 4. Error Handling

- **Handle validation errors** gracefully
- **Provide clear error messages** to users
- **Implement timeout handling** for slow responses
- **Fallback to simpler schemas** if complex ones fail

## See Also

- [MCP Elicitation Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)
- [User Interface Examples](../examples/interactive/)
- [Security Guide](security)
- [Client API Reference](../api/client)
