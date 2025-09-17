# Laravel + OpenAI Integration for Agentic Workflows

Complete guide to integrating Laravel MCP SDK with OpenAI for true agentic AI workflows, including tool calling, conversation management, and production optimization.

## Overview

This integration combines:

- **Laravel MCP SDK** - Access to tools, resources, and prompts via MCP
- **OpenAI PHP Laravel** - AI model interactions with tool calling
- **Agentic Workflows** - AI agents that can autonomously use tools to solve problems

## Installation and Setup

### Install Required Packages

```bash
# Install Laravel MCP SDK
composer require dalehurley/laravel-php-mcp-sdk

# Install OpenAI PHP Laravel
composer require openai-php/laravel

# Install OpenAI package
php artisan openai:install
```

### Environment Configuration

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION=org-...
OPENAI_PROJECT=proj_...

# MCP Configuration
MCP_OPENAI_CLIENT_URL=http://localhost:3001
MCP_OPENAI_CLIENT_TIMEOUT=120
```

## Core Agentic Service Implementation

### AgenticWorkflowService

```php
<?php

namespace App\Services;

use OpenAI\Laravel\Facades\OpenAI;
use MCP\Laravel\Facades\McpClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AgenticWorkflowService
{
    private string $mcpClient;
    private array $availableTools = [];
    private array $conversationHistory = [];
    private array $executionContext = [];

    public function __construct(string $mcpClient = 'openai_integration')
    {
        $this->mcpClient = $mcpClient;
        $this->loadAvailableTools();
    }

    /**
     * Execute an agentic workflow with tool calling
     */
    public function executeWorkflow(
        string $userQuery,
        array $context = [],
        array $options = []
    ): array {
        $this->executionContext = [
            'start_time' => microtime(true),
            'user_query' => $userQuery,
            'context' => $context,
            'options' => $options,
            'tool_calls' => [],
            'iterations' => 0,
            'max_iterations' => $options['max_iterations'] ?? 10,
        ];

        try {
            // Step 1: Get available MCP tools and convert to OpenAI format
            $openaiTools = $this->convertMcpToolsToOpenAI();

            // Step 2: Build conversation with context
            $messages = $this->buildConversationMessages($userQuery, $context);

            // Step 3: Execute iterative workflow with tool calling
            return $this->executeIterativeWorkflow($messages, $openaiTools, $options);

        } catch (\Exception $e) {
            Log::error('Agentic workflow failed', [
                'error' => $e->getMessage(),
                'user_query' => $userQuery,
                'context' => $this->executionContext,
            ]);

            return $this->buildErrorResponse($e);
        }
    }

    /**
     * Execute iterative workflow with multiple tool calls
     */
    private function executeIterativeWorkflow(array $messages, array $tools, array $options): array
    {
        $maxIterations = $options['max_iterations'] ?? 10;
        $temperature = $options['temperature'] ?? 0.7;
        $model = $options['model'] ?? 'gpt-4';

        for ($iteration = 0; $iteration < $maxIterations; $iteration++) {
            $this->executionContext['iterations'] = $iteration + 1;

            // Make OpenAI call with tools
            $response = OpenAI::chat()->create([
                'model' => $model,
                'messages' => $messages,
                'tools' => $tools,
                'tool_choice' => $iteration === 0 ? 'auto' : 'auto',
                'temperature' => $temperature,
                'max_tokens' => $options['max_tokens'] ?? 4000,
            ]);

            $choice = $response->choices[0];
            $assistantMessage = $choice->message;

            // Add assistant message to conversation
            $messages[] = [
                'role' => 'assistant',
                'content' => $assistantMessage->content,
                'tool_calls' => $assistantMessage->toolCalls ?? null,
            ];

            // If no tool calls, we're done
            if (empty($assistantMessage->toolCalls)) {
                return $this->buildSuccessResponse($assistantMessage->content, $response);
            }

            // Execute tool calls and add results
            $toolResults = $this->executeToolCalls($assistantMessage->toolCalls);

            foreach ($toolResults as $toolResult) {
                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $toolResult['tool_call_id'],
                    'content' => json_encode($toolResult['result']),
                ];
            }

            // Check if we should continue
            if ($this->shouldStopIteration($toolResults, $iteration)) {
                break;
            }
        }

        // Final response after all iterations
        $finalResponse = OpenAI::chat()->create([
            'model' => $model,
            'messages' => array_merge($messages, [
                ['role' => 'user', 'content' => 'Please provide a comprehensive summary of what you accomplished.']
            ]),
            'temperature' => $temperature,
        ]);

        return $this->buildSuccessResponse(
            $finalResponse->choices[0]->message->content,
            $finalResponse,
            $this->executionContext['tool_calls']
        );
    }

    /**
     * Load and cache available MCP tools
     */
    private function loadAvailableTools(): void
    {
        $cacheKey = "mcp_tools_{$this->mcpClient}";

        $this->availableTools = Cache::remember($cacheKey, 300, function () {
            try {
                if (!McpClient::isConnected($this->mcpClient)) {
                    McpClient::connect(
                        $this->mcpClient,
                        config('mcp.clients.openai_integration.server_url', 'http://localhost:3001')
                    );
                }

                $tools = McpClient::listTools($this->mcpClient);

                // Enhance tools with metadata for better AI understanding
                return array_map(function ($tool) {
                    return $this->enhanceToolMetadata($tool);
                }, $tools);

            } catch (\Exception $e) {
                Log::warning('Failed to load MCP tools', ['error' => $e->getMessage()]);
                return [];
            }
        });
    }

    /**
     * Enhance tool metadata for better AI understanding
     */
    private function enhanceToolMetadata(array $tool): array
    {
        // Add examples and usage hints
        $enhanced = $tool;

        // Add common examples based on tool type
        if (str_contains($tool['name'], 'database')) {
            $enhanced['examples'] = [
                'Get user data: {"query": "SELECT * FROM users WHERE id = ?", "bindings": [123]}',
                'Count records: {"query": "SELECT COUNT(*) FROM orders WHERE created_at > ?", "bindings": ["2024-01-01"]}'
            ];
        } elseif (str_contains($tool['name'], 'file')) {
            $enhanced['examples'] = [
                'Analyze file: {"file_path": "data/sample.csv", "operation": "analyze"}',
                'Process file: {"file_path": "uploads/document.pdf", "operation": "extract_text"}'
            ];
        }

        // Add usage hints
        $enhanced['usage_hints'] = $this->generateUsageHints($tool);

        return $enhanced;
    }

    /**
     * Convert MCP tools to OpenAI function calling format
     */
    private function convertMcpToolsToOpenAI(): array
    {
        return array_map(function ($tool) {
            $description = $tool['description'];

            // Enhance description with examples if available
            if (isset($tool['examples'])) {
                $description .= "\n\nExamples:\n" . implode("\n", $tool['examples']);
            }

            if (isset($tool['usage_hints'])) {
                $description .= "\n\nUsage hints: " . $tool['usage_hints'];
            }

            return [
                'type' => 'function',
                'function' => [
                    'name' => $tool['name'],
                    'description' => $description,
                    'parameters' => $this->convertMcpSchemaToOpenAI($tool['inputSchema'] ?? []),
                ],
            ];
        }, $this->availableTools);
    }

    /**
     * Convert MCP JSON schema to OpenAI parameters format
     */
    private function convertMcpSchemaToOpenAI(array $schema): array
    {
        if (empty($schema)) {
            return ['type' => 'object', 'properties' => []];
        }

        // MCP uses JSON Schema, which is mostly compatible with OpenAI
        // But we might need to add some enhancements
        $converted = $schema;

        // Ensure required fields are properly formatted
        if (isset($converted['properties'])) {
            foreach ($converted['properties'] as $prop => $def) {
                // Add examples to properties for better AI understanding
                if (!isset($def['description']) && isset($def['type'])) {
                    $converted['properties'][$prop]['description'] = "A {$def['type']} value";
                }
            }
        }

        return $converted;
    }

    /**
     * Build conversation messages with context
     */
    private function buildConversationMessages(string $userQuery, array $context): array
    {
        $messages = [
            [
                'role' => 'system',
                'content' => $this->buildSystemPrompt($context),
            ]
        ];

        // Add conversation history if available
        if (!empty($this->conversationHistory)) {
            $messages = array_merge($messages, $this->conversationHistory);
        }

        // Add current user query
        $messages[] = [
            'role' => 'user',
            'content' => $userQuery,
        ];

        return $messages;
    }

    /**
     * Build comprehensive system prompt
     */
    private function buildSystemPrompt(array $context): string
    {
        $toolsList = implode("\n", array_map(function ($tool) {
            $desc = "- **{$tool['name']}**: {$tool['description']}";
            if (isset($tool['usage_hints'])) {
                $desc .= " ({$tool['usage_hints']})";
            }
            return $desc;
        }, $this->availableTools));

        $contextInfo = !empty($context) ? "\n\n**Context**: " . json_encode($context, JSON_PRETTY_PRINT) : '';

        return "You are an advanced AI assistant with access to the following tools through the Model Context Protocol (MCP):

{$toolsList}

**Your Capabilities:**
- Execute multiple tool calls in sequence to solve complex problems
- Analyze data, perform calculations, access databases, process files
- Provide comprehensive responses based on tool results
- Handle errors gracefully and suggest alternatives

**Guidelines:**
1. **Tool Usage**: Use tools strategically to gather information and perform actions
2. **Sequential Processing**: Break complex tasks into logical steps
3. **Error Handling**: If a tool fails, try alternatives or explain limitations
4. **Comprehensive Responses**: Combine tool results into helpful, actionable answers
5. **Efficiency**: Use the minimum necessary tools to accomplish the task
6. **Transparency**: Explain what you're doing and why

**Response Format:**
- Be clear about what tools you're using and why
- Provide detailed explanations of results
- Offer actionable insights and recommendations
- Ask clarifying questions if the request is ambiguous{$contextInfo}

Remember: You can call multiple tools to gather comprehensive information before providing your final response.";
    }

    /**
     * Execute tool calls
     */
    private function executeToolCalls(array $toolCalls): array
    {
        $results = [];

        foreach ($toolCalls as $toolCall) {
            $toolResult = $this->executeSingleTool($toolCall);
            $results[] = $toolResult;

            // Track tool calls in execution context
            $this->executionContext['tool_calls'][] = $toolResult;
        }

        return $results;
    }

    /**
     * Execute a single MCP tool call
     */
    private function executeSingleTool($toolCall): array
    {
        $startTime = microtime(true);

        try {
            $toolName = $toolCall->function->name;
            $parameters = json_decode($toolCall->function->arguments, true) ?? [];

            Log::info('Executing MCP tool', [
                'tool' => $toolName,
                'parameters' => $parameters,
                'call_id' => $toolCall->id,
            ]);

            // Execute the tool via MCP client
            $result = McpClient::callTool($this->mcpClient, $toolName, $parameters);
            $executionTime = microtime(true) - $startTime;

            Log::info('MCP tool executed successfully', [
                'tool' => $toolName,
                'execution_time' => $executionTime,
                'call_id' => $toolCall->id,
            ]);

            return [
                'tool_call_id' => $toolCall->id,
                'tool_name' => $toolName,
                'parameters' => $parameters,
                'success' => true,
                'result' => $result,
                'execution_time' => $executionTime,
                'timestamp' => now()->toISOString(),
            ];

        } catch (\Exception $e) {
            $executionTime = microtime(true) - $startTime;

            Log::error('MCP tool execution failed', [
                'tool' => $toolCall->function->name,
                'error' => $e->getMessage(),
                'call_id' => $toolCall->id,
                'execution_time' => $executionTime,
            ]);

            return [
                'tool_call_id' => $toolCall->id,
                'tool_name' => $toolCall->function->name,
                'parameters' => json_decode($toolCall->function->arguments, true) ?? [],
                'success' => false,
                'error' => $e->getMessage(),
                'execution_time' => $executionTime,
                'timestamp' => now()->toISOString(),
            ];
        }
    }

    /**
     * Determine if we should stop iteration
     */
    private function shouldStopIteration(array $toolResults, int $iteration): bool
    {
        // Stop if all tools failed
        $allFailed = array_reduce($toolResults, function ($carry, $result) {
            return $carry && !$result['success'];
        }, true);

        if ($allFailed) {
            Log::warning('Stopping iteration: all tools failed', [
                'iteration' => $iteration,
                'tool_results' => $toolResults,
            ]);
            return true;
        }

        // Stop if we've reached a natural conclusion (could be enhanced with more logic)
        return false;
    }

    /**
     * Build success response
     */
    private function buildSuccessResponse(string $content, $openaiResponse, array $toolCalls = []): array
    {
        $executionTime = microtime(true) - $this->executionContext['start_time'];

        return [
            'success' => true,
            'response' => $content,
            'tool_calls' => $toolCalls,
            'execution_context' => [
                'iterations' => $this->executionContext['iterations'],
                'execution_time' => $executionTime,
                'tools_used' => count($toolCalls),
                'successful_tools' => count(array_filter($toolCalls, fn($t) => $t['success'])),
            ],
            'conversation_history' => $this->conversationHistory,
            'usage' => $openaiResponse->usage->toArray(),
        ];
    }

    /**
     * Build error response
     */
    private function buildErrorResponse(\Exception $e): array
    {
        return [
            'success' => false,
            'error' => $e->getMessage(),
            'fallback_response' => 'I encountered an error while processing your request. Please try again or rephrase your question.',
            'execution_context' => $this->executionContext,
        ];
    }

    /**
     * Generate usage hints for tools
     */
    private function generateUsageHints(array $tool): string
    {
        $hints = [];

        if (isset($tool['inputSchema']['required'])) {
            $required = implode(', ', $tool['inputSchema']['required']);
            $hints[] = "Required: {$required}";
        }

        if (isset($tool['inputSchema']['properties'])) {
            $optional = array_diff(
                array_keys($tool['inputSchema']['properties']),
                $tool['inputSchema']['required'] ?? []
            );
            if (!empty($optional)) {
                $hints[] = "Optional: " . implode(', ', $optional);
            }
        }

        return implode('; ', $hints);
    }

    /**
     * Reset conversation history
     */
    public function resetConversation(): void
    {
        $this->conversationHistory = [];
    }

    /**
     * Get conversation history
     */
    public function getConversationHistory(): array
    {
        return $this->conversationHistory;
    }

    /**
     * Add message to conversation history
     */
    public function addToConversation(string $role, string $content, array $metadata = []): void
    {
        $this->conversationHistory[] = array_merge([
            'role' => $role,
            'content' => $content,
            'timestamp' => now()->toISOString(),
        ], $metadata);
    }
}
```

## Advanced Workflow Patterns

### Multi-Agent Orchestration

```php
<?php

namespace App\Services;

class MultiAgentOrchestrator
{
    private array $agents = [];

    public function __construct()
    {
        $this->agents = [
            'data_analyst' => new DataAnalystAgent(),
            'research_agent' => new ResearchAgent(),
            'decision_maker' => new DecisionMakerAgent(),
        ];
    }

    /**
     * Execute multi-agent workflow
     */
    public function executeCollaborativeWorkflow(string $query, array $context = []): array
    {
        $workflow = [
            'phase_1' => 'data_collection',
            'phase_2' => 'analysis',
            'phase_3' => 'synthesis',
        ];

        $results = [];
        $sharedContext = $context;

        foreach ($workflow as $phase => $agentType) {
            $agent = $this->agents[$agentType];

            $phaseResult = $agent->execute($query, $sharedContext);
            $results[$phase] = $phaseResult;

            // Pass results to next phase
            $sharedContext = array_merge($sharedContext, [
                'previous_phase' => $phase,
                'previous_results' => $phaseResult,
            ]);
        }

        return [
            'success' => true,
            'workflow_results' => $results,
            'final_synthesis' => $this->synthesizeResults($results),
        ];
    }

    private function synthesizeResults(array $results): string
    {
        // Use OpenAI to synthesize all agent results
        return "Synthesized results from multi-agent collaboration...";
    }
}

class DataAnalystAgent
{
    private AgenticWorkflowService $workflow;

    public function __construct()
    {
        $this->workflow = new AgenticWorkflowService('data_analyst_client');
    }

    public function execute(string $query, array $context): array
    {
        $enhancedQuery = "As a data analyst, {$query}. Focus on data gathering and statistical analysis.";

        return $this->workflow->executeWorkflow($enhancedQuery, $context, [
            'max_iterations' => 5,
            'temperature' => 0.3, // More deterministic for analysis
        ]);
    }
}
```

### Conversation Memory Management

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class ConversationMemoryManager
{
    private string $userId;
    private string $conversationId;

    public function __construct(string $userId, string $conversationId = null)
    {
        $this->userId = $userId;
        $this->conversationId = $conversationId ?: uniqid('conv_');
    }

    /**
     * Load conversation history with summarization for long conversations
     */
    public function loadConversationHistory(int $maxMessages = 20): array
    {
        $cacheKey = "conversation:{$this->userId}:{$this->conversationId}";
        $history = Cache::get($cacheKey, []);

        if (count($history) <= $maxMessages) {
            return $history;
        }

        // Summarize older messages to stay within context limits
        return $this->summarizeAndTruncate($history, $maxMessages);
    }

    /**
     * Save conversation message
     */
    public function saveMessage(string $role, string $content, array $metadata = []): void
    {
        $cacheKey = "conversation:{$this->userId}:{$this->conversationId}";
        $history = Cache::get($cacheKey, []);

        $message = [
            'role' => $role,
            'content' => $content,
            'timestamp' => now()->toISOString(),
            'metadata' => $metadata,
        ];

        $history[] = $message;

        // Cache for 24 hours
        Cache::put($cacheKey, $history, 86400);
    }

    /**
     * Summarize old messages to maintain context
     */
    private function summarizeAndTruncate(array $history, int $maxMessages): array
    {
        $keepRecent = array_slice($history, -$maxMessages);
        $toSummarize = array_slice($history, 0, -$maxMessages);

        if (empty($toSummarize)) {
            return $keepRecent;
        }

        // Use OpenAI to create summary
        $summary = $this->createConversationSummary($toSummarize);

        return array_merge([
            [
                'role' => 'system',
                'content' => "Previous conversation summary: {$summary}",
                'timestamp' => now()->toISOString(),
                'metadata' => ['type' => 'summary'],
            ]
        ], $keepRecent);
    }

    private function createConversationSummary(array $messages): string
    {
        $conversationText = implode("\n", array_map(function ($msg) {
            return "{$msg['role']}: {$msg['content']}";
        }, $messages));

        $response = OpenAI::chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Summarize this conversation concisely, preserving key context and decisions.'
                ],
                [
                    'role' => 'user',
                    'content' => $conversationText
                ]
            ],
            'temperature' => 0.3,
            'max_tokens' => 200,
        ]);

        return $response->choices[0]->message->content;
    }
}
```

## Real-World Examples

### Business Intelligence Agent

```php
<?php

namespace App\Http\Controllers;

use App\Services\AgenticWorkflowService;
use Illuminate\Http\Request;

class BusinessIntelligenceController extends Controller
{
    private AgenticWorkflowService $agent;

    public function __construct(AgenticWorkflowService $agent)
    {
        $this->agent = $agent;
    }

    /**
     * Comprehensive business analysis
     */
    public function analyzeBusinessPerformance(Request $request)
    {
        $request->validate([
            'period' => 'required|string',
            'departments' => 'array',
            'metrics' => 'array',
        ]);

        $query = "Analyze our business performance for {$request->period}. " .
                "Include sales data, customer metrics, operational efficiency, and financial health. " .
                "Provide actionable insights and recommendations.";

        $context = [
            'analysis_type' => 'comprehensive_business_review',
            'period' => $request->period,
            'departments' => $request->departments ?? ['sales', 'marketing', 'operations'],
            'metrics' => $request->metrics ?? ['revenue', 'customers', 'efficiency'],
            'user_role' => 'executive',
        ];

        $result = $this->agent->executeWorkflow($query, $context, [
            'max_iterations' => 15,
            'temperature' => 0.4,
            'model' => 'gpt-4',
        ]);

        return response()->json($result);
    }

    /**
     * Customer insight analysis
     */
    public function analyzeCustomerInsights(Request $request)
    {
        $query = "Analyze customer behavior, satisfaction, and lifetime value. " .
                "Identify trends, segments, and opportunities for improvement.";

        $result = $this->agent->executeWorkflow($query, [
            'analysis_type' => 'customer_insights',
            'include_segments' => true,
            'include_predictions' => true,
        ]);

        return response()->json($result);
    }

    /**
     * Competitive analysis
     */
    public function performCompetitiveAnalysis(Request $request)
    {
        $competitors = $request->input('competitors', []);

        $query = "Perform competitive analysis comparing our performance to " .
                implode(', ', $competitors) . ". " .
                "Include market position, strengths, weaknesses, and strategic recommendations.";

        $result = $this->agent->executeWorkflow($query, [
            'analysis_type' => 'competitive_analysis',
            'competitors' => $competitors,
            'focus_areas' => ['market_share', 'pricing', 'features', 'customer_satisfaction'],
        ]);

        return response()->json($result);
    }
}
```

### Code Review Agent

```php
<?php

namespace App\Services;

class CodeReviewAgent
{
    private AgenticWorkflowService $agent;

    public function __construct()
    {
        $this->agent = new AgenticWorkflowService('code_review_client');
    }

    /**
     * Comprehensive code review
     */
    public function reviewCode(string $code, array $options = []): array
    {
        $language = $options['language'] ?? 'php';
        $focus = $options['focus'] ?? 'all';
        $severity = $options['severity'] ?? 'medium';

        $query = "Perform a comprehensive code review of this {$language} code. " .
                "Focus on: {$focus}. " .
                "Severity level: {$severity}. " .
                "Provide specific recommendations and examples.";

        $context = [
            'code' => $code,
            'language' => $language,
            'focus_areas' => $this->getFocusAreas($focus),
            'severity_level' => $severity,
            'review_type' => 'comprehensive',
        ];

        return $this->agent->executeWorkflow($query, $context, [
            'max_iterations' => 8,
            'temperature' => 0.2, // More deterministic for code review
            'model' => 'gpt-4',
        ]);
    }

    /**
     * Security-focused review
     */
    public function securityReview(string $code, string $language = 'php'): array
    {
        $query = "Perform a security-focused code review. " .
                "Identify vulnerabilities, security anti-patterns, and potential attack vectors. " .
                "Provide specific remediation steps.";

        return $this->agent->executeWorkflow($query, [
            'code' => $code,
            'language' => $language,
            'review_type' => 'security',
            'check_for' => [
                'sql_injection',
                'xss',
                'csrf',
                'authentication_bypass',
                'authorization_issues',
                'data_exposure',
            ],
        ]);
    }

    private function getFocusAreas(string $focus): array
    {
        return match ($focus) {
            'security' => ['vulnerabilities', 'input_validation', 'authentication', 'authorization'],
            'performance' => ['algorithms', 'database_queries', 'memory_usage', 'caching'],
            'maintainability' => ['code_structure', 'documentation', 'testing', 'readability'],
            'all' => ['security', 'performance', 'maintainability', 'best_practices'],
            default => ['best_practices'],
        };
    }
}
```

## Frontend Integration

### Vue.js Chat Component with Tool Visualization

```vue
<template>
  <div class="agentic-chat-container">
    <!-- Chat Messages -->
    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-wrapper"
      >
        <div :class="['message', message.role]">
          <!-- Tool Calls Visualization -->
          <div v-if="message.tool_calls" class="tool-calls-section">
            <h5>🔧 Tools Used:</h5>
            <div class="tool-grid">
              <div
                v-for="tool in message.tool_calls"
                :key="tool.tool_call_id"
                :class="['tool-card', tool.success ? 'success' : 'error']"
              >
                <div class="tool-header">
                  <span class="tool-name">{{ tool.tool_name }}</span>
                  <span class="tool-status">
                    {{ tool.success ? "✅" : "❌" }}
                  </span>
                </div>
                <div class="tool-timing">
                  {{ formatDuration(tool.execution_time) }}
                </div>
                <div v-if="!tool.success" class="tool-error">
                  {{ tool.error }}
                </div>
              </div>
            </div>
          </div>

          <!-- Message Content -->
          <div class="message-content">
            <div v-if="message.role === 'assistant'" class="ai-response">
              <div v-html="formatMarkdown(message.content)"></div>
            </div>
            <div v-else class="user-message">
              {{ message.content }}
            </div>
          </div>

          <!-- Execution Context -->
          <div v-if="message.execution_context" class="execution-context">
            <small>
              {{ message.execution_context.iterations }} iterations •
              {{ message.execution_context.tools_used }} tools •
              {{ formatDuration(message.execution_context.execution_time) }}
            </small>
          </div>

          <div class="message-timestamp">
            {{ formatTime(message.timestamp) }}
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="loading" class="loading-message">
        <div class="typing-indicator">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <div v-if="currentOperation" class="current-operation">
          {{ currentOperation }}
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <!-- Quick Actions -->
      <div class="quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.id"
          @click="sendQuickAction(action)"
          class="quick-action-btn"
        >
          {{ action.icon }} {{ action.label }}
        </button>
      </div>

      <!-- Text Input -->
      <form @submit.prevent="sendMessage" class="input-form">
        <textarea
          v-model="newMessage"
          :disabled="loading"
          placeholder="Ask me anything... I can analyze data, review code, research topics, and more!"
          class="message-input"
          rows="3"
          @keydown.ctrl.enter="sendMessage"
        ></textarea>
        <button
          type="submit"
          :disabled="loading || !newMessage.trim()"
          class="send-button"
        >
          <span v-if="loading">⏳</span>
          <span v-else>🚀</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { marked } from "marked";

export default {
  name: "AgenticChat",

  data() {
    return {
      messages: [],
      newMessage: "",
      loading: false,
      currentOperation: "",
      quickActions: [
        {
          id: "analyze_business",
          icon: "📊",
          label: "Analyze Business",
          query: "Analyze our business performance for this quarter",
        },
        {
          id: "review_code",
          icon: "🔍",
          label: "Review Code",
          query: "I need help reviewing some code for security and performance",
        },
        {
          id: "research_topic",
          icon: "🔬",
          label: "Research",
          query: "Help me research and analyze a topic",
        },
        {
          id: "data_insights",
          icon: "💡",
          label: "Data Insights",
          query: "Generate insights from our data",
        },
      ],
    };
  },

  methods: {
    async sendMessage() {
      if (!this.newMessage.trim() || this.loading) return;

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: this.newMessage,
        timestamp: new Date(),
      };

      this.messages.push(userMessage);
      this.loading = true;
      this.currentOperation = "Processing your request...";

      try {
        const response = await fetch("/api/agentic/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')
              .content,
          },
          body: JSON.stringify({
            message: this.newMessage,
            context: this.getContextFromHistory(),
            options: {
              max_iterations: 10,
              temperature: 0.7,
            },
          }),
        });

        const result = await response.json();

        if (result.success) {
          this.messages.push({
            id: Date.now() + 1,
            role: "assistant",
            content: result.response,
            tool_calls: result.tool_calls,
            execution_context: result.execution_context,
            timestamp: new Date(),
          });
        } else {
          this.messages.push({
            id: Date.now() + 1,
            role: "assistant",
            content:
              result.fallback_response || "Sorry, I encountered an error.",
            error: true,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Chat error:", error);
        this.messages.push({
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, there was a connection error.",
          error: true,
          timestamp: new Date(),
        });
      }

      this.newMessage = "";
      this.loading = false;
      this.currentOperation = "";
      this.$nextTick(this.scrollToBottom);
    },

    sendQuickAction(action) {
      this.newMessage = action.query;
      this.sendMessage();
    },

    getContextFromHistory() {
      return {
        recent_messages: this.messages.slice(-5),
        conversation_length: this.messages.length,
        session_id: this.getSessionId(),
      };
    },

    scrollToBottom() {
      this.$refs.messagesContainer.scrollTop =
        this.$refs.messagesContainer.scrollHeight;
    },

    formatTime(date) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    },

    formatDuration(seconds) {
      if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
      return `${seconds.toFixed(1)}s`;
    },

    formatMarkdown(text) {
      return marked(text);
    },

    getSessionId() {
      if (!this.sessionId) {
        this.sessionId = "session_" + Date.now();
      }
      return this.sessionId;
    },
  },
};
</script>

<style scoped>
.agentic-chat-container {
  display: flex;
  flex-direction: column;
  height: 800px;
  border: 1px solid #e1e5e9;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.message-wrapper {
  margin-bottom: 1.5rem;
}

.message {
  max-width: 85%;
  padding: 1rem;
  border-radius: 1rem;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.user {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  margin-left: auto;
}

.message.assistant {
  background: white;
  border: 1px solid #e1e5e9;
}

.tool-calls-section {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tool-card {
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  background: white;
}

.tool-card.success {
  border-left: 4px solid #28a745;
}

.tool-card.error {
  border-left: 4px solid #dc3545;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.tool-timing {
  font-size: 0.75rem;
  color: #6c757d;
}

.tool-error {
  font-size: 0.75rem;
  color: #dc3545;
  margin-top: 0.25rem;
}

.execution-context {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #e9ecef;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6c757d;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.quick-action-btn {
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.quick-action-btn:hover {
  background: #e9ecef;
  transform: translateY(-1px);
}

.input-area {
  padding: 1rem;
  border-top: 1px solid #e1e5e9;
  background: white;
}

.input-form {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.message-input:focus {
  border-color: #007bff;
}

.send-button {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #007bff;
  animation: bounce 1.4s infinite both;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.current-operation {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6c757d;
}
</style>
```

## Performance Optimization

### Caching Strategies

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class AgenticCacheManager
{
    /**
     * Cache tool results with intelligent TTL
     */
    public function cacheToolResult(string $toolName, array $params, array $result): void
    {
        $cacheKey = $this->buildToolCacheKey($toolName, $params);
        $ttl = $this->getOptimalTtl($toolName, $result);

        Cache::tags(['mcp_tools', $toolName])->put($cacheKey, $result, $ttl);
    }

    /**
     * Get cached tool result
     */
    public function getCachedToolResult(string $toolName, array $params): ?array
    {
        $cacheKey = $this->buildToolCacheKey($toolName, $params);
        return Cache::tags(['mcp_tools', $toolName])->get($cacheKey);
    }

    /**
     * Cache OpenAI responses for repeated queries
     */
    public function cacheOpenAIResponse(array $messages, array $response): void
    {
        $cacheKey = 'openai_' . md5(json_encode($messages));

        // Cache for shorter time since conversations are dynamic
        Cache::put($cacheKey, $response, 1800); // 30 minutes
    }

    /**
     * Intelligent cache warming
     */
    public function warmCache(): void
    {
        $commonQueries = [
            ['tool' => 'database_query', 'params' => ['query' => 'SELECT COUNT(*) FROM users']],
            ['tool' => 'weather', 'params' => ['location' => 'New York']],
            ['tool' => 'file_analysis', 'params' => ['file_path' => 'common/report.csv']],
        ];

        foreach ($commonQueries as $query) {
            // Pre-execute common queries
            app(AgenticWorkflowService::class)->executeWorkflow(
                "Execute {$query['tool']} with params",
                $query['params']
            );
        }
    }

    private function buildToolCacheKey(string $toolName, array $params): string
    {
        // Include date for time-sensitive data
        $datePart = in_array($toolName, ['weather', 'stock_price']) ? date('Y-m-d-H') : '';
        return "tool:{$toolName}:" . md5(serialize($params)) . $datePart;
    }

    private function getOptimalTtl(string $toolName, array $result): int
    {
        // Dynamic TTL based on tool type and result characteristics
        return match ($toolName) {
            'weather' => 1800,           // 30 minutes
            'stock_price' => 300,        // 5 minutes
            'database_query' => 600,     // 10 minutes
            'file_analysis' => 3600,     // 1 hour
            'code_review' => 86400,      // 24 hours
            default => 1800,             // 30 minutes default
        };
    }
}
```

## See Also

- [Server Implementation](server-implementation.md)
- [Client Implementation](client-implementation.md)
- [Caching Best Practices](caching-best-practices.md)
- [OpenAI PHP Laravel Documentation](https://github.com/openai-php/laravel)
