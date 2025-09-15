# Testing Guide

Comprehensive testing strategies for MCP servers and clients using PHPUnit and other testing tools.

## Unit Testing

### Testing Servers

```php
use PHPUnit\Framework\TestCase;
use MCP\Server\McpServer;
use MCP\Types\Implementation;

class ServerTest extends TestCase
{
    private McpServer $server;

    protected function setUp(): void
    {
        $this->server = new McpServer(
            new Implementation('test-server', '1.0.0')
        );
    }

    public function testToolRegistration(): void
    {
        $this->server->tool('test', 'Test tool', ['type' => 'object'],
            fn($params) => ['content' => [['type' => 'text', 'text' => 'success']]]
        );

        $tools = $this->server->listTools();
        $this->assertCount(1, $tools['tools']);
    }
}
```

### Testing Clients

```php
class ClientTest extends TestCase
{
    public function testClientConnection(): void
    {
        $client = new Client(new Implementation('test-client', '1.0.0'));
        $mockTransport = new MockTransport();

        $client->connect($mockTransport)->await();
        $this->assertTrue($client->isConnected());
    }
}
```

## Integration Testing

### Full Workflow Tests

```php
class IntegrationTest extends TestCase
{
    public function testServerClientWorkflow(): void
    {
        // Start server in background
        $serverProcess = new Process(['php', 'test-server.php']);
        $serverProcess->start();

        try {
            // Connect client
            $client = new Client(new Implementation('test', '1.0.0'));
            $transport = new StdioClientTransport(['php', 'test-server.php']);

            $client->connect($transport)->await();

            // Test operations
            $result = $client->callTool('echo', ['message' => 'test'])->await();
            $this->assertEquals('test', $result['content'][0]['text']);

            $client->close()->await();
        } finally {
            $serverProcess->stop();
        }
    }
}
```

## See Also

- [Examples](../examples/)
- [Error Handling](error-handling)
- [Performance](performance)
