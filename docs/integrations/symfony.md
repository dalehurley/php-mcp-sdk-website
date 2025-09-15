# Symfony Integration

Complete Symfony integration with bundle configuration, console commands, and dependency injection patterns.

## Overview

The PHP MCP SDK integrates seamlessly with Symfony through:

- Bundle configuration and services
- Console commands for MCP management
- Event system integration
- Dependency injection patterns
- Twig extensions for templating

## Bundle Setup

### Create MCP Bundle

Create `src/Bundle/McpBundle/McpBundle.php`:

```php
<?php

namespace App\Bundle\McpBundle;

use Symfony\Component\HttpKernel\Bundle\Bundle;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use App\Bundle\McpBundle\DependencyInjection\McpExtension;

class McpBundle extends Bundle
{
    public function build(ContainerBuilder $container): void
    {
        parent::build($container);
    }

    public function getContainerExtension()
    {
        return new McpExtension();
    }
}
```

### Dependency Injection Extension

Create `src/Bundle/McpBundle/DependencyInjection/McpExtension.php`:

```php
<?php

namespace App\Bundle\McpBundle\DependencyInjection;

use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;
use Symfony\Component\Config\FileLocator;

class McpExtension extends Extension
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $loader = new YamlFileLoader(
            $container,
            new FileLocator(__DIR__.'/../Resources/config')
        );

        $loader->load('services.yaml');

        $configuration = new Configuration();
        $config = $this->processConfiguration($configuration, $configs);

        $container->setParameter('mcp.server.name', $config['server']['name']);
        $container->setParameter('mcp.server.version', $config['server']['version']);
    }
}
```

## Service Configuration

### services.yaml

Create `src/Bundle/McpBundle/Resources/config/services.yaml`:

```yaml
services:
  mcp.server:
    class: MCP\Server\McpServer
    arguments:
      - "@mcp.implementation"
    calls:
      - ["setLogger", ["@logger"]]
    tags:
      - { name: monolog.logger, channel: mcp }

  mcp.implementation:
    class: MCP\Types\Implementation
    arguments:
      - "%mcp.server.name%"
      - "%mcp.server.version%"
      - "Symfony MCP Server"

  mcp.tool.user_manager:
    class: App\Mcp\Tools\UserManagerTool
    arguments:
      - "@doctrine.orm.entity_manager"
    tags:
      - { name: mcp.tool }

  mcp.tool.cache_manager:
    class: App\Mcp\Tools\CacheManagerTool
    arguments:
      - "@cache.app"
    tags:
      - { name: mcp.tool }
```

## Console Commands

### MCP Server Command

Create `src/Command/McpServerCommand.php`:

```php
<?php

namespace App\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Server\Transport\HttpServerTransport;

#[AsCommand(
    name: 'mcp:server',
    description: 'Start MCP server'
)]
class McpServerCommand extends Command
{
    public function __construct(
        private McpServer $mcpServer
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('transport', 't', InputOption::VALUE_OPTIONAL, 'Transport type', 'stdio')
            ->addOption('host', null, InputOption::VALUE_OPTIONAL, 'HTTP host', '127.0.0.1')
            ->addOption('port', 'p', InputOption::VALUE_OPTIONAL, 'HTTP port', 3000);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $transport = $input->getOption('transport');

        $output->writeln("Starting MCP server with {$transport} transport...");

        try {
            if ($transport === 'http') {
                $httpTransport = new HttpServerTransport([
                    'host' => $input->getOption('host'),
                    'port' => (int) $input->getOption('port'),
                ]);

                $output->writeln("HTTP server starting on {$input->getOption('host')}:{$input->getOption('port')}");
                $this->mcpServer->connect($httpTransport)->await();
            } else {
                $stdioTransport = new StdioServerTransport();
                $this->mcpServer->connect($stdioTransport)->await();
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $output->writeln("<error>Failed to start MCP server: {$e->getMessage()}</error>");
            return Command::FAILURE;
        }
    }
}
```

## MCP Tools as Services

### User Manager Tool

Create `src/Mcp/Tools/UserManagerTool.php`:

```php
<?php

namespace App\Mcp\Tools;

use Doctrine\ORM\EntityManagerInterface;
use MCP\Server\McpServer;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;

class UserManagerTool
{
    public function __construct(
        private EntityManagerInterface $entityManager
    ) {}

    public function register(McpServer $server): void
    {
        $server->tool(
            'get_users',
            'Get users from database',
            [
                'type' => 'object',
                'properties' => [
                    'limit' => ['type' => 'integer', 'default' => 10],
                    'search' => ['type' => 'string']
                ]
            ],
            [$this, 'getUsers']
        );

        $server->tool(
            'create_user',
            'Create new user',
            [
                'type' => 'object',
                'properties' => [
                    'email' => ['type' => 'string', 'format' => 'email'],
                    'name' => ['type' => 'string', 'minLength' => 1]
                ],
                'required' => ['email', 'name']
            ],
            [$this, 'createUser']
        );
    }

    public function getUsers(array $params): array
    {
        $repository = $this->entityManager->getRepository(\App\Entity\User::class);
        $queryBuilder = $repository->createQueryBuilder('u');

        if (!empty($params['search'])) {
            $queryBuilder->where('u.name LIKE :search OR u.email LIKE :search')
                        ->setParameter('search', "%{$params['search']}%");
        }

        $users = $queryBuilder->setMaxResults($params['limit'] ?? 10)
                             ->getQuery()
                             ->getResult();

        return [
            'content' => [[
                'type' => 'text',
                'text' => json_encode(array_map(function($user) {
                    return [
                        'id' => $user->getId(),
                        'name' => $user->getName(),
                        'email' => $user->getEmail(),
                        'created_at' => $user->getCreatedAt()->format('c')
                    ];
                }, $users), JSON_PRETTY_PRINT)
            ]]
        ];
    }

    public function createUser(array $params): array
    {
        $user = new \App\Entity\User();
        $user->setName($params['name']);
        $user->setEmail($params['email']);
        $user->setCreatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return [
            'content' => [[
                'type' => 'text',
                'text' => "User created successfully with ID: {$user->getId()}"
            ]]
        ];
    }
}
```

## Configuration

### Bundle Configuration

Create `config/packages/mcp.yaml`:

```yaml
mcp:
  server:
    name: "%env(MCP_SERVER_NAME)%"
    version: "%env(MCP_SERVER_VERSION)%"
    description: "Symfony MCP Server"

  transport:
    default: "%env(MCP_TRANSPORT)%"
    stdio:
      buffer_size: 8192
    http:
      host: "%env(MCP_HTTP_HOST)%"
      port: "%env(MCP_HTTP_PORT)%"
      ssl: "%env(bool:MCP_HTTP_SSL)%"

  auth:
    enabled: "%env(bool:MCP_AUTH_ENABLED)%"
    provider: "symfony_security"

  tools:
    enabled:
      user_management: true
      cache_management: true
      console_commands: false
```

## Event Integration

### MCP Event Listener

Create `src/EventListener/McpEventListener.php`:

```php
<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use App\Event\McpToolCalledEvent;
use Psr\Log\LoggerInterface;

class McpEventListener implements EventSubscriberInterface
{
    public function __construct(
        private LoggerInterface $logger
    ) {}

    public static function getSubscribedEvents(): array
    {
        return [
            McpToolCalledEvent::class => 'onToolCalled',
        ];
    }

    public function onToolCalled(McpToolCalledEvent $event): void
    {
        $this->logger->info('MCP tool called', [
            'tool' => $event->getToolName(),
            'params' => $event->getParameters(),
            'duration' => $event->getDuration(),
            'success' => $event->isSuccess()
        ]);
    }
}
```

## Twig Integration

### MCP Twig Extension

Create `src/Twig/McpExtension.php`:

```php
<?php

namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;
use MCP\Client\Client;

class McpExtension extends AbstractExtension
{
    public function __construct(
        private Client $mcpClient
    ) {}

    public function getFunctions(): array
    {
        return [
            new TwigFunction('mcp_call_tool', [$this, 'callTool']),
            new TwigFunction('mcp_read_resource', [$this, 'readResource']),
        ];
    }

    public function callTool(string $name, array $params = []): array
    {
        try {
            return $this->mcpClient->callTool($name, $params)->await();
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    public function readResource(string $uri): array
    {
        try {
            return $this->mcpClient->readResource($uri)->await();
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }
}
```

## Usage in Templates

```twig
{# templates/dashboard.html.twig #}
<div class="mcp-dashboard">
    <h2>MCP Integration Dashboard</h2>

    <div class="tools-section">
        <h3>Available Tools</h3>
        {% set tools_result = mcp_call_tool('list_tools') %}
        {% if tools_result.error is not defined %}
            <ul>
                {% for tool in tools_result.tools %}
                    <li>{{ tool.name }} - {{ tool.description }}</li>
                {% endfor %}
            </ul>
        {% else %}
            <p class="error">Error: {{ tools_result.error }}</p>
        {% endif %}
    </div>

    <div class="resources-section">
        <h3>System Information</h3>
        {% set system_info = mcp_read_resource('system://info') %}
        {% if system_info.error is not defined %}
            <pre>{{ system_info.contents[0].text }}</pre>
        {% endif %}
    </div>
</div>
```

## Testing

### Symfony Test Case

```php
<?php

namespace App\Tests\Integration;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use MCP\Server\McpServer;

class McpIntegrationTest extends WebTestCase
{
    public function testMcpServerService(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();

        $mcpServer = $container->get(McpServer::class);
        $this->assertInstanceOf(McpServer::class, $mcpServer);
    }

    public function testMcpApiEndpoint(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/mcp/tools');

        $this->assertResponseIsSuccessful();
        $this->assertResponseHeaderSame('Content-Type', 'application/json');
    }
}
```

## Best Practices

### 1. Service Organization

- Register MCP tools as separate services
- Use dependency injection for tool dependencies
- Implement proper service tagging
- Follow Symfony service conventions

### 2. Configuration Management

- Use environment variables for sensitive data
- Implement proper configuration validation
- Use Symfony's configuration component
- Support multiple environments

### 3. Security

- Integrate with Symfony Security component
- Use proper authentication and authorization
- Validate all inputs using Symfony Validator
- Implement CSRF protection for web endpoints

### 4. Performance

- Use Symfony's cache component for MCP results
- Implement proper logging with Monolog
- Use async processing where appropriate
- Monitor performance with Symfony Profiler

## See Also

- [Symfony Documentation](https://symfony.com/doc)
- [Server API Reference](../api/server)
- [Authentication Guide](../guide/authentication)
- [Examples](../examples/)
