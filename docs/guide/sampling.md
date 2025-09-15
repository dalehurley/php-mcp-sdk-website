# Sampling (LLM Integration)

Learn how to implement LLM sampling in MCP clients and servers, enabling AI-powered features with model preferences and multimodal support.

## Overview

Sampling in MCP allows servers to request LLM completions from clients, enabling agentic behaviors and AI-powered features. Based on the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling), sampling provides:

- **Server-Initiated AI**: Servers can request LLM completions
- **Model Abstraction**: Flexible model selection with preferences
- **Multimodal Support**: Text, image, and audio content
- **User Control**: Clients maintain control over AI access

## Client Implementation

### Declaring Sampling Capability

Clients that support sampling must declare the capability during initialization:

```php
use MCP\Client\Client;
use MCP\Types\Implementation;

$client = new Client(
    new Implementation('ai-client', '1.0.0'),
    [
        'capabilities' => [
            'sampling' => [
                'modelPreferences' => true,
                'multimodal' => true
            ]
        ]
    ]
);
```

### Basic Sampling Handler

```php
class SamplingClient extends Client
{
    private OpenAIClient $openai;
    private array $modelMappings;

    public function __construct(string $openaiApiKey)
    {
        parent::__construct(new Implementation('sampling-client', '1.0.0'));

        $this->openai = OpenAI::client($openaiApiKey);

        // Map MCP model hints to actual models
        $this->modelMappings = [
            'claude-3-sonnet' => 'gpt-4-1106-preview',
            'claude-3-haiku' => 'gpt-3.5-turbo',
            'claude' => 'gpt-4-1106-preview',
            'gpt-4' => 'gpt-4-1106-preview',
            'gpt-3.5' => 'gpt-3.5-turbo'
        ];

        $this->setSamplingHandler([$this, 'handleSamplingRequest']);
    }

    public function handleSamplingRequest(array $request): array
    {
        try {
            // Extract request components
            $messages = $request['messages'] ?? [];
            $modelPreferences = $request['modelPreferences'] ?? [];
            $systemPrompt = $request['systemPrompt'] ?? null;
            $maxTokens = $request['maxTokens'] ?? 1000;

            // Select appropriate model
            $model = $this->selectModel($modelPreferences);

            // Prepare messages for OpenAI
            $openaiMessages = $this->convertMessagesToOpenAI($messages, $systemPrompt);

            // Make OpenAI request
            $response = $this->openai->chat()->create([
                'model' => $model,
                'messages' => $openaiMessages,
                'max_tokens' => $maxTokens,
                'temperature' => $modelPreferences['temperature'] ?? 0.7
            ]);

            $completion = $response->choices[0]->message;

            return [
                'role' => 'assistant',
                'content' => [
                    'type' => 'text',
                    'text' => $completion->content
                ],
                'model' => $model,
                'stopReason' => $this->mapStopReason($response->choices[0]->finishReason)
            ];

        } catch (\Exception $e) {
            throw new McpError(
                ErrorCode::InternalError,
                "Sampling failed: {$e->getMessage()}"
            );
        }
    }

    private function selectModel(array $preferences): string
    {
        $hints = $preferences['hints'] ?? [];
        $intelligencePriority = $preferences['intelligencePriority'] ?? 0.5;
        $speedPriority = $preferences['speedPriority'] ?? 0.5;
        $costPriority = $preferences['costPriority'] ?? 0.5;

        // Try to match hints first
        foreach ($hints as $hint) {
            $hintName = $hint['name'] ?? '';

            foreach ($this->modelMappings as $pattern => $model) {
                if (stripos($hintName, $pattern) !== false) {
                    return $model;
                }
            }
        }

        // Fallback to preference-based selection
        if ($intelligencePriority > 0.7) {
            return 'gpt-4-1106-preview'; // High intelligence
        } elseif ($speedPriority > 0.7) {
            return 'gpt-3.5-turbo'; // High speed
        } elseif ($costPriority > 0.7) {
            return 'gpt-3.5-turbo'; // Low cost
        }

        return 'gpt-4-1106-preview'; // Default
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

    private function mapStopReason(string $openaiReason): string
    {
        return match($openaiReason) {
            'stop' => 'endTurn',
            'length' => 'maxTokens',
            'content_filter' => 'contentFilter',
            default => 'other'
        };
    }
}
```

## Server-Side Sampling

### Requesting Sampling from Server

```php
class SamplingAwareServer
{
    private McpServer $server;
    private SamplingClient $samplingClient;

    public function __construct(SamplingClient $samplingClient)
    {
        $this->server = new McpServer(
            new Implementation('ai-powered-server', '1.0.0')
        );
        $this->samplingClient = $samplingClient;

        $this->registerAiTools();
    }

    private function registerAiTools(): void
    {
        // Tool that uses AI for content generation
        $this->server->tool(
            'generate_content',
            'Generate content using AI',
            [
                'type' => 'object',
                'properties' => [
                    'topic' => [
                        'type' => 'string',
                        'description' => 'Topic to generate content about'
                    ],
                    'style' => [
                        'type' => 'string',
                        'enum' => ['formal', 'casual', 'technical', 'creative'],
                        'default' => 'formal',
                        'description' => 'Writing style'
                    ],
                    'length' => [
                        'type' => 'string',
                        'enum' => ['short', 'medium', 'long'],
                        'default' => 'medium',
                        'description' => 'Content length'
                    ]
                ],
                'required' => ['topic']
            ],
            function (array $params): array {
                $topic = $params['topic'];
                $style = $params['style'] ?? 'formal';
                $length = $params['length'] ?? 'medium';

                // Request AI generation from client
                $samplingResult = $this->requestContentGeneration($topic, $style, $length);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $samplingResult['content']['text']
                    ]]
                ];
            }
        );

        // Tool for AI-powered analysis
        $this->server->tool(
            'analyze_with_ai',
            'Analyze data using AI',
            [
                'type' => 'object',
                'properties' => [
                    'data' => [
                        'type' => 'string',
                        'description' => 'Data to analyze'
                    ],
                    'analysis_type' => [
                        'type' => 'string',
                        'enum' => ['sentiment', 'summary', 'classification', 'insights'],
                        'description' => 'Type of analysis to perform'
                    ]
                ],
                'required' => ['data', 'analysis_type']
            ],
            function (array $params): array {
                $data = $params['data'];
                $analysisType = $params['analysis_type'];

                $samplingResult = $this->requestDataAnalysis($data, $analysisType);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $samplingResult['content']['text']
                    ]]
                ];
            }
        );

        // Tool for multimodal AI processing
        $this->server->tool(
            'analyze_image',
            'Analyze image content using AI',
            [
                'type' => 'object',
                'properties' => [
                    'image_data' => [
                        'type' => 'string',
                        'description' => 'Base64-encoded image data'
                    ],
                    'mime_type' => [
                        'type' => 'string',
                        'enum' => ['image/jpeg', 'image/png', 'image/gif'],
                        'description' => 'Image MIME type'
                    ],
                    'analysis_focus' => [
                        'type' => 'string',
                        'description' => 'What to focus on in the analysis'
                    ]
                ],
                'required' => ['image_data', 'mime_type']
            ],
            function (array $params): array {
                $imageData = $params['image_data'];
                $mimeType = $params['mime_type'];
                $focus = $params['analysis_focus'] ?? 'general description';

                $samplingResult = $this->requestImageAnalysis($imageData, $mimeType, $focus);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $samplingResult['content']['text']
                    ]]
                ];
            }
        );
    }

    private function requestContentGeneration(string $topic, string $style, string $length): array
    {
        $lengthInstructions = [
            'short' => 'Write a brief, concise piece (1-2 paragraphs)',
            'medium' => 'Write a moderate-length piece (3-5 paragraphs)',
            'long' => 'Write a comprehensive, detailed piece (6+ paragraphs)'
        ];

        $styleInstructions = [
            'formal' => 'Use formal, professional language',
            'casual' => 'Use casual, conversational language',
            'technical' => 'Use technical language with precise terminology',
            'creative' => 'Use creative, engaging language with vivid descriptions'
        ];

        return $this->samplingClient->requestSampling([
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        'type' => 'text',
                        'text' => "Write content about: {$topic}\n\n" .
                                 "Style: {$styleInstructions[$style]}\n" .
                                 "Length: {$lengthInstructions[$length]}"
                    ]
                ]
            ],
            'modelPreferences' => [
                'intelligencePriority' => 0.8,
                'speedPriority' => 0.4,
                'costPriority' => 0.3
            ],
            'systemPrompt' => 'You are a professional content writer. Create engaging, well-structured content.',
            'maxTokens' => $length === 'long' ? 1500 : ($length === 'medium' ? 800 : 400)
        ])->await();
    }

    private function requestImageAnalysis(string $imageData, string $mimeType, string $focus): array
    {
        return $this->samplingClient->requestMultimodalSampling([
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => "Please analyze this image, focusing on: {$focus}"
                        ],
                        [
                            'type' => 'image',
                            'data' => $imageData,
                            'mimeType' => $mimeType
                        ]
                    ]
                ]
            ],
            'modelPreferences' => [
                'hints' => [
                    ['name' => 'gpt-4-vision'],
                    ['name' => 'claude-3-sonnet']
                ],
                'intelligencePriority' => 0.9 // Need vision capabilities
            ],
            'systemPrompt' => 'You are an expert image analyst. Provide detailed, accurate descriptions.',
            'maxTokens' => 500
        ])->await();
    }
}
```

## Advanced Sampling Patterns

### Streaming Sampling

```php
class StreamingSamplingClient extends Client
{
    public function requestStreamingSampling(array $request, callable $onChunk): Promise
    {
        return async(function () use ($request, $onChunk) {
            // Convert to streaming OpenAI request
            $stream = $this->openai->chat()->createStreamed([
                'model' => $this->selectModel($request['modelPreferences'] ?? []),
                'messages' => $this->convertMessages($request['messages']),
                'max_tokens' => $request['maxTokens'] ?? 1000
            ]);

            $fullContent = '';

            foreach ($stream as $response) {
                $delta = $response->choices[0]->delta;

                if (isset($delta->content)) {
                    $chunk = [
                        'type' => 'content',
                        'content' => $delta->content
                    ];

                    $fullContent .= $delta->content;
                    $onChunk($chunk);
                }
            }

            return [
                'role' => 'assistant',
                'content' => [
                    'type' => 'text',
                    'text' => $fullContent
                ],
                'model' => $this->selectModel($request['modelPreferences'] ?? []),
                'stopReason' => 'endTurn'
            ];
        });
    }
}
```

### Conversation Management

```php
class ConversationSamplingClient extends Client
{
    private array $conversations = [];

    public function startConversation(string $conversationId, ?string $systemPrompt = null): void
    {
        $this->conversations[$conversationId] = [
            'messages' => [],
            'system_prompt' => $systemPrompt,
            'created_at' => time()
        ];

        if ($systemPrompt) {
            $this->conversations[$conversationId]['messages'][] = [
                'role' => 'system',
                'content' => ['type' => 'text', 'text' => $systemPrompt]
            ];
        }
    }

    public function continueConversation(
        string $conversationId,
        string $userMessage,
        array $modelPreferences = []
    ): array {
        if (!isset($this->conversations[$conversationId])) {
            throw new \InvalidArgumentException("Conversation not found: {$conversationId}");
        }

        // Add user message to conversation
        $this->conversations[$conversationId]['messages'][] = [
            'role' => 'user',
            'content' => ['type' => 'text', 'text' => $userMessage]
        ];

        // Request sampling with full conversation context
        $result = $this->requestSampling([
            'messages' => $this->conversations[$conversationId]['messages'],
            'modelPreferences' => $modelPreferences,
            'maxTokens' => 1000
        ])->await();

        // Add assistant response to conversation
        $this->conversations[$conversationId]['messages'][] = [
            'role' => 'assistant',
            'content' => $result['content']
        ];

        return $result;
    }

    public function getConversationHistory(string $conversationId): array
    {
        return $this->conversations[$conversationId] ?? null;
    }
}
```

## Model Preference Strategies

### Intelligent Model Selection

```php
class IntelligentModelSelector
{
    private array $modelCapabilities;
    private array $modelCosts;
    private array $modelSpeeds;

    public function __construct()
    {
        // Define model characteristics
        $this->modelCapabilities = [
            'gpt-4-1106-preview' => 0.95,
            'gpt-4' => 0.90,
            'gpt-3.5-turbo' => 0.75,
            'claude-3-sonnet' => 0.92,
            'claude-3-haiku' => 0.80
        ];

        $this->modelCosts = [
            'gpt-4-1106-preview' => 0.9,
            'gpt-4' => 1.0,
            'gpt-3.5-turbo' => 0.1,
            'claude-3-sonnet' => 0.8,
            'claude-3-haiku' => 0.3
        ];

        $this->modelSpeeds = [
            'gpt-4-1106-preview' => 0.7,
            'gpt-4' => 0.6,
            'gpt-3.5-turbo' => 0.95,
            'claude-3-sonnet' => 0.8,
            'claude-3-haiku' => 0.9
        ];
    }

    public function selectOptimalModel(array $preferences): string
    {
        $intelligencePriority = $preferences['intelligencePriority'] ?? 0.5;
        $speedPriority = $preferences['speedPriority'] ?? 0.5;
        $costPriority = $preferences['costPriority'] ?? 0.5;

        $bestModel = null;
        $bestScore = -1;

        foreach ($this->modelCapabilities as $model => $capability) {
            $score = 0;

            // Intelligence score (higher capability = higher score)
            $score += $intelligencePriority * $capability;

            // Speed score (higher speed = higher score)
            $score += $speedPriority * $this->modelSpeeds[$model];

            // Cost score (lower cost = higher score)
            $score += $costPriority * (1 - $this->modelCosts[$model]);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestModel = $model;
            }
        }

        return $bestModel ?? 'gpt-3.5-turbo';
    }
}
```

### Context-Aware Sampling

```php
class ContextAwareSamplingServer
{
    private McpServer $server;
    private ConversationManager $conversationManager;

    public function __construct()
    {
        $this->server = new McpServer(
            new Implementation('context-ai-server', '1.0.0')
        );
        $this->conversationManager = new ConversationManager();

        $this->registerContextualTools();
    }

    private function registerContextualTools(): void
    {
        $this->server->tool(
            'smart_response',
            'Generate contextually appropriate response',
            [
                'type' => 'object',
                'properties' => [
                    'user_input' => ['type' => 'string'],
                    'conversation_id' => ['type' => 'string'],
                    'context_type' => [
                        'type' => 'string',
                        'enum' => ['support', 'sales', 'technical', 'general'],
                        'default' => 'general'
                    ]
                ],
                'required' => ['user_input']
            ],
            function (array $params): array {
                $userInput = $params['user_input'];
                $conversationId = $params['conversation_id'] ?? uniqid('conv_');
                $contextType = $params['context_type'] ?? 'general';

                // Get conversation context
                $context = $this->conversationManager->getContext($conversationId);

                // Build context-aware prompt
                $systemPrompt = $this->buildContextPrompt($contextType, $context);

                // Prepare messages with context
                $messages = $context['messages'] ?? [];
                $messages[] = [
                    'role' => 'user',
                    'content' => ['type' => 'text', 'text' => $userInput]
                ];

                // Request sampling with appropriate model preferences
                $modelPreferences = $this->getModelPreferencesForContext($contextType);

                $result = $this->samplingClient->requestSampling([
                    'messages' => $messages,
                    'systemPrompt' => $systemPrompt,
                    'modelPreferences' => $modelPreferences,
                    'maxTokens' => 500
                ])->await();

                // Update conversation context
                $this->conversationManager->addMessage($conversationId, 'user', $userInput);
                $this->conversationManager->addMessage($conversationId, 'assistant', $result['content']['text']);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $result['content']['text']
                    ]]
                ];
            }
        );
    }

    private function buildContextPrompt(string $contextType, array $context): string
    {
        $basePrompts = [
            'support' => 'You are a helpful customer support agent. Be empathetic, solution-focused, and professional.',
            'sales' => 'You are a knowledgeable sales assistant. Be helpful, informative, and focus on customer needs.',
            'technical' => 'You are a technical expert. Provide accurate, detailed technical information and solutions.',
            'general' => 'You are a helpful assistant. Be friendly, informative, and adapt to the user\'s needs.'
        ];

        $prompt = $basePrompts[$contextType] ?? $basePrompts['general'];

        // Add context from conversation history
        if (!empty($context['summary'])) {
            $prompt .= "\n\nConversation context: {$context['summary']}";
        }

        return $prompt;
    }

    private function getModelPreferencesForContext(string $contextType): array
    {
        return match($contextType) {
            'technical' => [
                'intelligencePriority' => 0.9,
                'speedPriority' => 0.3,
                'costPriority' => 0.2
            ],
            'support' => [
                'intelligencePriority' => 0.7,
                'speedPriority' => 0.8,
                'costPriority' => 0.4
            ],
            'sales' => [
                'intelligencePriority' => 0.8,
                'speedPriority' => 0.7,
                'costPriority' => 0.3
            ],
            default => [
                'intelligencePriority' => 0.6,
                'speedPriority' => 0.6,
                'costPriority' => 0.5
            ]
        };
    }
}
```

## Error Handling

### Sampling Error Management

```php
class RobustSamplingClient extends Client
{
    private int $maxRetries = 3;
    private array $fallbackModels = ['gpt-3.5-turbo', 'gpt-4'];

    public function requestSamplingWithFallback(array $request): Promise
    {
        return async(function () use ($request) {
            $attempt = 0;
            $lastError = null;

            while ($attempt < $this->maxRetries) {
                try {
                    return $this->requestSampling($request)->await();

                } catch (McpError $e) {
                    $lastError = $e;
                    $attempt++;

                    // Try fallback model if primary model fails
                    if ($attempt < $this->maxRetries && isset($this->fallbackModels[$attempt - 1])) {
                        $request['modelPreferences']['hints'] = [
                            ['name' => $this->fallbackModels[$attempt - 1]]
                        ];

                        echo "⚠️ Sampling failed, trying fallback model: {$this->fallbackModels[$attempt - 1]}\n";
                        continue;
                    }

                    // Exponential backoff for retryable errors
                    if ($this->isRetryableError($e)) {
                        $delay = pow(2, $attempt) * 1000;
                        delay($delay)->await();
                        continue;
                    }

                    throw $e;
                }
            }

            throw $lastError ?? new McpError(
                ErrorCode::InternalError,
                'Sampling failed after all retries'
            );
        });
    }

    private function isRetryableError(McpError $e): bool
    {
        return in_array($e->getCode(), [
            ErrorCode::InternalError,
            ErrorCode::RequestTimeout,
            ErrorCode::ServiceUnavailable
        ]);
    }
}
```

## Testing

### Sampling Tests

```php
class SamplingTest extends TestCase
{
    private SamplingClient $client;
    private MockLLMProvider $mockProvider;

    protected function setUp(): void
    {
        $this->mockProvider = new MockLLMProvider();
        $this->client = new SamplingClient($this->mockProvider);
    }

    public function testBasicSampling(): void
    {
        $this->mockProvider->setResponse('Hello, how can I help you?');

        $result = $this->client->requestSampling([
            'messages' => [
                [
                    'role' => 'user',
                    'content' => ['type' => 'text', 'text' => 'Hello']
                ]
            ]
        ])->await();

        $this->assertEquals('Hello, how can I help you?', $result['content']['text']);
    }

    public function testModelPreferences(): void
    {
        $this->client->requestSampling([
            'messages' => [['role' => 'user', 'content' => ['type' => 'text', 'text' => 'Test']]],
            'modelPreferences' => [
                'hints' => [['name' => 'gpt-4']],
                'intelligencePriority' => 0.9
            ]
        ])->await();

        $this->assertEquals('gpt-4-1106-preview', $this->mockProvider->getLastUsedModel());
    }
}
```

## Best Practices

### 1. Model Selection

- **Use appropriate hints** based on task requirements
- **Set realistic priorities** for intelligence, speed, and cost
- **Implement fallback models** for reliability
- **Cache model selections** for similar requests

### 2. Content Handling

- **Validate content types** before processing
- **Handle multimodal content** appropriately
- **Implement content filtering** for safety
- **Manage content size limits** efficiently

### 3. Error Handling

- **Implement retry logic** for transient failures
- **Use fallback models** when primary models fail
- **Handle rate limits** gracefully
- **Log sampling errors** for debugging

### 4. Security

- **Validate all sampling requests** from servers
- **Implement user approval** for sensitive requests
- **Monitor sampling usage** for abuse
- **Sanitize content** before and after processing

## See Also

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [OpenAI Integration](../integrations/openai)
- [Agentic AI Guide](../agentic-ai/)
- [Client API Reference](../api/client)
