# OpenAI Integration

AI-powered tool calling with function calling support, streaming responses, and intelligent tool orchestration.

## Overview

The PHP MCP SDK integrates seamlessly with OpenAI's API to create intelligent agents that can:

- Dynamically discover and use MCP tools
- Process natural language requests
- Chain multiple tool calls intelligently
- Handle complex workflows with AI reasoning

## Installation

```bash
composer require dalehurley/php-mcp-sdk
composer require openai-php/client
```

## Basic OpenAI + MCP Integration

### Simple Agent

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use OpenAI\Client as OpenAIClient;
use MCP\Client\Client as McpClient;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

class OpenAIMcpAgent
{
    private OpenAIClient $openai;
    private McpClient $mcpClient;
    private array $availableTools = [];

    public function __construct(string $openaiApiKey, array $mcpServerConfig)
    {
        $this->openai = OpenAI::client($openaiApiKey);
        $this->mcpClient = new McpClient(new Implementation('openai-agent', '1.0.0'));

        $this->connectToMcpServer($mcpServerConfig);
        $this->discoverTools();
    }

    private function connectToMcpServer(array $config): void
    {
        async(function () use ($config) {
            $transport = new StdioClientTransport([
                'command' => $config['command'],
                'args' => $config['args']
            ]);

            $this->mcpClient->connect($transport)->await();

            // Discover available tools
            $toolsResult = $this->mcpClient->listTools()->await();

            foreach ($toolsResult['tools'] as $tool) {
                $this->availableTools[$tool['name']] = [
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'parameters' => $tool['inputSchema']
                ];
            }
        })->await();
    }

    public function processRequest(string $userMessage): string
    {
        // Convert MCP tools to OpenAI function format
        $functions = $this->convertMcpToolsToOpenAIFunctions();

        $response = $this->openai->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are an AI assistant with access to various tools through MCP. Use the available tools to help the user accomplish their goals.'
                ],
                [
                    'role' => 'user',
                    'content' => $userMessage
                ]
            ],
            'functions' => $functions,
            'function_call' => 'auto'
        ]);

        $message = $response->choices[0]->message;

        // Handle function calls
        if (isset($message->functionCall)) {
            return $this->handleFunctionCall($message);
        }

        return $message->content ?? 'No response generated.';
    }

    private function convertMcpToolsToOpenAIFunctions(): array
    {
        $functions = [];

        foreach ($this->availableTools as $tool) {
            $functions[] = [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'parameters' => $tool['parameters']
            ];
        }

        return $functions;
    }

    private function handleFunctionCall($message): string
    {
        $functionName = $message->functionCall->name;
        $arguments = json_decode($message->functionCall->arguments, true);

        try {
            // Call the MCP tool
            $result = async(function () use ($functionName, $arguments) {
                return $this->mcpClient->callTool($functionName, $arguments)->await();
            })->await();

            // Format the result for the user
            $toolResult = $result['content'][0]['text'] ?? 'Tool executed successfully';

            // Send result back to OpenAI for final formatting
            $followUpResponse = $this->openai->chat()->create([
                'model' => 'gpt-4.1',
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Format the tool result in a helpful way for the user.'
                    ],
                    [
                        'role' => 'function',
                        'name' => $functionName,
                        'content' => $toolResult
                    ]
                ]
            ]);

            return $followUpResponse->choices[0]->message->content;

        } catch (\Exception $e) {
            return "Error executing tool '{$functionName}': {$e->getMessage()}";
        }
    }
}

// Usage example
$agent = new OpenAIMcpAgent(
    $_ENV['OPENAI_API_KEY'],
    [
        'command' => 'php',
        'args' => ['weather-server.php']
    ]
);

$response = $agent->processRequest("What's the weather like in London?");
echo $response . "\n";
```

## Advanced Agent with Multiple MCP Servers

```php
class MultiServerOpenAIAgent
{
    private OpenAIClient $openai;
    private array $mcpClients = [];
    private array $allTools = [];

    public function __construct(string $openaiApiKey, array $serverConfigs)
    {
        $this->openai = OpenAI::client($openaiApiKey);

        foreach ($serverConfigs as $serverId => $config) {
            $this->connectToServer($serverId, $config);
        }
    }

    private function connectToServer(string $serverId, array $config): void
    {
        async(function () use ($serverId, $config) {
            $client = new McpClient(new Implementation('multi-agent', '1.0.0'));
            $transport = new StdioClientTransport($config);

            $client->connect($transport)->await();
            $this->mcpClients[$serverId] = $client;

            // Discover tools from this server
            $toolsResult = $client->listTools()->await();

            foreach ($toolsResult['tools'] as $tool) {
                $this->allTools["{$serverId}:{$tool['name']}"] = [
                    'server_id' => $serverId,
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'parameters' => $tool['inputSchema']
                ];
            }
        })->await();
    }

    public function processComplexRequest(string $userMessage): string
    {
        // Convert all MCP tools to OpenAI functions
        $functions = [];
        foreach ($this->allTools as $toolKey => $tool) {
            $functions[] = [
                'name' => $toolKey, // Use server:tool format
                'description' => "{$tool['description']} (from {$tool['server_id']} server)",
                'parameters' => $tool['parameters']
            ];
        }

        $messages = [
            [
                'role' => 'system',
                'content' => 'You are an AI assistant with access to multiple specialized servers through MCP. You can use tools from different servers to accomplish complex tasks. Each tool name includes the server it comes from (server:tool).'
            ],
            [
                'role' => 'user',
                'content' => $userMessage
            ]
        ];

        // Initial OpenAI call
        $response = $this->openai->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => $messages,
            'functions' => $functions,
            'function_call' => 'auto'
        ]);

        // Handle multiple function calls if needed
        $conversationHistory = $messages;
        $conversationHistory[] = $response->choices[0]->message->toArray();

        while (isset($response->choices[0]->message->functionCall)) {
            $functionCall = $response->choices[0]->message->functionCall;
            $toolResult = $this->executeMcpTool($functionCall->name, $functionCall->arguments);

            // Add function result to conversation
            $conversationHistory[] = [
                'role' => 'function',
                'name' => $functionCall->name,
                'content' => $toolResult
            ];

            // Continue conversation with OpenAI
            $response = $this->openai->chat()->create([
                'model' => 'gpt-4.1',
                'messages' => $conversationHistory,
                'functions' => $functions,
                'function_call' => 'auto'
            ]);

            $conversationHistory[] = $response->choices[0]->message->toArray();
        }

        return $response->choices[0]->message->content ?? 'Task completed.';
    }

    private function executeMcpTool(string $toolKey, string $argumentsJson): string
    {
        [$serverId, $toolName] = explode(':', $toolKey, 2);
        $arguments = json_decode($argumentsJson, true);

        if (!isset($this->mcpClients[$serverId])) {
            return "Error: Server '{$serverId}' not available";
        }

        try {
            $result = async(function () use ($serverId, $toolName, $arguments) {
                return $this->mcpClients[$serverId]->callTool($toolName, $arguments)->await();
            })->await();

            return $result['content'][0]['text'] ?? 'Tool executed successfully';

        } catch (\Exception $e) {
            return "Error executing {$toolKey}: {$e->getMessage()}";
        }
    }
}
```

## Streaming Integration

### Streaming Chat with MCP Tools

```php
class StreamingMcpAgent
{
    public function streamResponse(string $userMessage, callable $onChunk): void
    {
        $stream = $this->openai->chat()->createStreamed([
            'model' => 'gpt-4.1',
            'messages' => [
                ['role' => 'user', 'content' => $userMessage]
            ],
            'functions' => $this->getFunctions(),
            'function_call' => 'auto'
        ]);

        foreach ($stream as $response) {
            $delta = $response->choices[0]->delta;

            if (isset($delta->content)) {
                $onChunk(['type' => 'content', 'data' => $delta->content]);
            }

            if (isset($delta->functionCall)) {
                $onChunk(['type' => 'function_call', 'data' => $delta->functionCall]);

                // Execute MCP tool and continue stream
                $toolResult = $this->executeMcpTool($delta->functionCall);
                $onChunk(['type' => 'tool_result', 'data' => $toolResult]);
            }
        }
    }
}
```

## Error Handling

### OpenAI + MCP Error Handling

```php
try {
    $response = $agent->processRequest($userMessage);
    echo $response;
} catch (\OpenAI\Exceptions\ErrorException $e) {
    echo "OpenAI API Error: {$e->getMessage()}\n";
} catch (\MCP\Types\McpError $e) {
    echo "MCP Error: {$e->getMessage()}\n";
} catch (\Exception $e) {
    echo "General Error: {$e->getMessage()}\n";
}
```

## Best Practices

### 1. Function Descriptions

- Write clear, specific function descriptions
- Include examples in descriptions
- Specify parameter requirements clearly
- Indicate expected return formats

### 2. Error Handling

- Handle both OpenAI and MCP errors gracefully
- Provide meaningful error messages to users
- Implement retry logic for transient failures
- Log errors for debugging

### 3. Performance

- Cache OpenAI responses when appropriate
- Use streaming for long responses
- Implement request timeouts
- Monitor token usage and costs

### 4. Security

- Validate all tool parameters
- Implement proper authentication
- Sanitize user inputs
- Audit tool usage for security

## Complete Example

See the [OpenAI MCP Agent example](https://github.com/dalehurley/php-mcp-sdk/tree/main/examples/client/openai-mcp-agent.php) for a complete, working implementation.

## See Also

- [OpenAI PHP Client](https://github.com/openai-php/client)
- [MCP Client API](../api/client)
- [Agentic AI Guide](../agentic-ai/)
- [Examples](../examples/)
