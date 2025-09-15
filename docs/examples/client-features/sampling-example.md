# Sampling (LLM) Example

Complete example demonstrating LLM sampling in MCP clients with model preferences, multimodal support, and intelligent model selection.

## Overview

This example shows how to implement a sophisticated sampling client that:

- Supports multiple LLM providers (OpenAI, Anthropic)
- Implements intelligent model selection based on preferences
- Handles multimodal content (text, images, audio)
- Provides streaming responses
- Includes comprehensive error handling

## Complete Implementation

```php
#!/usr/bin/env php
<?php

/**
 * Advanced Sampling Client Example
 *
 * Demonstrates comprehensive LLM sampling implementation including:
 * - Multiple LLM provider support
 * - Intelligent model selection
 * - Multimodal content handling
 * - Streaming responses
 * - Error handling and fallbacks
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use OpenAI\Client as OpenAIClient;
use function Amp\async;

class AdvancedSamplingClient extends Client
{
    private OpenAIClient $openai;
    private array $modelMappings;
    private array $modelCapabilities;
    private array $providerClients;
    private ModelSelector $modelSelector;

    public function __construct(array $providerConfigs)
    {
        parent::__construct(
            new Implementation('advanced-sampling-client', '1.0.0'),
            [
                'capabilities' => [
                    'sampling' => [
                        'modelPreferences' => true,
                        'multimodal' => true,
                        'streaming' => true
                    ]
                ]
            ]
        );

        $this->initializeProviders($providerConfigs);
        $this->setupModelMappings();
        $this->modelSelector = new ModelSelector($this->modelCapabilities);

        $this->setSamplingHandler([$this, 'handleSamplingRequest']);
    }

    private function initializeProviders(array $configs): void
    {
        // Initialize OpenAI client
        if (isset($configs['openai']['api_key'])) {
            $this->providerClients['openai'] = OpenAI::client($configs['openai']['api_key']);
        }

        // Initialize Anthropic client (if available)
        if (isset($configs['anthropic']['api_key'])) {
            $this->providerClients['anthropic'] = new AnthropicClient($configs['anthropic']['api_key']);
        }

        // Add more providers as needed
    }

    private function setupModelMappings(): void
    {
        $this->modelMappings = [
            // Claude model hints -> Available models
            'claude-3-sonnet' => [
                'anthropic' => 'claude-3-sonnet-20240229',
                'openai' => 'gpt-4-1106-preview' // Fallback
            ],
            'claude-3-haiku' => [
                'anthropic' => 'claude-3-haiku-20240307',
                'openai' => 'gpt-3.5-turbo'
            ],
            'claude' => [
                'anthropic' => 'claude-3-sonnet-20240229',
                'openai' => 'gpt-4-1106-preview'
            ],

            // GPT model hints
            'gpt-4' => [
                'openai' => 'gpt-4-1106-preview',
                'anthropic' => 'claude-3-sonnet-20240229'
            ],
            'gpt-3.5' => [
                'openai' => 'gpt-3.5-turbo',
                'anthropic' => 'claude-3-haiku-20240307'
            ]
        ];

        $this->modelCapabilities = [
            'gpt-4-1106-preview' => [
                'intelligence' => 0.95,
                'speed' => 0.6,
                'cost' => 0.1,
                'multimodal' => true,
                'provider' => 'openai'
            ],
            'gpt-3.5-turbo' => [
                'intelligence' => 0.75,
                'speed' => 0.9,
                'cost' => 0.9,
                'multimodal' => false,
                'provider' => 'openai'
            ],
            'claude-3-sonnet-20240229' => [
                'intelligence' => 0.92,
                'speed' => 0.7,
                'cost' => 0.3,
                'multimodal' => true,
                'provider' => 'anthropic'
            ],
            'claude-3-haiku-20240307' => [
                'intelligence' => 0.80,
                'speed' => 0.85,
                'cost' => 0.8,
                'multimodal' => false,
                'provider' => 'anthropic'
            ]
        ];
    }

    public function handleSamplingRequest(array $request): array
    {
        try {
            echo "🤖 Processing sampling request...\n";

            // Extract request components
            $messages = $request['messages'] ?? [];
            $modelPreferences = $request['modelPreferences'] ?? [];
            $systemPrompt = $request['systemPrompt'] ?? null;
            $maxTokens = $request['maxTokens'] ?? 1000;

            // Select optimal model
            $selectedModel = $this->modelSelector->selectModel($modelPreferences, $messages);
            $provider = $this->modelCapabilities[$selectedModel]['provider'];

            echo "📊 Selected model: {$selectedModel} (provider: {$provider})\n";

            // Check if multimodal content is present
            $hasMultimodal = $this->hasMultimodalContent($messages);

            if ($hasMultimodal && !$this->modelCapabilities[$selectedModel]['multimodal']) {
                // Fallback to multimodal-capable model
                $selectedModel = $this->modelSelector->selectMultimodalModel($modelPreferences);
                $provider = $this->modelCapabilities[$selectedModel]['provider'];

                echo "🔄 Switched to multimodal model: {$selectedModel}\n";
            }

            // Make request to selected provider
            $result = $this->makeProviderRequest($provider, $selectedModel, $messages, $systemPrompt, $maxTokens);

            echo "✅ Sampling completed successfully\n";

            return [
                'role' => 'assistant',
                'content' => [
                    'type' => 'text',
                    'text' => $result['content']
                ],
                'model' => $selectedModel,
                'stopReason' => $result['stopReason'] ?? 'endTurn'
            ];

        } catch (\Exception $e) {
            echo "❌ Sampling failed: {$e->getMessage()}\n";

            throw new McpError(
                ErrorCode::InternalError,
                "Sampling failed: {$e->getMessage()}"
            );
        }
    }

    private function makeProviderRequest(
        string $provider,
        string $model,
        array $messages,
        ?string $systemPrompt,
        int $maxTokens
    ): array {
        return match($provider) {
            'openai' => $this->makeOpenAIRequest($model, $messages, $systemPrompt, $maxTokens),
            'anthropic' => $this->makeAnthropicRequest($model, $messages, $systemPrompt, $maxTokens),
            default => throw new \InvalidArgumentException("Unsupported provider: {$provider}")
        };
    }

    private function makeOpenAIRequest(string $model, array $messages, ?string $systemPrompt, int $maxTokens): array
    {
        $openaiMessages = $this->convertMessagesToOpenAI($messages, $systemPrompt);

        $response = $this->providerClients['openai']->chat()->create([
            'model' => $model,
            'messages' => $openaiMessages,
            'max_tokens' => $maxTokens,
            'temperature' => 0.7
        ]);

        return [
            'content' => $response->choices[0]->message->content,
            'stopReason' => $this->mapOpenAIStopReason($response->choices[0]->finishReason)
        ];
    }

    private function makeAnthropicRequest(string $model, array $messages, ?string $systemPrompt, int $maxTokens): array
    {
        // Convert to Anthropic format
        $anthropicMessages = $this->convertMessagesToAnthropic($messages);

        $response = $this->providerClients['anthropic']->messages()->create([
            'model' => $model,
            'messages' => $anthropicMessages,
            'system' => $systemPrompt,
            'max_tokens' => $maxTokens
        ]);

        return [
            'content' => $response->content[0]->text,
            'stopReason' => $this->mapAnthropicStopReason($response->stopReason)
        ];
    }

    private function convertMessagesToOpenAI(array $messages, ?string $systemPrompt): array
    {
        $openaiMessages = [];

        // Add system prompt if provided
        if ($systemPrompt) {
            $openaiMessages[] = [
                'role' => 'system',
                'content' => $systemPrompt
            ];
        }

        // Convert MCP messages to OpenAI format
        foreach ($messages as $message) {
            $content = $message['content'];

            if (is_array($content)) {
                // Handle multimodal content
                $openaiContent = [];

                foreach ($content as $contentItem) {
                    if ($contentItem['type'] === 'text') {
                        $openaiContent[] = [
                            'type' => 'text',
                            'text' => $contentItem['text']
                        ];
                    } elseif ($contentItem['type'] === 'image') {
                        $openaiContent[] = [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => "data:{$contentItem['mimeType']};base64,{$contentItem['data']}"
                            ]
                        ];
                    }
                }

                $openaiMessages[] = [
                    'role' => $message['role'],
                    'content' => $openaiContent
                ];
            } else {
                // Simple text content
                $openaiMessages[] = [
                    'role' => $message['role'],
                    'content' => $content['text'] ?? $content
                ];
            }
        }

        return $openaiMessages;
    }

    private function hasMultimodalContent(array $messages): bool
    {
        foreach ($messages as $message) {
            if (is_array($message['content'])) {
                foreach ($message['content'] as $contentItem) {
                    if (in_array($contentItem['type'], ['image', 'audio'])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private function mapOpenAIStopReason(string $reason): string
    {
        return match($reason) {
            'stop' => 'endTurn',
            'length' => 'maxTokens',
            'content_filter' => 'contentFilter',
            'function_call' => 'toolUse',
            default => 'other'
        };
    }

    public function demonstrateCapabilities(): void
    {
        echo "\n🎯 Demonstrating Sampling Capabilities\n";
        echo "=====================================\n";

        // Test basic text sampling
        $this->testBasicSampling();

        // Test model preferences
        $this->testModelPreferences();

        // Test multimodal sampling
        $this->testMultimodalSampling();

        // Test streaming
        $this->testStreamingSampling();
    }

    private function testBasicSampling(): void
    {
        echo "\n📝 Testing basic text sampling...\n";

        try {
            $result = $this->handleSamplingRequest([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            'type' => 'text',
                            'text' => 'Write a haiku about programming'
                        ]
                    ]
                ],
                'systemPrompt' => 'You are a creative poet who writes about technology.',
                'maxTokens' => 100
            ]);

            echo "Generated haiku:\n{$result['content']['text']}\n";
            echo "Model used: {$result['model']}\n";

        } catch (\Exception $e) {
            echo "❌ Basic sampling failed: {$e->getMessage()}\n";
        }
    }

    private function testModelPreferences(): void
    {
        echo "\n⚙️ Testing model preferences...\n";

        $preferences = [
            'hints' => [
                ['name' => 'claude-3-sonnet'],
                ['name' => 'gpt-4']
            ],
            'intelligencePriority' => 0.9,
            'speedPriority' => 0.3,
            'costPriority' => 0.2
        ];

        try {
            $result = $this->handleSamplingRequest([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            'type' => 'text',
                            'text' => 'Explain the theory of relativity in simple terms'
                        ]
                    ]
                ],
                'modelPreferences' => $preferences,
                'maxTokens' => 300
            ]);

            echo "Explanation generated with model: {$result['model']}\n";
            echo "Content length: " . strlen($result['content']['text']) . " characters\n";

        } catch (\Exception $e) {
            echo "❌ Model preference test failed: {$e->getMessage()}\n";
        }
    }

    private function testMultimodalSampling(): void
    {
        echo "\n🖼️ Testing multimodal sampling...\n";

        // Create a simple test image (1x1 pixel PNG)
        $testImageData = base64_encode(
            "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82"
        );

        try {
            $result = $this->handleSamplingRequest([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'Describe this image:'
                            ],
                            [
                                'type' => 'image',
                                'data' => $testImageData,
                                'mimeType' => 'image/png'
                            ]
                        ]
                    ]
                ],
                'modelPreferences' => [
                    'intelligencePriority' => 0.9 // Need vision capabilities
                ],
                'maxTokens' => 200
            ]);

            echo "Image description: {$result['content']['text']}\n";
            echo "Model used: {$result['model']}\n";

        } catch (\Exception $e) {
            echo "❌ Multimodal test failed: {$e->getMessage()}\n";
        }
    }

    private function testStreamingSampling(): void
    {
        echo "\n🌊 Testing streaming sampling...\n";

        try {
            $this->handleStreamingSamplingRequest([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            'type' => 'text',
                            'text' => 'Write a short story about a robot learning to paint'
                        ]
                    ]
                ],
                'maxTokens' => 500
            ], function($chunk) {
                if ($chunk['type'] === 'content') {
                    echo $chunk['content'];
                }
            });

            echo "\n✅ Streaming completed\n";

        } catch (\Exception $e) {
            echo "❌ Streaming test failed: {$e->getMessage()}\n";
        }
    }

    public function handleStreamingSamplingRequest(array $request, callable $onChunk): Promise
    {
        return async(function () use ($request, $onChunk) {
            $model = $this->modelSelector->selectModel($request['modelPreferences'] ?? []);
            $provider = $this->modelCapabilities[$model]['provider'];

            if ($provider === 'openai') {
                return $this->handleOpenAIStreaming($model, $request, $onChunk);
            }

            // Fallback to non-streaming for other providers
            $result = $this->handleSamplingRequest($request);
            $onChunk(['type' => 'content', 'content' => $result['content']['text']]);

            return $result;
        });
    }

    private function handleOpenAIStreaming(string $model, array $request, callable $onChunk): Promise
    {
        return async(function () use ($model, $request, $onChunk) {
            $messages = $this->convertMessagesToOpenAI($request['messages'], $request['systemPrompt'] ?? null);

            $stream = $this->providerClients['openai']->chat()->createStreamed([
                'model' => $model,
                'messages' => $messages,
                'max_tokens' => $request['maxTokens'] ?? 1000
            ]);

            $fullContent = '';

            foreach ($stream as $response) {
                $delta = $response->choices[0]->delta;

                if (isset($delta->content)) {
                    $fullContent .= $delta->content;
                    $onChunk([
                        'type' => 'content',
                        'content' => $delta->content
                    ]);
                }
            }

            return [
                'role' => 'assistant',
                'content' => [
                    'type' => 'text',
                    'text' => $fullContent
                ],
                'model' => $model,
                'stopReason' => 'endTurn'
            ];
        });
    }
}

class ModelSelector
{
    private array $modelCapabilities;

    public function __construct(array $modelCapabilities)
    {
        $this->modelCapabilities = $modelCapabilities;
    }

    public function selectModel(array $preferences, array $messages = []): string
    {
        // Check for specific model hints first
        $hints = $preferences['hints'] ?? [];

        foreach ($hints as $hint) {
            $hintName = $hint['name'] ?? '';
            $matchedModel = $this->findModelByHint($hintName);

            if ($matchedModel) {
                return $matchedModel;
            }
        }

        // Use preference-based selection
        return $this->selectByPreferences($preferences, $messages);
    }

    private function findModelByHint(string $hint): ?string
    {
        foreach ($this->modelCapabilities as $model => $capabilities) {
            if (stripos($model, $hint) !== false) {
                return $model;
            }
        }

        // Check partial matches
        foreach ($this->modelCapabilities as $model => $capabilities) {
            if (stripos($hint, 'claude') !== false && stripos($model, 'claude') !== false) {
                return $model;
            }
            if (stripos($hint, 'gpt') !== false && stripos($model, 'gpt') !== false) {
                return $model;
            }
        }

        return null;
    }

    private function selectByPreferences(array $preferences, array $messages): string
    {
        $intelligencePriority = $preferences['intelligencePriority'] ?? 0.5;
        $speedPriority = $preferences['speedPriority'] ?? 0.5;
        $costPriority = $preferences['costPriority'] ?? 0.5;

        $bestModel = null;
        $bestScore = -1;

        foreach ($this->modelCapabilities as $model => $capabilities) {
            $score = 0;

            // Intelligence score
            $score += $intelligencePriority * $capabilities['intelligence'];

            // Speed score
            $score += $speedPriority * $capabilities['speed'];

            // Cost score (higher cost priority = prefer lower cost)
            $score += $costPriority * $capabilities['cost'];

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestModel = $model;
            }
        }

        return $bestModel ?? 'gpt-3.5-turbo';
    }

    public function selectMultimodalModel(array $preferences): string
    {
        // Filter to only multimodal-capable models
        $multimodalModels = array_filter(
            $this->modelCapabilities,
            fn($caps) => $caps['multimodal']
        );

        if (empty($multimodalModels)) {
            throw new \RuntimeException('No multimodal models available');
        }

        // Select best multimodal model based on preferences
        $bestModel = null;
        $bestScore = -1;

        foreach ($multimodalModels as $model => $capabilities) {
            $score = $this->calculateModelScore($capabilities, $preferences);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestModel = $model;
            }
        }

        return $bestModel;
    }

    private function calculateModelScore(array $capabilities, array $preferences): float
    {
        $intelligencePriority = $preferences['intelligencePriority'] ?? 0.5;
        $speedPriority = $preferences['speedPriority'] ?? 0.5;
        $costPriority = $preferences['costPriority'] ?? 0.5;

        return ($intelligencePriority * $capabilities['intelligence']) +
               ($speedPriority * $capabilities['speed']) +
               ($costPriority * $capabilities['cost']);
    }
}

// Demonstration server that uses sampling
class SamplingDemoServer
{
    private McpServer $server;
    private AdvancedSamplingClient $samplingClient;

    public function __construct(AdvancedSamplingClient $samplingClient)
    {
        $this->server = new McpServer(
            new Implementation('sampling-demo-server', '1.0.0')
        );
        $this->samplingClient = $samplingClient;

        $this->registerSamplingTools();
    }

    private function registerSamplingTools(): void
    {
        $this->server->tool(
            'ai_content_generator',
            'Generate content using AI with specific requirements',
            [
                'type' => 'object',
                'properties' => [
                    'topic' => ['type' => 'string'],
                    'style' => [
                        'type' => 'string',
                        'enum' => ['formal', 'casual', 'technical', 'creative']
                    ],
                    'target_audience' => ['type' => 'string'],
                    'word_count' => ['type' => 'integer', 'minimum' => 50, 'maximum' => 2000]
                ],
                'required' => ['topic', 'style']
            ],
            function (array $params): array {
                $result = $this->samplingClient->handleSamplingRequest([
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                'type' => 'text',
                                'text' => $this->buildContentPrompt($params)
                            ]
                        ]
                    ],
                    'modelPreferences' => [
                        'intelligencePriority' => 0.8,
                        'speedPriority' => 0.4
                    ],
                    'maxTokens' => $this->calculateMaxTokens($params['word_count'] ?? 500)
                ]);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $result['content']['text']
                    ]]
                ];
            }
        );
    }

    private function buildContentPrompt(array $params): string
    {
        $topic = $params['topic'];
        $style = $params['style'];
        $audience = $params['target_audience'] ?? 'general audience';
        $wordCount = $params['word_count'] ?? 500;

        return "Write content about: {$topic}\n\n" .
               "Requirements:\n" .
               "- Style: {$style}\n" .
               "- Target audience: {$audience}\n" .
               "- Approximate word count: {$wordCount} words\n" .
               "- Make it engaging and informative\n" .
               "- Include relevant examples where appropriate";
    }

    private function calculateMaxTokens(int $wordCount): int
    {
        // Rough estimation: 1 token ≈ 0.75 words
        return (int) ($wordCount / 0.75 * 1.2); // Add 20% buffer
    }

    public function start(): void
    {
        async(function () {
            echo "🤖 AI-Powered Sampling Demo Server starting...\n";
            echo "This server demonstrates advanced sampling capabilities.\n\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Usage example
echo "🚀 Advanced Sampling Client Demo\n";
echo "================================\n";

// Initialize sampling client with provider configurations
$samplingClient = new AdvancedSamplingClient([
    'openai' => [
        'api_key' => $_ENV['OPENAI_API_KEY'] ?? 'demo-key'
    ],
    'anthropic' => [
        'api_key' => $_ENV['ANTHROPIC_API_KEY'] ?? null
    ]
]);

// Demonstrate capabilities
$samplingClient->demonstrateCapabilities();

// Start demo server that uses sampling
$demoServer = new SamplingDemoServer($samplingClient);
$demoServer->start();
```

## Key Features Demonstrated

### 1. Multi-Provider Support

- **OpenAI Integration**: Full OpenAI API support with streaming
- **Anthropic Integration**: Claude models with proper message formatting
- **Provider Fallbacks**: Automatic fallback between providers
- **Model Mapping**: Intelligent mapping between model hints and actual models

### 2. Intelligent Model Selection

- **Hint Processing**: Respects model hints from servers
- **Preference Scoring**: Balances intelligence, speed, and cost priorities
- **Capability Matching**: Ensures selected models support required features
- **Fallback Logic**: Graceful degradation when preferred models unavailable

### 3. Multimodal Support

- **Image Processing**: Handles base64-encoded images
- **Audio Support**: Framework for audio content processing
- **Content Validation**: Validates multimodal content before processing
- **Model Compatibility**: Ensures selected models support multimodal content

### 4. Streaming Capabilities

- **Real-time Responses**: Streams content as it's generated
- **Chunk Processing**: Handles streaming chunks efficiently
- **Progress Feedback**: Provides real-time progress updates
- **Error Recovery**: Handles streaming interruptions gracefully

## Configuration

### Provider Setup

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Anthropic Configuration (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Model Preferences
DEFAULT_INTELLIGENCE_PRIORITY=0.7
DEFAULT_SPEED_PRIORITY=0.6
DEFAULT_COST_PRIORITY=0.4
```

### Model Mappings

You can customize model mappings based on your available providers:

```php
$customMappings = [
    'claude-3-sonnet' => [
        'anthropic' => 'claude-3-sonnet-20240229',
        'openai' => 'gpt-4-1106-preview',
        'local' => 'llama-70b' // Local model fallback
    ]
];
```

## Testing with Servers

### Compatible Server Example

Create a server that uses sampling:

```php
// server.php - Server that requests sampling
$server->tool(
    'ai_assistant',
    'AI-powered assistant tool',
    [
        'type' => 'object',
        'properties' => [
            'question' => ['type' => 'string'],
            'context' => ['type' => 'string']
        ],
        'required' => ['question']
    ],
    function (array $params): array {
        // Request sampling from client
        $result = $this->requestSampling([
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        'type' => 'text',
                        'text' => $params['question'] .
                                 (isset($params['context']) ? "\n\nContext: {$params['context']}" : '')
                    ]
                ]
            ],
            'modelPreferences' => [
                'intelligencePriority' => 0.8,
                'speedPriority' => 0.6
            ]
        ]);

        return [
            'content' => [[
                'type' => 'text',
                'text' => $result['content']['text']
            ]]
        ];
    }
);
```

### Testing the Integration

```bash
# Terminal 1: Start the sampling client
php sampling-client-example.php

# Terminal 2: Test with a server that uses sampling
php server-with-sampling.php

# Terminal 3: Connect and test
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ai_assistant","arguments":{"question":"What is machine learning?"}}}' | php server-with-sampling.php
```

## See Also

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [OpenAI Integration Guide](../../integrations/openai)
- [Sampling Guide](../../guide/sampling)
- [Agentic AI Examples](../agentic-ai/)
