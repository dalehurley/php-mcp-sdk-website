# Multi-Agent Systems

Learn to coordinate multiple specialized agents for complex task management, role-based distribution, and collaborative problem-solving.

## Overview

Multi-agent systems enable complex problem-solving by coordinating multiple specialized agents, each with specific capabilities and responsibilities. This approach allows for:

- **Specialized Expertise**: Each agent focuses on specific domains
- **Parallel Processing**: Multiple agents work simultaneously
- **Fault Tolerance**: System continues if individual agents fail
- **Scalability**: Add new agents as needed

## Agent Coordination Patterns

### Hub-and-Spoke Pattern

```php
class AgentOrchestrator
{
    private array $agents = [];
    private MessageBus $messageBus;
    private TaskQueue $taskQueue;

    public function __construct()
    {
        $this->messageBus = new MessageBus();
        $this->taskQueue = new TaskQueue();
    }

    public function registerAgent(string $id, Agent $agent, array $capabilities): void
    {
        $this->agents[$id] = [
            'agent' => $agent,
            'capabilities' => $capabilities,
            'status' => 'idle',
            'current_task' => null
        ];

        // Set up agent communication
        $agent->setMessageHandler(function($message) use ($id) {
            $this->handleAgentMessage($id, $message);
        });
    }

    public function processComplexTask(ComplexTask $task): TaskResult
    {
        // Break down task into subtasks
        $subtasks = $this->decomposeTask($task);

        // Assign subtasks to appropriate agents
        $assignments = [];
        foreach ($subtasks as $subtask) {
            $bestAgent = $this->selectBestAgent($subtask);
            $assignments[] = new TaskAssignment($bestAgent, $subtask);
        }

        // Execute assignments with coordination
        return $this->executeCoordinatedTasks($assignments);
    }

    private function selectBestAgent(Subtask $subtask): string
    {
        $bestMatch = null;
        $bestScore = 0;

        foreach ($this->agents as $agentId => $agentInfo) {
            if ($agentInfo['status'] !== 'idle') {
                continue; // Agent is busy
            }

            $score = $this->calculateCapabilityMatch(
                $subtask->requiredCapabilities,
                $agentInfo['capabilities']
            );

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $agentId;
            }
        }

        return $bestMatch;
    }

    private function executeCoordinatedTasks(array $assignments): TaskResult
    {
        $results = [];
        $promises = [];

        foreach ($assignments as $assignment) {
            $agentId = $assignment->agentId;
            $this->agents[$agentId]['status'] = 'working';
            $this->agents[$agentId]['current_task'] = $assignment->subtask;

            $promises[$agentId] = async(function () use ($assignment) {
                try {
                    return $this->agents[$assignment->agentId]['agent']
                        ->executeTask($assignment->subtask);
                } catch (\Exception $e) {
                    return new TaskResult(false, $e->getMessage());
                } finally {
                    $this->agents[$assignment->agentId]['status'] = 'idle';
                    $this->agents[$assignment->agentId]['current_task'] = null;
                }
            });
        }

        $results = Promise::all($promises)->await();

        return $this->synthesizeResults($results);
    }
}
```

### Peer-to-Peer Pattern

```php
class PeerAgent extends Agent
{
    private array $peers = [];
    private MessageBroker $broker;

    public function addPeer(string $peerId, Agent $peer): void
    {
        $this->peers[$peerId] = $peer;

        // Set up bidirectional communication
        $this->broker->subscribe($peerId, function($message) use ($peer) {
            return $peer->handlePeerMessage($this->getId(), $message);
        });
    }

    public function requestHelp(string $taskDescription, array $requiredCapabilities): ?AgentResponse
    {
        // Find peers with required capabilities
        $capablePeers = [];
        foreach ($this->peers as $peerId => $peer) {
            if ($this->hasRequiredCapabilities($peer, $requiredCapabilities)) {
                $capablePeers[] = $peerId;
            }
        }

        if (empty($capablePeers)) {
            return null; // No capable peers available
        }

        // Request help from best peer
        $bestPeer = $this->selectBestPeer($capablePeers, $taskDescription);

        $helpRequest = new HelpRequest(
            $this->getId(),
            $taskDescription,
            $requiredCapabilities,
            time() + 300 // 5-minute timeout
        );

        return $this->broker->sendRequest($bestPeer, $helpRequest);
    }

    public function handlePeerMessage(string $fromPeerId, Message $message): ?AgentResponse
    {
        return match($message->type) {
            'help_request' => $this->handleHelpRequest($fromPeerId, $message),
            'collaboration_invite' => $this->handleCollaborationInvite($fromPeerId, $message),
            'status_update' => $this->handleStatusUpdate($fromPeerId, $message),
            default => null
        };
    }
}
```

## Specialized Agent Types

### Research Agent

```php
class ResearchAgent extends Agent
{
    private array $informationSources = [];
    private KnowledgeBase $knowledgeBase;

    public function research(string $topic, array $requirements): ResearchResult
    {
        // Plan research strategy
        $strategy = $this->planResearchStrategy($topic, $requirements);

        // Gather information from multiple sources
        $findings = [];
        foreach ($strategy->sources as $source) {
            $finding = $this->gatherFromSource($source, $topic);
            $findings[] = $finding;
        }

        // Analyze and synthesize findings
        $analysis = $this->analyzeFindigns($findings, $requirements);

        // Store in knowledge base
        $this->knowledgeBase->store($topic, $analysis);

        return new ResearchResult($topic, $findings, $analysis);
    }

    private function gatherFromSource(InformationSource $source, string $topic): Finding
    {
        return match($source->type) {
            'mcp_tool' => $this->gatherFromMcpTool($source, $topic),
            'web_search' => $this->gatherFromWebSearch($source, $topic),
            'database' => $this->gatherFromDatabase($source, $topic),
            'api' => $this->gatherFromApi($source, $topic),
            default => new Finding($source, null, false)
        };
    }
}
```

### Execution Agent

```php
class ExecutionAgent extends Agent
{
    private TaskExecutor $executor;
    private ProgressTracker $tracker;

    public function executeWorkflow(Workflow $workflow): WorkflowResult
    {
        $this->tracker->startWorkflow($workflow->id);

        try {
            foreach ($workflow->steps as $step) {
                $this->tracker->startStep($step->id);

                $result = $this->executeStep($step);

                if (!$result->success) {
                    $this->tracker->failStep($step->id, $result->error);
                    return new WorkflowResult(false, "Step {$step->id} failed: {$result->error}");
                }

                $this->tracker->completeStep($step->id, $result);
            }

            $this->tracker->completeWorkflow($workflow->id);
            return new WorkflowResult(true, "Workflow completed successfully");

        } catch (\Exception $e) {
            $this->tracker->failWorkflow($workflow->id, $e->getMessage());
            return new WorkflowResult(false, "Workflow failed: {$e->getMessage()}");
        }
    }

    private function executeStep(WorkflowStep $step): StepResult
    {
        return match($step->type) {
            'mcp_tool_call' => $this->executeMcpToolStep($step),
            'api_call' => $this->executeApiStep($step),
            'data_processing' => $this->executeDataProcessingStep($step),
            'decision_point' => $this->executeDecisionStep($step),
            default => new StepResult(false, "Unknown step type: {$step->type}")
        };
    }
}
```

### Monitoring Agent

```php
class MonitoringAgent extends Agent
{
    private array $monitoredSystems = [];
    private AlertManager $alertManager;
    private MetricsCollector $metricsCollector;

    public function startMonitoring(): void
    {
        echo "📊 Starting monitoring agent...\n";

        async(function () {
            while (true) {
                foreach ($this->monitoredSystems as $systemId => $system) {
                    $this->checkSystemHealth($systemId, $system);
                }

                // Collect metrics
                $this->collectMetrics();

                // Process alerts
                $this->processAlerts();

                // Wait before next check
                delay(30000)->await(); // 30 seconds
            }
        })->await();
    }

    private function checkSystemHealth(string $systemId, MonitoredSystem $system): void
    {
        try {
            $health = $this->act(new AgentAction(
                'mcp_tool',
                "{$system->mcpServer}:health_check",
                []
            ));

            $healthData = json_decode($health->data['content'][0]['text'], true);

            if ($healthData['status'] !== 'healthy') {
                $this->alertManager->triggerAlert(
                    "System {$systemId} is unhealthy",
                    $healthData
                );
            }

            $this->metricsCollector->record($systemId, $healthData);

        } catch (\Exception $e) {
            $this->alertManager->triggerAlert(
                "Failed to check health of system {$systemId}",
                ['error' => $e->getMessage()]
            );
        }
    }
}
```

## Agent Communication Protocols

### Message Bus Implementation

```php
class MessageBus
{
    private array $subscribers = [];
    private array $messageQueue = [];

    public function subscribe(string $agentId, callable $handler): void
    {
        $this->subscribers[$agentId] = $handler;
    }

    public function publish(Message $message): void
    {
        if ($message->targetAgent) {
            // Direct message
            $this->deliverMessage($message->targetAgent, $message);
        } else {
            // Broadcast message
            foreach ($this->subscribers as $agentId => $handler) {
                if ($agentId !== $message->fromAgent) {
                    $this->deliverMessage($agentId, $message);
                }
            }
        }
    }

    private function deliverMessage(string $agentId, Message $message): void
    {
        if (isset($this->subscribers[$agentId])) {
            async(function () use ($agentId, $message) {
                try {
                    $this->subscribers[$agentId]($message);
                } catch (\Exception $e) {
                    error_log("Failed to deliver message to {$agentId}: {$e->getMessage()}");
                }
            });
        } else {
            // Queue message for later delivery
            $this->messageQueue[$agentId][] = $message;
        }
    }
}
```

### Consensus Algorithm

```php
class ConsensusManager
{
    private array $agents = [];
    private float $consensusThreshold = 0.67; // 67% agreement required

    public function reachConsensus(string $topic, array $options): ?ConsensusResult
    {
        $votes = [];

        // Collect votes from all agents
        foreach ($this->agents as $agentId => $agent) {
            $vote = $agent->vote($topic, $options);
            $votes[$agentId] = $vote;
        }

        // Calculate consensus
        $optionCounts = [];
        foreach ($votes as $vote) {
            $optionCounts[$vote->option] = ($optionCounts[$vote->option] ?? 0) + $vote->confidence;
        }

        $totalWeight = array_sum($optionCounts);
        $maxWeight = max($optionCounts);
        $winningOption = array_search($maxWeight, $optionCounts);

        $consensusStrength = $maxWeight / $totalWeight;

        if ($consensusStrength >= $this->consensusThreshold) {
            return new ConsensusResult(
                true,
                $winningOption,
                $consensusStrength,
                $votes
            );
        }

        return null; // No consensus reached
    }
}
```

## Complete Multi-Agent Example

### E-commerce Order Processing

```php
class EcommerceAgentSystem
{
    private AgentOrchestrator $orchestrator;
    private InventoryAgent $inventoryAgent;
    private PaymentAgent $paymentAgent;
    private ShippingAgent $shippingAgent;
    private NotificationAgent $notificationAgent;

    public function __construct()
    {
        $this->orchestrator = new AgentOrchestrator();

        // Initialize specialized agents
        $this->inventoryAgent = new InventoryAgent($this->getMcpServers('inventory'));
        $this->paymentAgent = new PaymentAgent($this->getMcpServers('payment'));
        $this->shippingAgent = new ShippingAgent($this->getMcpServers('shipping'));
        $this->notificationAgent = new NotificationAgent($this->getMcpServers('notification'));

        // Register agents with orchestrator
        $this->orchestrator->registerAgent('inventory', $this->inventoryAgent, ['inventory_check', 'stock_management']);
        $this->orchestrator->registerAgent('payment', $this->paymentAgent, ['payment_processing', 'fraud_detection']);
        $this->orchestrator->registerAgent('shipping', $this->shippingAgent, ['shipping_calculation', 'carrier_selection']);
        $this->orchestrator->registerAgent('notification', $this->notificationAgent, ['email_sending', 'sms_sending']);
    }

    public function processOrder(Order $order): OrderResult
    {
        echo "🛒 Processing order {$order->id}...\n";

        try {
            // Step 1: Check inventory
            echo "📦 Checking inventory...\n";
            $inventoryResult = $this->inventoryAgent->checkAvailability($order->items);

            if (!$inventoryResult->allAvailable) {
                return new OrderResult(false, 'Some items are out of stock', $inventoryResult);
            }

            // Step 2: Process payment
            echo "💳 Processing payment...\n";
            $paymentResult = $this->paymentAgent->processPayment(
                $order->paymentInfo,
                $order->total
            );

            if (!$paymentResult->success) {
                return new OrderResult(false, 'Payment failed', $paymentResult);
            }

            // Step 3: Reserve inventory
            echo "🔒 Reserving inventory...\n";
            $reservationResult = $this->inventoryAgent->reserveItems($order->items);

            // Step 4: Calculate shipping
            echo "🚚 Calculating shipping...\n";
            $shippingResult = $this->shippingAgent->calculateShipping(
                $order->shippingAddress,
                $order->items
            );

            // Step 5: Send confirmation
            echo "📧 Sending confirmation...\n";
            $this->notificationAgent->sendOrderConfirmation(
                $order->customerEmail,
                $order,
                $paymentResult,
                $shippingResult
            );

            echo "✅ Order {$order->id} processed successfully!\n";

            return new OrderResult(true, 'Order processed successfully', [
                'inventory' => $inventoryResult,
                'payment' => $paymentResult,
                'shipping' => $shippingResult
            ]);

        } catch (\Exception $e) {
            echo "❌ Order processing failed: {$e->getMessage()}\n";

            // Trigger rollback if needed
            $this->rollbackOrder($order, $e);

            return new OrderResult(false, "Order processing failed: {$e->getMessage()}");
        }
    }

    private function rollbackOrder(Order $order, \Exception $error): void
    {
        echo "🔄 Rolling back order {$order->id}...\n";

        // Attempt to rollback each step
        try {
            $this->inventoryAgent->releaseReservation($order->items);
            $this->paymentAgent->refundPayment($order->paymentInfo);
            $this->notificationAgent->sendOrderCancellation($order->customerEmail, $order, $error);
        } catch (\Exception $rollbackError) {
            error_log("Rollback failed for order {$order->id}: {$rollbackError->getMessage()}");
        }
    }
}
```

## Agent Specializations

### Inventory Agent

```php
class InventoryAgent extends Agent
{
    protected function getSystemPrompt(): string
    {
        return "You are an inventory management agent. Handle stock checks, reservations, and inventory optimization.";
    }

    public function checkAvailability(array $items): InventoryResult
    {
        $availability = [];
        $allAvailable = true;

        foreach ($items as $item) {
            $result = $this->act(new AgentAction(
                'mcp_tool',
                'inventory:check_stock',
                ['sku' => $item['sku'], 'quantity' => $item['quantity']]
            ));

            $stockData = json_decode($result->data['content'][0]['text'], true);
            $available = $stockData['available'] >= $item['quantity'];

            $availability[] = [
                'sku' => $item['sku'],
                'requested' => $item['quantity'],
                'available' => $stockData['available'],
                'sufficient' => $available
            ];

            if (!$available) {
                $allAvailable = false;
            }
        }

        return new InventoryResult($allAvailable, $availability);
    }

    public function reserveItems(array $items): ReservationResult
    {
        $reservations = [];

        foreach ($items as $item) {
            $result = $this->act(new AgentAction(
                'mcp_tool',
                'inventory:reserve_stock',
                [
                    'sku' => $item['sku'],
                    'quantity' => $item['quantity'],
                    'reservation_id' => uniqid('res_')
                ]
            ));

            $reservations[] = json_decode($result->data['content'][0]['text'], true);
        }

        return new ReservationResult(true, $reservations);
    }
}
```

### Payment Agent

```php
class PaymentAgent extends Agent
{
    protected function getSystemPrompt(): string
    {
        return "You are a payment processing agent. Handle secure payment transactions, fraud detection, and financial operations.";
    }

    public function processPayment(PaymentInfo $paymentInfo, float $amount): PaymentResult
    {
        // Fraud detection
        $fraudCheck = $this->act(new AgentAction(
            'mcp_tool',
            'fraud_detector:analyze_transaction',
            [
                'amount' => $amount,
                'payment_method' => $paymentInfo->method,
                'customer_id' => $paymentInfo->customerId
            ]
        ));

        $fraudData = json_decode($fraudCheck->data['content'][0]['text'], true);

        if ($fraudData['risk_score'] > 0.8) {
            return new PaymentResult(false, 'Transaction flagged as high risk');
        }

        // Process payment
        $paymentResult = $this->act(new AgentAction(
            'mcp_tool',
            'payment_processor:charge_card',
            [
                'card_token' => $paymentInfo->cardToken,
                'amount' => $amount,
                'currency' => $paymentInfo->currency
            ]
        ));

        $paymentData = json_decode($paymentResult->data['content'][0]['text'], true);

        return new PaymentResult(
            $paymentData['success'],
            $paymentData['message'],
            $paymentData['transaction_id'] ?? null
        );
    }
}
```

## Agent Lifecycle Management

### Agent Supervisor

```php
class AgentSupervisor
{
    private array $agents = [];
    private array $healthChecks = [];
    private PerformanceMonitor $monitor;

    public function supervise(): void
    {
        async(function () {
            while (true) {
                // Health check all agents
                foreach ($this->agents as $agentId => $agent) {
                    $this->performHealthCheck($agentId, $agent);
                }

                // Monitor performance
                $this->monitor->collectMetrics($this->agents);

                // Handle failed agents
                $this->handleFailedAgents();

                // Scale agents if needed
                $this->autoScale();

                delay(10000)->await(); // Check every 10 seconds
            }
        })->await();
    }

    private function performHealthCheck(string $agentId, Agent $agent): void
    {
        try {
            $health = $agent->getHealthStatus();
            $this->healthChecks[$agentId] = [
                'status' => $health->status,
                'last_check' => time(),
                'response_time' => $health->responseTime
            ];

            if ($health->status !== 'healthy') {
                $this->handleUnhealthyAgent($agentId, $health);
            }

        } catch (\Exception $e) {
            $this->healthChecks[$agentId] = [
                'status' => 'error',
                'last_check' => time(),
                'error' => $e->getMessage()
            ];

            $this->handleFailedAgent($agentId, $e);
        }
    }

    private function handleFailedAgent(string $agentId, \Exception $error): void
    {
        echo "⚠️ Agent {$agentId} failed: {$error->getMessage()}\n";

        // Attempt to restart agent
        try {
            $this->restartAgent($agentId);
            echo "✅ Agent {$agentId} restarted successfully\n";
        } catch (\Exception $restartError) {
            echo "❌ Failed to restart agent {$agentId}: {$restartError->getMessage()}\n";

            // Remove failed agent and redistribute tasks
            $this->removeAgent($agentId);
            $this->redistributeTasks($agentId);
        }
    }
}
```

## Testing Multi-Agent Systems

### System Integration Tests

```php
class MultiAgentSystemTest extends TestCase
{
    private EcommerceAgentSystem $system;
    private array $mockServers = [];

    protected function setUp(): void
    {
        // Set up mock MCP servers
        $this->mockServers['inventory'] = new MockMcpServer();
        $this->mockServers['payment'] = new MockMcpServer();
        $this->mockServers['shipping'] = new MockMcpServer();

        // Configure mock responses
        $this->mockServers['inventory']->addTool('check_stock', function($params) {
            return ['content' => [['type' => 'text', 'text' => json_encode(['available' => 10])]]];
        });

        $this->system = new EcommerceAgentSystem($this->mockServers);
    }

    public function testOrderProcessingWorkflow(): void
    {
        $order = new Order([
            'id' => 'test-order-123',
            'items' => [['sku' => 'ITEM001', 'quantity' => 2]],
            'total' => 99.99
        ]);

        $result = $this->system->processOrder($order);

        $this->assertTrue($result->success);
        $this->assertEquals('Order processed successfully', $result->message);
    }

    public function testAgentFailureRecovery(): void
    {
        // Simulate agent failure
        $this->mockServers['payment']->simulateFailure();

        $order = new Order(['id' => 'test-order-456']);
        $result = $this->system->processOrder($order);

        $this->assertFalse($result->success);
        $this->assertStringContains('Payment failed', $result->message);
    }
}
```

## Performance Optimization

### Agent Load Balancing

```php
class LoadBalancedAgentPool
{
    private array $agentPools = [];
    private LoadBalancer $loadBalancer;

    public function addAgentPool(string $capability, array $agents): void
    {
        $this->agentPools[$capability] = $agents;
    }

    public function getAgent(string $capability): Agent
    {
        if (!isset($this->agentPools[$capability])) {
            throw new \InvalidArgumentException("No agents available for capability: {$capability}");
        }

        $agents = $this->agentPools[$capability];
        $selectedAgent = $this->loadBalancer->selectAgent($agents);

        return $selectedAgent;
    }

    public function distributeTask(Task $task): array
    {
        $requiredCapabilities = $task->getRequiredCapabilities();
        $assignments = [];

        foreach ($requiredCapabilities as $capability) {
            $agent = $this->getAgent($capability);
            $assignments[] = new TaskAssignment($agent, $task, $capability);
        }

        return $assignments;
    }
}
```

## Best Practices

### 1. Agent Design

- **Clear Responsibilities**: Each agent should have well-defined responsibilities
- **Loose Coupling**: Agents should be independent and communicate through messages
- **Fault Tolerance**: Design agents to handle failures gracefully
- **State Management**: Maintain minimal state and use external storage when needed

### 2. Communication

- **Async Messaging**: Use asynchronous communication patterns
- **Message Protocols**: Define clear message formats and protocols
- **Error Handling**: Handle communication failures gracefully
- **Timeout Management**: Implement proper timeouts for agent interactions

### 3. Coordination

- **Task Decomposition**: Break complex tasks into manageable subtasks
- **Capability Matching**: Match tasks to agents based on capabilities
- **Load Distribution**: Distribute work evenly across agents
- **Progress Monitoring**: Track progress of distributed tasks

### 4. Monitoring

- **Health Monitoring**: Continuously monitor agent health
- **Performance Metrics**: Track agent performance and efficiency
- **Error Tracking**: Log and analyze agent errors
- **Resource Usage**: Monitor CPU, memory, and network usage

## See Also

- [Building AI Agents](building-agents) - Individual agent development
- [Agent Orchestration](orchestration) - Advanced coordination patterns
- [Best Practices](best-practices) - Production patterns
- [Examples](building-agents) - Working multi-agent examples
