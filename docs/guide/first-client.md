# Build Your First MCP Client in 10 Minutes

Learn how to create an MCP client that connects to servers and uses their tools, resources, and prompts.

## 🎯 What You'll Build

A **Multi-Server Client** that can:

- ✅ **Connect to multiple MCP servers** simultaneously
- ✅ **Discover server capabilities** automatically
- ✅ **Call tools** from different servers
- ✅ **Read resources** and access data
- ✅ **Handle errors** gracefully

## 📋 Prerequisites

- PHP 8.1+ installed
- Composer installed
- Basic understanding of async programming
- An MCP server to connect to (use our [First Server](first-server) example)

## 🚀 Let's Build!

### Step 1: Create the Client File (5 minutes)

Create `multi-server-client.php`:

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

class MultiServerClient
{
    private array $clients = [];
    private array $servers = [];

    public function __construct()
    {
        // Define servers to connect to
        $this->servers = [
            'calculator' => [
                'name' => 'Calculator Server',
                'command' => 'php',
                'args' => [__DIR__ . '/calculator-server.php']
            ],
            'personal-assistant' => [
                'name' => 'Personal Assistant',
                'command' => 'php',
                'args' => [__DIR__ . '/personal-assistant-server.php']
            ]
        ];
    }

    public function run(): void
    {
        async(function() {
            try {
                echo "🚀 Multi-Server MCP Client Starting...\n";
                echo "=====================================\n\n";

                // Connect to all servers
                yield from $this->connectToServers();

                // Discover capabilities
                yield from $this->discoverCapabilities();

                // Demonstrate tool usage
                yield from $this->demonstrateTools();

                // Demonstrate resource access
                yield from $this->demonstrateResources();

                // Clean shutdown
                yield from $this->shutdown();

                echo "\n✅ Client session completed successfully!\n";

            } catch (\Exception $e) {
                echo "❌ Client error: {$e->getMessage()}\n";
                echo "Stack trace: {$e->getTraceAsString()}\n";
            }
        })->await();
    }

    private function connectToServers(): \Generator
    {
        echo "🔌 Connecting to servers...\n";

        foreach ($this->servers as $id => $config) {
            try {
                echo "  Connecting to {$config['name']}... ";

                $client = new Client(new Implementation('multi-client', '1.0.0'));
                $transport = new StdioClientTransport([
                    'command' => $config['command'],
                    'args' => $config['args']
                ]);

                yield $client->connect($transport);
                $this->clients[$id] = $client;

                echo "✅ Connected\n";
            } catch (\Exception $e) {
                echo "❌ Failed: {$e->getMessage()}\n";
            }
        }

        echo "\n";
    }

    private function discoverCapabilities(): \Generator
    {
        echo "🔍 Discovering server capabilities...\n";

        foreach ($this->clients as $id => $client) {
            try {
                $serverName = $this->servers[$id]['name'];
                echo "\n📊 {$serverName}:\n";

                // List tools
                $toolsResult = yield $client->listTools();
                echo "  🔧 Tools ({$toolsResult['tools']->count()}):\n";
                foreach ($toolsResult['tools'] as $tool) {
                    echo "    - {$tool['name']}: {$tool['description']}\n";
                }

                // List resources
                $resourcesResult = yield $client->listResources();
                if (!empty($resourcesResult['resources'])) {
                    echo "  📦 Resources ({$resourcesResult['resources']->count()}):\n";
                    foreach ($resourcesResult['resources'] as $resource) {
                        echo "    - {$resource['uri']}: {$resource['name']}\n";
                    }
                }

                // List prompts
                $promptsResult = yield $client->listPrompts();
                if (!empty($promptsResult['prompts'])) {
                    echo "  💡 Prompts ({$promptsResult['prompts']->count()}):\n";
                    foreach ($promptsResult['prompts'] as $prompt) {
                        echo "    - {$prompt['name']}: {$prompt['description']}\n";
                    }
                }

            } catch (\Exception $e) {
                echo "  ❌ Error discovering capabilities: {$e->getMessage()}\n";
            }
        }

        echo "\n";
    }

    private function demonstrateTools(): \Generator
    {
        echo "🛠️  Demonstrating tool usage...\n";

        // Calculator tools
        if (isset($this->clients['calculator'])) {
            echo "\n🧮 Calculator Tools:\n";
            try {
                $client = $this->clients['calculator'];

                // Addition
                $result = yield $client->callTool('add', ['a' => 15, 'b' => 27]);
                echo "  Addition: {$result['content'][0]['text']}\n";

                // Division with error handling
                $result = yield $client->callTool('divide', ['a' => 100, 'b' => 4]);
                echo "  Division: {$result['content'][0]['text']}\n";

                // Square root
                $result = yield $client->callTool('sqrt', ['number' => 144]);
                echo "  Square Root: {$result['content'][0]['text']}\n";

            } catch (\Exception $e) {
                echo "  ❌ Calculator error: {$e->getMessage()}\n";
            }
        }

        // Personal assistant tools
        if (isset($this->clients['personal-assistant'])) {
            echo "\n📝 Personal Assistant Tools:\n";
            try {
                $client = $this->clients['personal-assistant'];

                // Save a note
                $result = yield $client->callTool('save-note', [
                    'title' => 'Client Demo Note',
                    'content' => 'This note was created by the multi-server client demo!'
                ]);
                echo "  Save Note: {$result['content'][0]['text']}\n";

                // List notes
                $result = yield $client->callTool('list-notes', []);
                echo "  List Notes: {$result['content'][0]['text']}\n";

                // Calculator
                $result = yield $client->callTool('calculate', ['expression' => '25 * 4']);
                echo "  Calculate: {$result['content'][0]['text']}\n";

            } catch (\Exception $e) {
                echo "  ❌ Personal assistant error: {$e->getMessage()}\n";
            }
        }
    }

    private function demonstrateResources(): \Generator
    {
        echo "\n📚 Demonstrating resource access...\n";

        foreach ($this->clients as $id => $client) {
            try {
                $serverName = $this->servers[$id]['name'];

                // Try to read system info resource
                if ($id === 'personal-assistant') {
                    echo "\n💻 {$serverName} System Info:\n";
                    $result = yield $client->readResource('system://info');
                    $systemInfo = json_decode($result['contents'][0]['text'], true);

                    echo "  Server: {$systemInfo['server_name']}\n";
                    echo "  Version: {$systemInfo['version']}\n";
                    echo "  PHP Version: {$systemInfo['php_version']}\n";
                    echo "  Memory Usage: " . number_format($systemInfo['memory_usage'] / 1024 / 1024, 2) . " MB\n";
                }

                // Try to read calculator history
                if ($id === 'calculator') {
                    echo "\n📊 {$serverName} History:\n";
                    $result = yield $client->readResource('calculator://history');
                    echo "  " . str_replace("\n", "\n  ", trim($result['contents'][0]['text'])) . "\n";
                }

            } catch (\Exception $e) {
                echo "  ❌ Resource access error for {$this->servers[$id]['name']}: {$e->getMessage()}\n";
            }
        }
    }

    private function shutdown(): \Generator
    {
        echo "\n🔌 Shutting down connections...\n";

        foreach ($this->clients as $id => $client) {
            try {
                yield $client->close();
                echo "  ✅ Disconnected from {$this->servers[$id]['name']}\n";
            } catch (\Exception $e) {
                echo "  ⚠️  Error disconnecting from {$this->servers[$id]['name']}: {$e->getMessage()}\n";
            }
        }
    }
}

// Run the client
$client = new MultiServerClient();
$client->run();
```

### Step 2: Create a Simple Test Client (3 minutes)

For testing individual servers, create `simple-test-client.php`:

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use function Amp\async;

// Get server command from arguments
$serverCommand = $argv[1] ?? 'php';
$serverScript = $argv[2] ?? './hello-world-server.php';

echo "🧪 Simple MCP Client Test\n";
echo "========================\n";
echo "Connecting to: {$serverCommand} {$serverScript}\n\n";

async(function() use ($serverCommand, $serverScript) {
    try {
        // Create client
        $client = new Client(new Implementation('test-client', '1.0.0'));

        // Create transport
        $transport = new StdioClientTransport([
            'command' => $serverCommand,
            'args' => [$serverScript]
        ]);

        // Connect
        echo "🔌 Connecting to server...\n";
        $initResult = yield $client->connect($transport);
        echo "✅ Connected to: {$initResult->serverInfo->name} v{$initResult->serverInfo->version}\n\n";

        // List and test tools
        echo "🔧 Available Tools:\n";
        $toolsResult = yield $client->listTools();

        foreach ($toolsResult['tools'] as $tool) {
            echo "  - {$tool['name']}: {$tool['description']}\n";

            // Test the first tool with sample data
            if ($tool['name'] === 'say_hello') {
                echo "    Testing with name='World'...\n";
                $result = yield $client->callTool('say_hello', ['name' => 'Test Client']);
                echo "    Result: {$result['content'][0]['text']}\n";
            } elseif ($tool['name'] === 'add') {
                echo "    Testing with a=5, b=3...\n";
                $result = yield $client->callTool('add', ['a' => 5, 'b' => 3]);
                echo "    Result: {$result['content'][0]['text']}\n";
            }
        }

        // List resources
        echo "\n📦 Available Resources:\n";
        $resourcesResult = yield $client->listResources();

        foreach ($resourcesResult['resources'] as $resource) {
            echo "  - {$resource['uri']}: {$resource['name']}\n";

            // Try to read the first resource
            if (count($resourcesResult['resources']) > 0) {
                echo "    Reading resource...\n";
                $result = yield $client->readResource($resource['uri']);
                $content = substr($result['contents'][0]['text'], 0, 100);
                echo "    Content preview: " . str_replace("\n", " ", $content) . "...\n";
                break; // Only test first resource
            }
        }

        // List prompts
        echo "\n💡 Available Prompts:\n";
        $promptsResult = yield $client->listPrompts();

        foreach ($promptsResult['prompts'] as $prompt) {
            echo "  - {$prompt['name']}: {$prompt['description']}\n";
        }

        // Clean shutdown
        echo "\n🔌 Disconnecting...\n";
        yield $client->close();
        echo "✅ Test completed successfully!\n";

    } catch (\Exception $e) {
        echo "❌ Test failed: {$e->getMessage()}\n";
        echo "Stack trace: {$e->getTraceAsString()}\n";
    }
})->await();
```

### Step 3: Test Your Client (2 minutes)

```bash
# Make files executable
chmod +x multi-server-client.php
chmod +x simple-test-client.php

# Test with a simple server
php simple-test-client.php php hello-world-server.php

# Test with multiple servers (requires both servers to exist)
php multi-server-client.php
```

## 🏗️ Understanding Client Architecture

### Key Components

1. **Client Instance** - Manages connection and protocol
2. **Transport** - Communication layer (STDIO, HTTP, WebSocket)
3. **Connection Management** - Handle connect/disconnect lifecycle
4. **Capability Discovery** - Find available tools, resources, prompts
5. **Error Handling** - Graceful failure management

### Client Lifecycle

```php
// 1. Create client
$client = new Client(new Implementation('my-client', '1.0.0'));

// 2. Create transport
$transport = new StdioClientTransport(['command' => 'php', 'args' => ['server.php']]);

// 3. Connect and initialize
$initResult = yield $client->connect($transport);

// 4. Discover capabilities
$tools = yield $client->listTools();
$resources = yield $client->listResources();
$prompts = yield $client->listPrompts();

// 5. Use capabilities
$result = yield $client->callTool('tool-name', $params);
$content = yield $client->readResource('resource-uri');
$prompt = yield $client->getPrompt('prompt-name', $args);

// 6. Clean shutdown
yield $client->close();
```

### Error Handling Patterns

```php
try {
    $result = yield $client->callTool('risky-tool', $params);
} catch (\MCP\Types\McpError $e) {
    // Handle MCP-specific errors
    echo "MCP Error [{$e->getCode()}]: {$e->getMessage()}\n";
} catch (\Exception $e) {
    // Handle general errors
    echo "General Error: {$e->getMessage()}\n";
}
```

## 🔧 Advanced Client Features

### 1. Parallel Operations

```php
// Call multiple tools concurrently
$promises = [
    $client->callTool('tool1', $params1),
    $client->callTool('tool2', $params2),
    $client->callTool('tool3', $params3)
];

$results = yield $promises; // Wait for all to complete
```

### 2. Connection Pooling

```php
class ClientPool
{
    private array $clients = [];

    public function getClient(string $serverId): Client
    {
        if (!isset($this->clients[$serverId])) {
            $this->clients[$serverId] = $this->createClient($serverId);
        }
        return $this->clients[$serverId];
    }

    private function createClient(string $serverId): Client
    {
        // Client creation logic
    }
}
```

### 3. Retry Logic

```php
async function callToolWithRetry($client, $toolName, $params, $maxRetries = 3): \Generator
{
    $attempt = 0;

    while ($attempt < $maxRetries) {
        try {
            return yield $client->callTool($toolName, $params);
        } catch (\Exception $e) {
            $attempt++;
            if ($attempt >= $maxRetries) {
                throw $e;
            }

            echo "Retry attempt {$attempt} after error: {$e->getMessage()}\n";
            yield delay(1000 * $attempt); // Exponential backoff
        }
    }
}
```

### 4. Response Caching

```php
class CachingClient
{
    private Client $client;
    private array $cache = [];
    private int $ttl = 300; // 5 minutes

    public function callTool(string $name, array $params): \Generator
    {
        $cacheKey = md5($name . json_encode($params));

        if (isset($this->cache[$cacheKey]) &&
            $this->cache[$cacheKey]['expires'] > time()) {
            return $this->cache[$cacheKey]['result'];
        }

        $result = yield $this->client->callTool($name, $params);

        $this->cache[$cacheKey] = [
            'result' => $result,
            'expires' => time() + $this->ttl
        ];

        return $result;
    }
}
```

## 🎉 Congratulations!

You've built your first MCP client! Here's what you accomplished:

✅ **Created a multi-server client** that connects to multiple servers  
✅ **Implemented capability discovery** to find tools and resources  
✅ **Added error handling** for robust operation  
✅ **Built reusable patterns** for client development

## 🚀 Next Steps

### Immediate Enhancements

1. **Add Configuration Management**:

   ```php
   // Load server configs from JSON/YAML
   $servers = json_decode(file_get_contents('servers.json'), true);
   ```

2. **Add Logging**:

   ```php
   use Monolog\Logger;
   $logger = new Logger('mcp-client');
   ```

3. **Add Metrics**:
   ```php
   // Track tool call performance
   $startTime = microtime(true);
   $result = yield $client->callTool($name, $params);
   $duration = microtime(true) - $startTime;
   ```

### Real-World Applications

- **AI Assistant Dashboard** - Web interface for multiple MCP servers
- **DevOps Orchestrator** - Coordinate multiple development tools
- **Data Pipeline Manager** - Orchestrate data processing servers
- **Monitoring Dashboard** - Collect metrics from multiple servers

### Learning Path

1. **📖 Advanced Patterns**: [Client Development Guide](creating-clients)
2. **🔐 Add Security**: [Authentication Guide](authentication)
3. **🌐 Web Integration**: [HTTP Transport](transports)
4. **🏗️ Framework Integration**: [Laravel Client](../integrations/laravel)

## 🆘 Need Help?

### Common Issues

**Connection timeout**: Increase timeout in transport configuration  
**Server not found**: Check server path and executable permissions  
**Tool call failures**: Verify parameter names and types match schema  
**Memory issues**: Use streaming for large responses

### Debugging Tips

```bash
# Enable debug logging
DEBUG=1 php client.php

# Test server directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | php server.php

# Check server process
ps aux | grep server.php
```

### Getting Help

- 📖 [Client API Reference](../api/client)
- 🐛 [Report Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- 💬 [Community Discussions](https://github.com/dalehurley/php-mcp-sdk/discussions)

## 🎯 What's Next?

You're now ready to build sophisticated MCP clients! Explore:

- **Multi-Server Orchestration** - Coordinate complex workflows across servers
- **Web-Based Clients** - Build browser-based MCP interfaces
- **AI Agent Integration** - Connect clients to LLMs for intelligent automation
- **Production Deployment** - Scale clients for enterprise use

**Ready for advanced topics?** → [Advanced Client Patterns](creating-clients)

---

_🎉 You've mastered MCP client development. Time to build something amazing!_
