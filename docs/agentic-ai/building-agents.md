# Building AI Agents

Learn to create intelligent agents with decision-making logic, goal-oriented behavior, and context awareness using the PHP MCP SDK.

## Overview

Agentic AI systems are intelligent agents that can reason about problems, make decisions, and take actions to achieve goals. This guide shows you how to build such agents using MCP as the tool orchestration layer.

## Core Agent Architecture

```php
<?php

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use OpenAI\Client as OpenAIClient;

abstract class Agent
{
    protected OpenAIClient $llm;
    protected array $mcpClients = [];
    protected array $memory = [];
    protected array $goals = [];
    protected string $systemPrompt;

    public function __construct(string $openaiApiKey, array $mcpServers = [])
    {
        $this->llm = OpenAI::client($openaiApiKey);
        $this->connectToMcpServers($mcpServers);
        $this->systemPrompt = $this->getSystemPrompt();
    }

    abstract protected function getSystemPrompt(): string;
    abstract public function processRequest(string $request): AgentResponse;

    protected function connectToMcpServers(array $servers): void
    {
        foreach ($servers as $serverId => $config) {
            async(function () use ($serverId, $config) {
                $client = new Client(new Implementation('agent-client', '1.0.0'));
                $transport = new StdioClientTransport($config);

                $client->connect($transport)->await();
                $this->mcpClients[$serverId] = $client;
            })->await();
        }
    }

    protected function think(string $context, array $availableActions = []): AgentThought
    {
        $prompt = $this->buildThinkingPrompt($context, $availableActions);

        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                ['role' => 'system', 'content' => $this->systemPrompt],
                ['role' => 'user', 'content' => $prompt]
            ],
            'functions' => $this->getAvailableFunctions(),
            'function_call' => 'auto'
        ]);

        return new AgentThought(
            $response->choices[0]->message->content ?? '',
            $response->choices[0]->message->functionCall ?? null
        );
    }

    protected function act(AgentAction $action): AgentResult
    {
        try {
            if ($action->type === 'mcp_tool') {
                return $this->executeMcpTool($action);
            } elseif ($action->type === 'internal') {
                return $this->executeInternalAction($action);
            }

            throw new \InvalidArgumentException("Unknown action type: {$action->type}");

        } catch (\Exception $e) {
            return new AgentResult(
                false,
                "Action failed: {$e->getMessage()}",
                ['error' => $e->getMessage()]
            );
        }
    }

    protected function executeMcpTool(AgentAction $action): AgentResult
    {
        [$serverId, $toolName] = explode(':', $action->tool, 2);

        if (!isset($this->mcpClients[$serverId])) {
            throw new \InvalidArgumentException("MCP server '{$serverId}' not available");
        }

        $result = async(function () use ($serverId, $toolName, $action) {
            return $this->mcpClients[$serverId]->callTool($toolName, $action->parameters)->await();
        })->await();

        return new AgentResult(
            true,
            $result['content'][0]['text'] ?? 'Tool executed successfully',
            $result
        );
    }

    protected function remember(string $key, mixed $value): void
    {
        $this->memory[$key] = [
            'value' => $value,
            'timestamp' => time()
        ];
    }

    protected function recall(string $key): mixed
    {
        return $this->memory[$key]['value'] ?? null;
    }
}
```

## Agent Types

### Task-Oriented Agent

```php
class TaskAgent extends Agent
{
    protected function getSystemPrompt(): string
    {
        return "You are a task-oriented AI agent. Your goal is to help users accomplish specific tasks efficiently using available tools. Break down complex requests into smaller, actionable steps.";
    }

    public function processRequest(string $request): AgentResponse
    {
        // Analyze the request
        $analysis = $this->analyzeRequest($request);

        // Create execution plan
        $plan = $this->createPlan($analysis);

        // Execute plan steps
        $results = [];
        foreach ($plan->steps as $step) {
            $thought = $this->think($step->context, $step->availableActions);

            if ($thought->action) {
                $result = $this->act($thought->action);
                $results[] = $result;

                // Update context with result
                $step->context .= "\nResult: {$result->message}";
            }
        }

        return new AgentResponse(
            $this->synthesizeResults($results),
            $results
        );
    }

    private function analyzeRequest(string $request): RequestAnalysis
    {
        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Analyze this request and identify: 1) The main goal, 2) Required steps, 3) Potential challenges, 4) Success criteria'
                ],
                [
                    'role' => 'user',
                    'content' => $request
                ]
            ]
        ]);

        return RequestAnalysis::fromLlmResponse($response->choices[0]->message->content);
    }

    private function createPlan(RequestAnalysis $analysis): ExecutionPlan
    {
        $steps = [];

        foreach ($analysis->requiredSteps as $stepDescription) {
            $steps[] = new PlanStep(
                $stepDescription,
                $this->identifyAvailableActions($stepDescription)
            );
        }

        return new ExecutionPlan($analysis->goal, $steps);
    }
}
```

### Research Agent

```php
class ResearchAgent extends Agent
{
    protected function getSystemPrompt(): string
    {
        return "You are a research-oriented AI agent. Your goal is to gather, analyze, and synthesize information from multiple sources to provide comprehensive answers to user questions.";
    }

    public function processRequest(string $request): AgentResponse
    {
        // Identify information needs
        $infoNeeds = $this->identifyInformationNeeds($request);

        // Gather information from multiple sources
        $gatheredInfo = [];
        foreach ($infoNeeds as $need) {
            $info = $this->gatherInformation($need);
            $gatheredInfo[] = $info;
        }

        // Synthesize findings
        $synthesis = $this->synthesizeInformation($gatheredInfo, $request);

        return new AgentResponse($synthesis, $gatheredInfo);
    }

    private function gatherInformation(InformationNeed $need): InformationResult
    {
        // Determine best tool/resource for this information need
        $bestTool = $this->selectBestTool($need);

        if ($bestTool) {
            $result = $this->act(new AgentAction(
                'mcp_tool',
                $bestTool['server'] . ':' . $bestTool['tool'],
                $need->parameters
            ));

            return new InformationResult($need, $result->data, $result->success);
        }

        return new InformationResult($need, null, false);
    }

    private function selectBestTool(InformationNeed $need): ?array
    {
        // Use LLM to select the most appropriate tool
        $availableTools = $this->getAllAvailableTools();

        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Select the best tool for gathering this information: ' . $need->description
                ],
                [
                    'role' => 'user',
                    'content' => 'Available tools: ' . json_encode($availableTools)
                ]
            ]
        ]);

        // Parse LLM response to select tool
        return $this->parseToolSelection($response->choices[0]->message->content);
    }
}
```

### Personal Assistant Agent

```php
class PersonalAssistantAgent extends Agent
{
    private array $userPreferences = [];
    private array $conversationHistory = [];

    protected function getSystemPrompt(): string
    {
        return "You are a helpful personal assistant AI agent. You can manage tasks, schedules, notes, and help with various personal productivity needs. Remember user preferences and maintain context across conversations.";
    }

    public function processRequest(string $request): AgentResponse
    {
        // Add to conversation history
        $this->conversationHistory[] = [
            'role' => 'user',
            'content' => $request,
            'timestamp' => time()
        ];

        // Determine intent
        $intent = $this->classifyIntent($request);

        // Execute based on intent
        $response = match($intent->category) {
            'task_management' => $this->handleTaskManagement($request, $intent),
            'information_retrieval' => $this->handleInformationRetrieval($request, $intent),
            'scheduling' => $this->handleScheduling($request, $intent),
            'note_taking' => $this->handleNoteTaking($request, $intent),
            default => $this->handleGeneral($request, $intent)
        };

        // Add to conversation history
        $this->conversationHistory[] = [
            'role' => 'assistant',
            'content' => $response->message,
            'timestamp' => time()
        ];

        return $response;
    }

    private function handleTaskManagement(string $request, Intent $intent): AgentResponse
    {
        // Use task management MCP tools
        if ($intent->action === 'create_task') {
            $taskDetails = $this->extractTaskDetails($request);

            $result = $this->act(new AgentAction(
                'mcp_tool',
                'task_manager:create_task',
                $taskDetails
            ));

            return new AgentResponse(
                "Task '{$taskDetails['title']}' created successfully!",
                [$result]
            );
        }

        // Handle other task management actions...
        return new AgentResponse("Task management action completed.", []);
    }

    private function classifyIntent(string $request): Intent
    {
        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Classify the user intent into categories: task_management, information_retrieval, scheduling, note_taking, or general. Also identify the specific action they want to take.'
                ],
                [
                    'role' => 'user',
                    'content' => $request
                ]
            ]
        ]);

        return Intent::fromLlmResponse($response->choices[0]->message->content);
    }
}
```

## Agent Components

### Memory System

```php
class AgentMemory
{
    private array $shortTerm = [];
    private array $longTerm = [];
    private int $shortTermLimit = 100;

    public function store(string $key, mixed $value, bool $persistent = false): void
    {
        $memory = [
            'value' => $value,
            'timestamp' => time(),
            'access_count' => 0
        ];

        if ($persistent) {
            $this->longTerm[$key] = $memory;
            $this->persistToStorage($key, $memory);
        } else {
            $this->shortTerm[$key] = $memory;
            $this->pruneShortTermMemory();
        }
    }

    public function recall(string $key): mixed
    {
        // Check short-term memory first
        if (isset($this->shortTerm[$key])) {
            $this->shortTerm[$key]['access_count']++;
            return $this->shortTerm[$key]['value'];
        }

        // Check long-term memory
        if (isset($this->longTerm[$key])) {
            $this->longTerm[$key]['access_count']++;
            return $this->longTerm[$key]['value'];
        }

        return null;
    }

    public function search(string $query): array
    {
        $results = [];

        // Search both short-term and long-term memory
        foreach (array_merge($this->shortTerm, $this->longTerm) as $key => $memory) {
            if (stripos($key, $query) !== false ||
                stripos(json_encode($memory['value']), $query) !== false) {
                $results[$key] = $memory['value'];
            }
        }

        return $results;
    }

    private function pruneShortTermMemory(): void
    {
        if (count($this->shortTerm) > $this->shortTermLimit) {
            // Remove oldest entries
            $sortedByTime = $this->shortTerm;
            uasort($sortedByTime, fn($a, $b) => $a['timestamp'] <=> $b['timestamp']);

            $toRemove = array_slice(array_keys($sortedByTime), 0, count($sortedByTime) - $this->shortTermLimit);

            foreach ($toRemove as $key) {
                unset($this->shortTerm[$key]);
            }
        }
    }
}
```

### Decision Engine

```php
class DecisionEngine
{
    private OpenAIClient $llm;
    private array $decisionHistory = [];

    public function makeDecision(DecisionContext $context): Decision
    {
        $prompt = $this->buildDecisionPrompt($context);

        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a decision-making system. Analyze the context and make the best decision based on available information and options.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'functions' => $this->getDecisionFunctions(),
            'function_call' => 'auto'
        ]);

        $decision = Decision::fromLlmResponse($response);

        // Record decision for learning
        $this->decisionHistory[] = [
            'context' => $context,
            'decision' => $decision,
            'timestamp' => time()
        ];

        return $decision;
    }

    private function buildDecisionPrompt(DecisionContext $context): string
    {
        return "Context: {$context->description}\n\n" .
               "Available Options:\n" .
               implode("\n", array_map(fn($opt) => "- {$opt}", $context->options)) . "\n\n" .
               "Constraints:\n" .
               implode("\n", array_map(fn($con) => "- {$con}", $context->constraints)) . "\n\n" .
               "Goal: {$context->goal}\n\n" .
               "Make the best decision and explain your reasoning.";
    }
}
```

### Goal Management

```php
class GoalManager
{
    private array $goals = [];
    private array $completedGoals = [];

    public function addGoal(Goal $goal): void
    {
        $this->goals[$goal->id] = $goal;
    }

    public function getCurrentGoal(): ?Goal
    {
        // Return highest priority incomplete goal
        $activeGoals = array_filter($this->goals, fn($goal) => !$goal->isComplete());

        if (empty($activeGoals)) {
            return null;
        }

        usort($activeGoals, fn($a, $b) => $b->priority <=> $a->priority);
        return $activeGoals[0];
    }

    public function updateGoalProgress(string $goalId, float $progress): void
    {
        if (isset($this->goals[$goalId])) {
            $this->goals[$goalId]->progress = $progress;

            if ($progress >= 1.0) {
                $this->completeGoal($goalId);
            }
        }
    }

    public function completeGoal(string $goalId): void
    {
        if (isset($this->goals[$goalId])) {
            $goal = $this->goals[$goalId];
            $goal->completedAt = time();

            $this->completedGoals[$goalId] = $goal;
            unset($this->goals[$goalId]);
        }
    }

    public function getGoalStatus(): array
    {
        return [
            'active_goals' => count($this->goals),
            'completed_goals' => count($this->completedGoals),
            'current_goal' => $this->getCurrentGoal()?->title,
            'overall_progress' => $this->calculateOverallProgress()
        ];
    }

    private function calculateOverallProgress(): float
    {
        $totalGoals = count($this->goals) + count($this->completedGoals);

        if ($totalGoals === 0) {
            return 0.0;
        }

        $completedWeight = count($this->completedGoals);
        $partialWeight = array_sum(array_map(fn($goal) => $goal->progress, $this->goals));

        return ($completedWeight + $partialWeight) / $totalGoals;
    }
}
```

## Complete Agent Example

### Personal Productivity Agent

```php
class PersonalProductivityAgent extends Agent
{
    private AgentMemory $memory;
    private GoalManager $goalManager;
    private DecisionEngine $decisionEngine;

    public function __construct(string $openaiApiKey, array $mcpServers)
    {
        parent::__construct($openaiApiKey, $mcpServers);

        $this->memory = new AgentMemory();
        $this->goalManager = new GoalManager();
        $this->decisionEngine = new DecisionEngine($this->llm);
    }

    protected function getSystemPrompt(): string
    {
        return "You are a personal productivity assistant. Help users manage tasks, take notes, schedule activities, and stay organized. You have access to various tools through MCP servers including task management, calendar, note-taking, and file management tools.";
    }

    public function processRequest(string $request): AgentResponse
    {
        // Store request in memory
        $this->memory->store("last_request", $request);

        // Classify the request type
        $classification = $this->classifyRequest($request);

        // Handle based on classification
        return match($classification->type) {
            'task_management' => $this->handleTaskRequest($request, $classification),
            'note_taking' => $this->handleNoteRequest($request, $classification),
            'scheduling' => $this->handleScheduleRequest($request, $classification),
            'information_search' => $this->handleSearchRequest($request, $classification),
            'goal_setting' => $this->handleGoalRequest($request, $classification),
            default => $this->handleGeneralRequest($request, $classification)
        };
    }

    private function handleTaskRequest(string $request, RequestClassification $classification): AgentResponse
    {
        if ($classification->action === 'create') {
            // Extract task details using LLM
            $taskDetails = $this->extractTaskDetails($request);

            // Create task using MCP tool
            $result = $this->act(new AgentAction(
                'mcp_tool',
                'task_manager:create_task',
                $taskDetails
            ));

            // Store in memory for future reference
            $this->memory->store("last_created_task", $taskDetails, true);

            return new AgentResponse(
                "Task '{$taskDetails['title']}' has been created and assigned priority {$taskDetails['priority']}. " .
                ($taskDetails['due_date'] ? "Due date set for {$taskDetails['due_date']}." : "No due date specified."),
                [$result]
            );
        }

        if ($classification->action === 'list') {
            $result = $this->act(new AgentAction(
                'mcp_tool',
                'task_manager:list_tasks',
                ['status' => 'active']
            ));

            $tasks = json_decode($result->data['content'][0]['text'], true);

            $summary = "You have " . count($tasks) . " active tasks:\n\n";
            foreach ($tasks as $task) {
                $summary .= "• {$task['title']} (Priority: {$task['priority']})";
                if ($task['due_date']) {
                    $summary .= " - Due: {$task['due_date']}";
                }
                $summary .= "\n";
            }

            return new AgentResponse($summary, [$result]);
        }

        return new AgentResponse("I can help you create, list, update, or delete tasks. What would you like to do?", []);
    }

    private function extractTaskDetails(string $request): array
    {
        $response = $this->llm->chat()->create([
            'model' => 'gpt-4.1',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Extract task details from the user request. Return JSON with: title, description, priority (1-5), due_date (YYYY-MM-DD if mentioned), tags (array).'
                ],
                [
                    'role' => 'user',
                    'content' => $request
                ]
            ]
        ]);

        return json_decode($response->choices[0]->message->content, true);
    }

    public function startAutonomousMode(): void
    {
        echo "🤖 Starting autonomous mode...\n";

        async(function () {
            while (true) {
                // Check for pending goals
                $currentGoal = $this->goalManager->getCurrentGoal();

                if ($currentGoal) {
                    echo "🎯 Working on goal: {$currentGoal->title}\n";

                    // Determine next action for current goal
                    $context = new DecisionContext(
                        "Working towards goal: {$currentGoal->description}",
                        $this->getAvailableActions(),
                        $currentGoal->constraints,
                        $currentGoal->title
                    );

                    $decision = $this->decisionEngine->makeDecision($context);

                    if ($decision->action) {
                        echo "🔧 Taking action: {$decision->action->description}\n";
                        $result = $this->act($decision->action);

                        if ($result->success) {
                            $this->goalManager->updateGoalProgress(
                                $currentGoal->id,
                                $currentGoal->progress + 0.1
                            );
                        }
                    }
                }

                // Wait before next iteration
                delay(5000)->await(); // 5 seconds
            }
        })->await();
    }
}
```

## Agent Communication

### Multi-Agent Coordination

```php
class AgentCoordinator
{
    private array $agents = [];
    private MessageBus $messageBus;

    public function __construct()
    {
        $this->messageBus = new MessageBus();
    }

    public function registerAgent(string $id, Agent $agent): void
    {
        $this->agents[$id] = $agent;

        // Set up message handling
        $this->messageBus->subscribe($id, function($message) use ($agent) {
            return $agent->handleMessage($message);
        });
    }

    public function coordinateTask(Task $task): TaskResult
    {
        // Analyze task requirements
        $requirements = $this->analyzeTaskRequirements($task);

        // Assign subtasks to appropriate agents
        $assignments = [];
        foreach ($requirements->subtasks as $subtask) {
            $bestAgent = $this->selectBestAgent($subtask);
            $assignments[] = new TaskAssignment($bestAgent, $subtask);
        }

        // Execute assignments in parallel
        $results = [];
        $promises = [];

        foreach ($assignments as $assignment) {
            $promises[] = async(function () use ($assignment) {
                return $this->agents[$assignment->agentId]->executeTask($assignment->subtask);
            });
        }

        $results = Promise::all($promises)->await();

        // Synthesize results
        return $this->synthesizeTaskResults($task, $results);
    }

    private function selectBestAgent(Subtask $subtask): string
    {
        // Use capability matching to select best agent
        $bestMatch = null;
        $bestScore = 0;

        foreach ($this->agents as $agentId => $agent) {
            $score = $this->calculateCapabilityScore($agent, $subtask);

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $agentId;
            }
        }

        return $bestMatch ?? array_key_first($this->agents);
    }
}
```

## Testing Agents

### Agent Testing Framework

```php
use PHPUnit\Framework\TestCase;

class AgentTest extends TestCase
{
    private PersonalAssistantAgent $agent;
    private MockMcpServer $mockServer;

    protected function setUp(): void
    {
        $this->mockServer = new MockMcpServer();
        $this->agent = new PersonalAssistantAgent(
            'test-api-key',
            ['task_manager' => $this->mockServer->getConfig()]
        );
    }

    public function testTaskCreation(): void
    {
        $this->mockServer->addTool('create_task', function($params) {
            return [
                'content' => [[
                    'type' => 'text',
                    'text' => "Task '{$params['title']}' created with ID: 123"
                ]]
            ];
        });

        $response = $this->agent->processRequest("Create a task to review the quarterly report");

        $this->assertStringContains('created', $response->message);
        $this->assertTrue($response->success);
    }

    public function testGoalProgress(): void
    {
        $goal = new Goal('complete-project', 'Complete the Q4 project', 1);
        $this->agent->getGoalManager()->addGoal($goal);

        // Simulate progress
        $this->agent->getGoalManager()->updateGoalProgress('complete-project', 0.5);

        $status = $this->agent->getGoalManager()->getGoalStatus();
        $this->assertEquals(0.5, $status['overall_progress']);
    }
}
```

## Best Practices

### 1. Agent Design

- **Single Responsibility**: Each agent should have a clear, focused purpose
- **Modular Architecture**: Use composition over inheritance
- **State Management**: Implement proper memory and context handling
- **Error Recovery**: Build resilience into agent behavior

### 2. Tool Orchestration

- **Dynamic Discovery**: Discover available tools at runtime
- **Intelligent Selection**: Use LLM reasoning to choose appropriate tools
- **Parallel Execution**: Execute independent operations concurrently
- **Result Synthesis**: Combine results from multiple tools intelligently

### 3. Context Management

- **Conversation History**: Maintain context across interactions
- **User Preferences**: Learn and remember user preferences
- **Goal Tracking**: Track long-term objectives and progress
- **Memory Management**: Balance short-term and long-term memory

### 4. Performance

- **Caching**: Cache LLM responses and tool results where appropriate
- **Streaming**: Use streaming for long-running operations
- **Batching**: Batch similar operations for efficiency
- **Monitoring**: Track agent performance and decision quality

## Real-World Agent Examples

### Code Review Agent

```php
class CodeReviewAgent extends Agent
{
    protected function getSystemPrompt(): string
    {
        return "You are a code review agent. Analyze code for quality, security, performance, and maintainability issues. Provide constructive feedback and suggestions for improvement.";
    }

    public function reviewCode(string $code, string $language): CodeReviewResult
    {
        // Use static analysis tools via MCP
        $analysisResult = $this->act(new AgentAction(
            'mcp_tool',
            'code_analyzer:analyze_code',
            ['code' => $code, 'language' => $language]
        ));

        // Use security scanner
        $securityResult = $this->act(new AgentAction(
            'mcp_tool',
            'security_scanner:scan_code',
            ['code' => $code, 'language' => $language]
        ));

        // Generate comprehensive review using LLM
        $review = $this->generateReview($code, $language, $analysisResult, $securityResult);

        return new CodeReviewResult($review, $analysisResult, $securityResult);
    }
}
```

### Data Analysis Agent

```php
class DataAnalysisAgent extends Agent
{
    public function analyzeDataset(string $datasetPath, array $analysisGoals): DataAnalysisResult
    {
        // Load and explore data
        $dataInfo = $this->act(new AgentAction(
            'mcp_tool',
            'data_processor:analyze_dataset',
            ['path' => $datasetPath]
        ));

        // Generate insights based on goals
        $insights = [];
        foreach ($analysisGoals as $goal) {
            $insight = $this->generateInsight($goal, $dataInfo);
            $insights[] = $insight;
        }

        // Create visualizations if needed
        $visualizations = $this->createVisualizations($insights);

        return new DataAnalysisResult($insights, $visualizations, $dataInfo);
    }
}
```

## See Also

- [Multi-Agent Systems](multi-agent) - Coordinate multiple agents
- [Agent Orchestration](orchestration) - Advanced coordination patterns
- [Best Practices](best-practices) - Production agent patterns
- [OpenAI Integration](../integrations/openai) - LLM integration patterns
