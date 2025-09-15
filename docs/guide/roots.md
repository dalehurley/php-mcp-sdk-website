# Roots Management

Learn how to implement and use filesystem roots in MCP clients to control server access to directories and files.

## Overview

Roots in MCP define the boundaries of where servers can operate within the filesystem. They allow clients to expose specific directories and files to servers while maintaining security and control. Based on the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/client/roots), roots provide:

- **Controlled Access**: Define which directories servers can access
- **Security Boundaries**: Prevent unauthorized file system access
- **Dynamic Updates**: Change available roots during runtime
- **User Control**: Let users decide what to expose

## Client Implementation

### Declaring Roots Capability

Clients that support roots must declare the capability during initialization:

```php
use MCP\Client\Client;
use MCP\Types\Implementation;

$client = new Client(
    new Implementation('my-client', '1.0.0'),
    [
        'capabilities' => [
            'roots' => [
                'listChanged' => true // Support change notifications
            ]
        ]
    ]
);
```

### Setting Up Roots

```php
class RootsManager
{
    private Client $client;
    private array $roots = [];
    private array $watchers = [];

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function addRoot(string $uri, string $name): void
    {
        // Validate URI format
        if (!$this->isValidFileUri($uri)) {
            throw new \InvalidArgumentException("Invalid file URI: {$uri}");
        }

        // Check if path exists and is accessible
        $path = $this->uriToPath($uri);
        if (!file_exists($path) || !is_readable($path)) {
            throw new \InvalidArgumentException("Path not accessible: {$path}");
        }

        $this->roots[] = [
            'uri' => $uri,
            'name' => $name
        ];

        // Set up file system watcher for changes
        $this->setupWatcher($uri);

        // Notify servers of root list change
        $this->notifyRootListChanged();
    }

    public function removeRoot(string $uri): void
    {
        $this->roots = array_filter(
            $this->roots,
            fn($root) => $root['uri'] !== $uri
        );

        // Remove watcher
        if (isset($this->watchers[$uri])) {
            $this->watchers[$uri]->stop();
            unset($this->watchers[$uri]);
        }

        $this->notifyRootListChanged();
    }

    public function listRoots(): array
    {
        return [
            'roots' => array_values($this->roots)
        ];
    }

    private function setupWatcher(string $uri): void
    {
        $path = $this->uriToPath($uri);

        // Set up file system watcher (using inotify or similar)
        $watcher = new FileSystemWatcher($path);

        $watcher->onChanged(function() use ($uri) {
            $this->notifyRootListChanged();
        });

        $this->watchers[$uri] = $watcher;
    }

    private function notifyRootListChanged(): void
    {
        // Send notification to all connected servers
        $this->client->sendNotification('notifications/roots/list_changed');
    }

    private function isValidFileUri(string $uri): bool
    {
        return preg_match('/^file:\/\/\/.*/', $uri) === 1;
    }

    private function uriToPath(string $uri): string
    {
        return urldecode(substr($uri, 7)); // Remove 'file://' prefix
    }
}
```

## Server-Side Roots Usage

### Requesting Roots from Client

```php
class RootsAwareServer
{
    private McpServer $server;
    private array $availableRoots = [];

    public function __construct()
    {
        $this->server = new McpServer(
            new Implementation('roots-server', '1.0.0')
        );

        $this->registerRootsTools();
    }

    private function registerRootsTools(): void
    {
        // Tool to list available roots
        $this->server->tool(
            'list_available_roots',
            'List filesystem roots available to this server',
            ['type' => 'object', 'properties' => []],
            function (): array {
                // Request roots from client
                $result = $this->requestRootsFromClient();

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode($result, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool to list files in a root
        $this->server->tool(
            'list_files_in_root',
            'List files in a specific root directory',
            [
                'type' => 'object',
                'properties' => [
                    'root_uri' => [
                        'type' => 'string',
                        'description' => 'URI of the root to list files from'
                    ],
                    'recursive' => [
                        'type' => 'boolean',
                        'default' => false,
                        'description' => 'List files recursively'
                    ]
                ],
                'required' => ['root_uri']
            ],
            function (array $params): array {
                $rootUri = $params['root_uri'];
                $recursive = $params['recursive'] ?? false;

                // Validate root is available
                if (!$this->isRootAvailable($rootUri)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Root not available: {$rootUri}"
                    );
                }

                $files = $this->listFilesInRoot($rootUri, $recursive);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'root_uri' => $rootUri,
                            'file_count' => count($files),
                            'files' => $files
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function requestRootsFromClient(): array
    {
        // Send roots/list request to client
        $request = [
            'jsonrpc' => '2.0',
            'id' => uniqid(),
            'method' => 'roots/list'
        ];

        $response = $this->sendRequestToClient($request);

        if (isset($response['result']['roots'])) {
            $this->availableRoots = $response['result']['roots'];
            return $response['result'];
        }

        throw new McpError(
            ErrorCode::InternalError,
            'Failed to get roots from client'
        );
    }

    private function isRootAvailable(string $uri): bool
    {
        foreach ($this->availableRoots as $root) {
            if ($root['uri'] === $uri) {
                return true;
            }
        }
        return false;
    }

    private function listFilesInRoot(string $rootUri, bool $recursive): array
    {
        $rootPath = $this->uriToPath($rootUri);
        $files = [];

        if ($recursive) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($rootPath)
            );
        } else {
            $iterator = new \DirectoryIterator($rootPath);
        }

        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isDot()) {
                continue;
            }

            $files[] = [
                'name' => $fileInfo->getFilename(),
                'path' => $fileInfo->getPathname(),
                'uri' => $this->pathToUri($fileInfo->getPathname()),
                'type' => $fileInfo->isDir() ? 'directory' : 'file',
                'size' => $fileInfo->getSize(),
                'modified' => $fileInfo->getMTime()
            ];
        }

        return $files;
    }

    private function uriToPath(string $uri): string
    {
        return urldecode(substr($uri, 7)); // Remove 'file://' prefix
    }

    private function pathToUri(string $path): string
    {
        return 'file://' . urlencode($path);
    }
}
```

## Practical Examples

### Project-Based Roots

```php
class ProjectRootsManager
{
    private RootsManager $rootsManager;
    private array $projects = [];

    public function addProject(string $name, string $path): void
    {
        $uri = 'file://' . realpath($path);
        $this->rootsManager->addRoot($uri, $name);

        $this->projects[$name] = [
            'path' => $path,
            'uri' => $uri,
            'added_at' => time()
        ];

        echo "📁 Added project root: {$name} -> {$path}\n";
    }

    public function detectProjectRoots(): array
    {
        $detectedProjects = [];
        $searchPaths = [
            $_SERVER['HOME'] . '/projects',
            $_SERVER['HOME'] . '/workspace',
            $_SERVER['HOME'] . '/code'
        ];

        foreach ($searchPaths as $searchPath) {
            if (!is_dir($searchPath)) {
                continue;
            }

            foreach (new \DirectoryIterator($searchPath) as $dir) {
                if ($dir->isDot() || !$dir->isDir()) {
                    continue;
                }

                $projectPath = $dir->getPathname();

                // Check for project indicators
                if ($this->isProjectDirectory($projectPath)) {
                    $detectedProjects[] = [
                        'name' => $dir->getFilename(),
                        'path' => $projectPath,
                        'type' => $this->detectProjectType($projectPath)
                    ];
                }
            }
        }

        return $detectedProjects;
    }

    private function isProjectDirectory(string $path): bool
    {
        $projectIndicators = [
            'composer.json',    // PHP project
            'package.json',     // Node.js project
            'requirements.txt', // Python project
            'go.mod',          // Go project
            '.git',            // Git repository
            'Makefile',        // Make-based project
            'Dockerfile'       // Docker project
        ];

        foreach ($projectIndicators as $indicator) {
            if (file_exists($path . DIRECTORY_SEPARATOR . $indicator)) {
                return true;
            }
        }

        return false;
    }

    private function detectProjectType(string $path): string
    {
        if (file_exists($path . '/composer.json')) return 'php';
        if (file_exists($path . '/package.json')) return 'nodejs';
        if (file_exists($path . '/requirements.txt')) return 'python';
        if (file_exists($path . '/go.mod')) return 'go';
        if (file_exists($path . '/Cargo.toml')) return 'rust';
        if (file_exists($path . '/.git')) return 'git';

        return 'unknown';
    }
}
```

### Repository-Based Roots

```php
class RepositoryRootsManager
{
    public function addRepositoryRoots(array $repositories): void
    {
        foreach ($repositories as $repo) {
            $this->addRepositoryRoot($repo);
        }
    }

    private function addRepositoryRoot(array $repo): void
    {
        $path = $repo['path'];
        $name = $repo['name'] ?? basename($path);

        // Validate repository
        if (!$this->isValidRepository($path)) {
            throw new \InvalidArgumentException("Invalid repository: {$path}");
        }

        $uri = 'file://' . realpath($path);
        $this->rootsManager->addRoot($uri, $name);

        echo "🔗 Added repository root: {$name}\n";
        echo "  Path: {$path}\n";
        echo "  Type: " . $this->getRepositoryType($path) . "\n";
        echo "  Branch: " . $this->getCurrentBranch($path) . "\n";
    }

    private function isValidRepository(string $path): bool
    {
        return is_dir($path . '/.git') ||
               is_dir($path . '/.svn') ||
               is_dir($path . '/.hg');
    }

    private function getCurrentBranch(string $path): string
    {
        $gitHead = $path . '/.git/HEAD';

        if (file_exists($gitHead)) {
            $head = trim(file_get_contents($gitHead));
            if (preg_match('/ref: refs\/heads\/(.+)/', $head, $matches)) {
                return $matches[1];
            }
        }

        return 'unknown';
    }
}
```

## Security Considerations

### Path Validation

```php
class SecureRootsValidator
{
    private array $allowedBasePaths;
    private array $deniedPaths;

    public function __construct(array $allowedBasePaths, array $deniedPaths = [])
    {
        $this->allowedBasePaths = array_map('realpath', $allowedBasePaths);
        $this->deniedPaths = array_map('realpath', $deniedPaths);
    }

    public function validateRoot(string $uri): bool
    {
        $path = $this->uriToPath($uri);
        $realPath = realpath($path);

        if (!$realPath) {
            return false; // Path doesn't exist
        }

        // Check against denied paths
        foreach ($this->deniedPaths as $deniedPath) {
            if ($deniedPath && strpos($realPath, $deniedPath) === 0) {
                return false;
            }
        }

        // Check against allowed base paths
        foreach ($this->allowedBasePaths as $allowedPath) {
            if ($allowedPath && strpos($realPath, $allowedPath) === 0) {
                return true;
            }
        }

        return false;
    }

    public function sanitizeRoots(array $roots): array
    {
        $sanitized = [];

        foreach ($roots as $root) {
            if ($this->validateRoot($root['uri'])) {
                $sanitized[] = [
                    'uri' => $root['uri'],
                    'name' => htmlspecialchars($root['name'], ENT_QUOTES, 'UTF-8')
                ];
            }
        }

        return $sanitized;
    }

    private function uriToPath(string $uri): string
    {
        if (!preg_match('/^file:\/\/(.*)$/', $uri, $matches)) {
            throw new \InvalidArgumentException("Invalid file URI: {$uri}");
        }

        return urldecode($matches[1]);
    }
}
```

### Access Control

```php
class RootsAccessControl
{
    private array $userPermissions = [];
    private array $rootPermissions = [];

    public function setUserPermissions(string $userId, array $permissions): void
    {
        $this->userPermissions[$userId] = $permissions;
    }

    public function setRootPermissions(string $rootUri, array $permissions): void
    {
        $this->rootPermissions[$rootUri] = $permissions;
    }

    public function canUserAccessRoot(string $userId, string $rootUri, string $operation): bool
    {
        // Check user-level permissions
        $userPerms = $this->userPermissions[$userId] ?? [];
        if (!in_array($operation, $userPerms)) {
            return false;
        }

        // Check root-level permissions
        $rootPerms = $this->rootPermissions[$rootUri] ?? ['read', 'write'];
        if (!in_array($operation, $rootPerms)) {
            return false;
        }

        return true;
    }

    public function filterRootsForUser(string $userId, array $roots): array
    {
        return array_filter($roots, function($root) use ($userId) {
            return $this->canUserAccessRoot($userId, $root['uri'], 'read');
        });
    }
}
```

## Complete Roots Example

### File Manager MCP Client

```php
#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use function Amp\async;

class FileManagerClient
{
    private Client $client;
    private RootsManager $rootsManager;
    private SecureRootsValidator $validator;

    public function __construct()
    {
        $this->client = new Client(
            new Implementation('file-manager-client', '1.0.0'),
            [
                'capabilities' => [
                    'roots' => [
                        'listChanged' => true
                    ]
                ]
            ]
        );

        $this->rootsManager = new RootsManager($this->client);

        // Set up security validator
        $this->validator = new SecureRootsValidator(
            ['/home/user/projects', '/home/user/documents'], // Allowed base paths
            ['/home/user/.ssh', '/etc', '/var'] // Denied paths
        );

        $this->setupDefaultRoots();
    }

    private function setupDefaultRoots(): void
    {
        // Auto-detect project directories
        $projectManager = new ProjectRootsManager($this->rootsManager);
        $detectedProjects = $projectManager->detectProjectRoots();

        foreach ($detectedProjects as $project) {
            try {
                $uri = 'file://' . realpath($project['path']);

                if ($this->validator->validateRoot($uri)) {
                    $this->rootsManager->addRoot($uri, $project['name']);
                    echo "✅ Added detected project: {$project['name']}\n";
                }
            } catch (\Exception $e) {
                echo "⚠️ Skipped project {$project['name']}: {$e->getMessage()}\n";
            }
        }
    }

    public function connectToFileServer(string $serverPath): void
    {
        async(function () use ($serverPath) {
            try {
                echo "🔌 Connecting to file server...\n";

                $transport = new StdioClientTransport([
                    'command' => 'php',
                    'args' => [$serverPath]
                ]);

                $this->client->connect($transport)->await();

                echo "✅ Connected to file server\n";

                // Demonstrate roots functionality
                $this->demonstrateRootsFeatures();

            } catch (\Exception $e) {
                echo "❌ Connection failed: {$e->getMessage()}\n";
            }
        })->await();
    }

    private function demonstrateRootsFeatures(): void
    {
        async(function () {
            try {
                // List available roots
                echo "\n📁 Available Roots:\n";
                $roots = $this->rootsManager->listRoots();

                foreach ($roots['roots'] as $root) {
                    echo "  - {$root['name']}: {$root['uri']}\n";
                }

                // Call server tool that uses roots
                if (!empty($roots['roots'])) {
                    $firstRoot = $roots['roots'][0];

                    echo "\n🔍 Listing files in root: {$firstRoot['name']}\n";

                    $result = $this->client->callTool('list_files_in_root', [
                        'root_uri' => $firstRoot['uri'],
                        'recursive' => false
                    ])->await();

                    $fileData = json_decode($result['content'][0]['text'], true);
                    echo "Found {$fileData['file_count']} items\n";

                    foreach (array_slice($fileData['files'], 0, 5) as $file) {
                        echo "  - {$file['name']} ({$file['type']})\n";
                    }
                }

            } catch (\Exception $e) {
                echo "❌ Roots demonstration failed: {$e->getMessage()}\n";
            }
        })->await();
    }

    public function addCustomRoot(string $path, string $name): void
    {
        try {
            $uri = 'file://' . realpath($path);

            if (!$this->validator->validateRoot($uri)) {
                throw new \InvalidArgumentException("Root validation failed for: {$path}");
            }

            $this->rootsManager->addRoot($uri, $name);
            echo "✅ Added custom root: {$name} -> {$path}\n";

        } catch (\Exception $e) {
            echo "❌ Failed to add root: {$e->getMessage()}\n";
        }
    }
}

// Usage example
$client = new FileManagerClient();

// Add custom roots
$client->addCustomRoot('/home/user/my-special-project', 'Special Project');
$client->addCustomRoot('/home/user/shared-docs', 'Shared Documents');

// Connect to a file server that can use these roots
$client->connectToFileServer('./file-server.php');
```

## User Interface Integration

### Web-Based Roots Manager

```php
class WebRootsInterface
{
    private RootsManager $rootsManager;

    public function handleRootsRequest(Request $request): JsonResponse
    {
        return match($request->getMethod()) {
            'GET' => $this->listRoots(),
            'POST' => $this->addRoot($request),
            'DELETE' => $this->removeRoot($request),
            default => response()->json(['error' => 'Method not allowed'], 405)
        };
    }

    private function listRoots(): JsonResponse
    {
        $roots = $this->rootsManager->listRoots();

        return response()->json([
            'roots' => $roots['roots'],
            'count' => count($roots['roots'])
        ]);
    }

    private function addRoot(Request $request): JsonResponse
    {
        $request->validate([
            'path' => 'required|string',
            'name' => 'required|string|max:255'
        ]);

        try {
            $path = $request->input('path');
            $name = $request->input('name');

            // Security validation
            if (!$this->isPathSafe($path)) {
                return response()->json([
                    'error' => 'Path not allowed for security reasons'
                ], 403);
            }

            $uri = 'file://' . realpath($path);
            $this->rootsManager->addRoot($uri, $name);

            return response()->json([
                'success' => true,
                'message' => "Root '{$name}' added successfully",
                'root' => ['uri' => $uri, 'name' => $name]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }
}
```

## Best Practices

### 1. Security

- **Validate all paths** before exposing as roots
- **Implement access controls** based on user permissions
- **Monitor root access** and log suspicious activity
- **Use allowlists** rather than denylists for path validation

### 2. User Experience

- **Auto-detect projects** and suggest them as roots
- **Provide clear descriptions** of what each root contains
- **Allow easy addition/removal** of roots through UI
- **Show which servers** are using which roots

### 3. Performance

- **Cache root listings** to avoid repeated filesystem operations
- **Use efficient file watchers** for change detection
- **Limit recursive operations** to prevent performance issues
- **Implement pagination** for large directory listings

### 4. Error Handling

- **Handle missing directories** gracefully
- **Validate permissions** before operations
- **Provide helpful error messages** for path issues
- **Implement fallback mechanisms** for inaccessible roots

## Testing

### Roots Testing

```php
class RootsTest extends TestCase
{
    private RootsManager $rootsManager;
    private string $testDir;

    protected function setUp(): void
    {
        $this->testDir = sys_get_temp_dir() . '/mcp_roots_test_' . uniqid();
        mkdir($this->testDir, 0755, true);

        $this->rootsManager = new RootsManager($this->createMockClient());
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->testDir);
    }

    public function testAddRoot(): void
    {
        $uri = 'file://' . $this->testDir;
        $this->rootsManager->addRoot($uri, 'Test Root');

        $roots = $this->rootsManager->listRoots();

        $this->assertCount(1, $roots['roots']);
        $this->assertEquals($uri, $roots['roots'][0]['uri']);
        $this->assertEquals('Test Root', $roots['roots'][0]['name']);
    }

    public function testInvalidPath(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->rootsManager->addRoot('file:///nonexistent/path', 'Invalid Root');
    }
}
```

## See Also

- [MCP Roots Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/roots)
- [File Reader Example](../examples/file-reader)
- [Security Guide](security)
- [Client API Reference](../api/client)
