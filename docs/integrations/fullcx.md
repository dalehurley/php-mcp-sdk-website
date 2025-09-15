# FullCX Integration

Product management platform integration with requirements management, feature tracking, and analytics reporting.

## Overview

FullCX integration enables AI-powered product management through MCP, providing:

- Requirements and feature management
- User story integration and tracking
- Product analytics and reporting
- Automated workflow orchestration
- AI-assisted product development

## Installation

```bash
composer require dalehurley/php-mcp-sdk
# FullCX API credentials required
```

## Basic FullCX MCP Server

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use function Amp\async;

class FullCXMcpServer
{
    private McpServer $server;
    private string $apiToken;
    private string $baseUrl;

    public function __construct(string $apiToken, string $baseUrl = 'https://api.fullcx.com')
    {
        $this->apiToken = $apiToken;
        $this->baseUrl = $baseUrl;

        $this->server = new McpServer(
            new Implementation(
                'fullcx-server',
                '1.0.0',
                'FullCX Product Management Integration'
            )
        );

        $this->registerTools();
        $this->registerResources();
    }

    private function registerTools(): void
    {
        // Product management tools
        $this->server->tool(
            'list_products',
            'Get all products from FullCX',
            [
                'type' => 'object',
                'properties' => [
                    'limit' => ['type' => 'integer', 'default' => 50],
                    'offset' => ['type' => 'integer', 'default' => 0]
                ]
            ],
            function (array $params): array {
                $products = $this->apiCall('GET', '/products', [
                    'limit' => $params['limit'] ?? 50,
                    'offset' => $params['offset'] ?? 0
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode($products, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        $this->server->tool(
            'create_feature',
            'Create a new feature in FullCX',
            [
                'type' => 'object',
                'properties' => [
                    'product_id' => ['type' => 'string'],
                    'name' => ['type' => 'string'],
                    'description' => ['type' => 'string'],
                    'summary' => ['type' => 'string']
                ],
                'required' => ['product_id', 'name', 'description']
            ],
            function (array $params): array {
                $feature = $this->apiCall('POST', '/features', [
                    'product_id' => $params['product_id'],
                    'name' => $params['name'],
                    'description' => $params['description'],
                    'summary' => $params['summary'] ?? null
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Feature '{$params['name']}' created successfully with ID: {$feature['id']}"
                    ]]
                ];
            }
        );

        $this->server->tool(
            'create_requirement',
            'Create a new requirement in FullCX',
            [
                'type' => 'object',
                'properties' => [
                    'product_id' => ['type' => 'string'],
                    'feature_id' => ['type' => 'string'],
                    'name' => ['type' => 'string'],
                    'description' => ['type' => 'string'],
                    'priority' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 5, 'default' => 2],
                    'user_story' => ['type' => 'string']
                ],
                'required' => ['product_id', 'name', 'description']
            ],
            function (array $params): array {
                $requirement = $this->apiCall('POST', '/requirements', [
                    'product_id' => $params['product_id'],
                    'feature_id' => $params['feature_id'] ?? null,
                    'name' => $params['name'],
                    'description' => $params['description'],
                    'priority' => $params['priority'] ?? 2,
                    'user_story' => $params['user_story'] ?? null
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Requirement '{$params['name']}' created successfully with ID: {$requirement['id']}"
                    ]]
                ];
            }
        );

        $this->server->tool(
            'create_acceptance_criteria',
            'Create acceptance criteria for a feature',
            [
                'type' => 'object',
                'properties' => [
                    'feature_id' => ['type' => 'string'],
                    'requirement_id' => ['type' => 'string'],
                    'scenario' => ['type' => 'string'],
                    'criteria' => ['type' => 'string']
                ],
                'required' => ['feature_id', 'scenario', 'criteria']
            ],
            function (array $params): array {
                $criteria = $this->apiCall('POST', '/acceptance-criteria', [
                    'feature_id' => $params['feature_id'],
                    'requirement_id' => $params['requirement_id'] ?? null,
                    'scenario' => $params['scenario'],
                    'criteria' => $params['criteria']
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Acceptance criteria created successfully with ID: {$criteria['id']}"
                    ]]
                ];
            }
        );

        $this->server->tool(
            'update_requirement_status',
            'Update the status of a requirement',
            [
                'type' => 'object',
                'properties' => [
                    'requirement_id' => ['type' => 'string'],
                    'status' => [
                        'type' => 'string',
                        'enum' => ['Backlog', 'Design', 'To Do', 'In-progress', 'Test', 'Done']
                    ]
                ],
                'required' => ['requirement_id', 'status']
            ],
            function (array $params): array {
                $this->apiCall('PUT', "/requirements/{$params['requirement_id']}/status", [
                    'status' => $params['status']
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => "Requirement status updated to '{$params['status']}'"
                    ]]
                ];
            }
        );
    }

    private function registerResources(): void
    {
        // Product details resource
        $this->server->resource(
            'product-details',
            'fullcx://products/{product_id}',
            'application/json',
            function (string $uri): array {
                if (!preg_match('/fullcx:\/\/products\/(.+)/', $uri, $matches)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        'Invalid product URI format'
                    );
                }

                $productId = urldecode($matches[1]);
                $product = $this->apiCall('GET', "/products/{$productId}");

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode($product, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Features resource
        $this->server->resource(
            'product-features',
            'fullcx://products/{product_id}/features',
            'application/json',
            function (string $uri): array {
                if (!preg_match('/fullcx:\/\/products\/(.+)\/features/', $uri, $matches)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        'Invalid features URI format'
                    );
                }

                $productId = urldecode($matches[1]);
                $features = $this->apiCall('GET', '/features', ['product_id' => $productId]);

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode($features, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function apiCall(string $method, string $endpoint, array $data = []): array
    {
        $url = $this->baseUrl . $endpoint;

        $options = [
            'http' => [
                'method' => $method,
                'header' => [
                    'Authorization: Bearer ' . $this->apiToken,
                    'Content-Type: application/json',
                    'Accept: application/json'
                ]
            ]
        ];

        if (in_array($method, ['POST', 'PUT', 'PATCH']) && !empty($data)) {
            $options['http']['content'] = json_encode($data);
        } elseif ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }

        $context = stream_context_create($options);
        $response = file_get_contents($url, false, $context);

        if ($response === false) {
            throw new McpError(
                ErrorCode::InternalError,
                "FullCX API call failed: {$method} {$endpoint}"
            );
        }

        $result = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new McpError(
                ErrorCode::InternalError,
                'Invalid JSON response from FullCX API'
            );
        }

        return $result;
    }

    public function start(): void
    {
        async(function () {
            echo "🚀 FullCX MCP Server starting...\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Usage
$server = new FullCXMcpServer($_ENV['FULLCX_API_TOKEN']);
$server->start();
```

## OpenAI + FullCX Agent

```php
class FullCXProductAgent
{
    private OpenAIClient $openai;
    private FullCXMcpServer $fullcxServer;

    public function processProductRequest(string $request): string
    {
        $response = $this->openai->chat()->create([
            'model' => 'gpt-4-1106-preview',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a product management assistant with access to FullCX. Help users manage products, features, requirements, and acceptance criteria.'
                ],
                [
                    'role' => 'user',
                    'content' => $request
                ]
            ],
            'functions' => $this->getFullCXFunctions()
        ]);

        // Handle function calls and return formatted response
        return $this->handleResponse($response);
    }

    private function getFullCXFunctions(): array
    {
        return [
            [
                'name' => 'list_products',
                'description' => 'Get all products from FullCX',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'limit' => ['type' => 'integer', 'default' => 50]
                    ]
                ]
            ],
            [
                'name' => 'create_feature',
                'description' => 'Create a new feature for a product',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'product_id' => ['type' => 'string'],
                        'name' => ['type' => 'string'],
                        'description' => ['type' => 'string']
                    ],
                    'required' => ['product_id', 'name', 'description']
                ]
            ]
            // More functions...
        ];
    }
}
```

## Configuration

### Environment Variables

```env
# FullCX API Configuration
FULLCX_API_TOKEN=your-fullcx-api-token
FULLCX_BASE_URL=https://api.fullcx.com

# OpenAI Configuration (for AI-powered features)
OPENAI_API_KEY=your-openai-api-key

# MCP Configuration
MCP_SERVER_NAME="FullCX Integration Server"
MCP_TRANSPORT=stdio
```

## Use Cases

### Product Development Workflow

```
User: "Create a feature called 'User Dashboard' for product ABC123"
Agent: Creates feature in FullCX and returns confirmation with feature ID

User: "Add requirements for user authentication to that feature"
Agent: Creates authentication requirements linked to the dashboard feature

User: "What's the status of all requirements for product ABC123?"
Agent: Retrieves and summarizes all requirements with their current status
```

### Analytics and Reporting

```
User: "Show me the progress on product XYZ"
Agent: Generates comprehensive progress report with feature completion rates

User: "Which features are behind schedule?"
Agent: Analyzes deadlines and identifies at-risk features

User: "Create a sprint report for the current iteration"
Agent: Generates detailed sprint progress with burndown metrics
```

## Best Practices

### 1. API Integration

- Implement proper rate limiting for FullCX API calls
- Cache frequently accessed data
- Handle API errors gracefully
- Use batch operations where possible

### 2. Data Synchronization

- Keep local cache in sync with FullCX
- Implement webhook handlers for real-time updates
- Handle data consistency across systems
- Provide offline capabilities where appropriate

### 3. User Experience

- Provide clear feedback for all operations
- Support natural language queries
- Implement search and filtering
- Offer bulk operations for efficiency

### 4. Security

- Secure API token storage
- Validate all user inputs
- Implement proper access controls
- Audit all product management operations

## See Also

- [FullCX API Documentation](https://docs.fullcx.com)
- [Product Management Examples](../examples/real-world/task-manager)
- [OpenAI Integration](openai)
- [MCP Client API](../api/client)
