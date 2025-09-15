# Roots Management Example

Complete example demonstrating filesystem roots management in MCP clients, including auto-detection, security validation, and dynamic updates.

## Overview

This example shows how to implement a full-featured roots management system that:

- Auto-detects project directories
- Validates paths for security
- Manages dynamic root updates
- Integrates with file servers

## Complete Implementation

```php
#!/usr/bin/env php
<?php

/**
 * Roots Management Example
 *
 * Demonstrates complete filesystem roots management including:
 * - Project auto-detection
 * - Security validation
 * - Dynamic root updates
 * - Integration with file servers
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Client\Client;
use MCP\Client\Transport\StdioClientTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use function Amp\async;

class ProjectRootsClient
{
    private Client $client;
    private array $roots = [];
    private array $watchers = [];
    private array $allowedBasePaths;

    public function __construct()
    {
        $this->client = new Client(
            new Implementation('project-roots-client', '1.0.0'),
            [
                'capabilities' => [
                    'roots' => [
                        'listChanged' => true
                    ]
                ]
            ]
        );

        // Define allowed base paths for security
        $this->allowedBasePaths = [
            $_SERVER['HOME'] . '/projects',
            $_SERVER['HOME'] . '/workspace',
            $_SERVER['HOME'] . '/code',
            $_SERVER['HOME'] . '/documents'
        ];

        $this->setupRootsHandler();
        $this->autoDetectProjects();
    }

    private function setupRootsHandler(): void
    {
        $this->client->setRootsHandler([$this, 'handleRootsRequest']);
    }

    public function handleRootsRequest(): array
    {
        return [
            'roots' => array_values($this->roots)
        ];
    }

    public function autoDetectProjects(): void
    {
        echo "🔍 Auto-detecting project directories...\n";

        foreach ($this->allowedBasePaths as $basePath) {
            if (!is_dir($basePath)) {
                continue;
            }

            $this->scanForProjects($basePath);
        }

        echo "✅ Found " . count($this->roots) . " project roots\n\n";
    }

    private function scanForProjects(string $basePath): void
    {
        try {
            foreach (new \DirectoryIterator($basePath) as $dir) {
                if ($dir->isDot() || !$dir->isDir()) {
                    continue;
                }

                $projectPath = $dir->getPathname();

                if ($this->isProjectDirectory($projectPath)) {
                    $this->addRoot($projectPath, $dir->getFilename());
                }
            }
        } catch (\Exception $e) {
            echo "⚠️ Could not scan {$basePath}: {$e->getMessage()}\n";
        }
    }

    private function isProjectDirectory(string $path): bool
    {
        $projectIndicators = [
            'composer.json',     // PHP project
            'package.json',      // Node.js project
            'requirements.txt',  // Python project
            'go.mod',           // Go project
            'Cargo.toml',       // Rust project
            'pom.xml',          // Java Maven project
            'build.gradle',     // Java Gradle project
            '.git',             // Git repository
            'Makefile',         // Make-based project
            'Dockerfile',       // Docker project
            'pyproject.toml',   // Modern Python project
            'yarn.lock',        // Yarn project
            'Pipfile'           // Python Pipenv project
        ];

        foreach ($projectIndicators as $indicator) {
            if (file_exists($path . DIRECTORY_SEPARATOR . $indicator)) {
                return true;
            }
        }

        return false;
    }

    public function addRoot(string $path, string $name): void
    {
        // Validate path security
        if (!$this->isPathAllowed($path)) {
            throw new \InvalidArgumentException("Path not allowed: {$path}");
        }

        $realPath = realpath($path);
        if (!$realPath || !is_readable($realPath)) {
            throw new \InvalidArgumentException("Path not accessible: {$path}");
        }

        $uri = 'file://' . $realPath;
        $rootId = md5($uri);

        $this->roots[$rootId] = [
            'uri' => $uri,
            'name' => $name,
            'path' => $realPath,
            'type' => $this->detectProjectType($realPath),
            'added_at' => time()
        ];

        // Set up file system watcher
        $this->setupWatcher($rootId, $realPath);

        echo "📁 Added root: {$name} -> {$realPath}\n";

        // Notify connected servers
        $this->notifyRootsChanged();
    }

    public function removeRoot(string $rootId): void
    {
        if (isset($this->roots[$rootId])) {
            $root = $this->roots[$rootId];
            unset($this->roots[$rootId]);

            // Stop watcher
            if (isset($this->watchers[$rootId])) {
                $this->watchers[$rootId]->stop();
                unset($this->watchers[$rootId]);
            }

            echo "🗑️ Removed root: {$root['name']}\n";

            $this->notifyRootsChanged();
        }
    }

    private function isPathAllowed(string $path): bool
    {
        $realPath = realpath($path);

        if (!$realPath) {
            return false;
        }

        foreach ($this->allowedBasePaths as $allowedPath) {
            $allowedRealPath = realpath($allowedPath);
            if ($allowedRealPath && strpos($realPath, $allowedRealPath) === 0) {
                return true;
            }
        }

        return false;
    }

    private function detectProjectType(string $path): string
    {
        if (file_exists($path . '/composer.json')) return 'php';
        if (file_exists($path . '/package.json')) return 'nodejs';
        if (file_exists($path . '/requirements.txt') || file_exists($path . '/pyproject.toml')) return 'python';
        if (file_exists($path . '/go.mod')) return 'go';
        if (file_exists($path . '/Cargo.toml')) return 'rust';
        if (file_exists($path . '/pom.xml') || file_exists($path . '/build.gradle')) return 'java';
        if (file_exists($path . '/.git')) return 'git';

        return 'unknown';
    }

    private function setupWatcher(string $rootId, string $path): void
    {
        // Simple file modification watcher
        $watcher = new FileWatcher($path);

        $watcher->onChanged(function() use ($rootId) {
            echo "📂 Root changed: {$this->roots[$rootId]['name']}\n";
            $this->notifyRootsChanged();
        });

        $this->watchers[$rootId] = $watcher;
    }

    private function notifyRootsChanged(): void
    {
        // Send notification to connected servers
        $this->client->sendNotification('notifications/roots/list_changed');
    }

    public function connectToFileServer(string $serverPath): void
    {
        async(function () use ($serverPath) {
            try {
                echo "🔌 Connecting to file server: {$serverPath}\n";

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
                echo "\n📋 Demonstrating roots features...\n";

                // Show available roots
                echo "\n📁 Available Roots:\n";
                foreach ($this->roots as $root) {
                    echo "  - {$root['name']} ({$root['type']}): {$root['uri']}\n";
                }

                // Test server's use of roots
                if (!empty($this->roots)) {
                    $firstRoot = array_values($this->roots)[0];

                    echo "\n🔍 Testing file operations in root: {$firstRoot['name']}\n";

                    // Call server tool that lists files in root
                    $result = $this->client->callTool('list_files_in_root', [
                        'root_uri' => $firstRoot['uri'],
                        'recursive' => false
                    ])->await();

                    $fileData = json_decode($result['content'][0]['text'], true);
                    echo "Found {$fileData['file_count']} items in root\n";

                    // Show first few files
                    foreach (array_slice($fileData['files'] ?? [], 0, 5) as $file) {
                        echo "  - {$file['name']} ({$file['type']})\n";
                    }

                    // Test reading a specific file
                    $files = $fileData['files'] ?? [];
                    $textFiles = array_filter($files, fn($f) =>
                        $f['type'] === 'file' &&
                        in_array(pathinfo($f['name'], PATHINFO_EXTENSION), ['txt', 'md', 'json'])
                    );

                    if (!empty($textFiles)) {
                        $testFile = array_values($textFiles)[0];
                        echo "\n📖 Reading file: {$testFile['name']}\n";

                        $fileResult = $this->client->callTool('read_file_from_root', [
                            'root_uri' => $firstRoot['uri'],
                            'file_path' => $testFile['name']
                        ])->await();

                        $content = $fileResult['content'][0]['text'];
                        $preview = substr($content, 0, 100);
                        echo "Content preview: {$preview}" . (strlen($content) > 100 ? '...' : '') . "\n";
                    }
                }

            } catch (\Exception $e) {
                echo "❌ Demonstration failed: {$e->getMessage()}\n";
            }
        })->await();
    }

    public function addCustomRoot(): void
    {
        echo "\n➕ Add Custom Root\n";
        echo "================\n";

        $path = $this->promptForPath();
        $name = $this->promptForName();

        try {
            $this->addRoot($path, $name);
            echo "✅ Custom root added successfully\n";
        } catch (\Exception $e) {
            echo "❌ Failed to add root: {$e->getMessage()}\n";
        }
    }

    private function promptForPath(): string
    {
        while (true) {
            echo "Enter path to directory: ";
            $path = trim(fgets(STDIN));

            if (empty($path)) {
                echo "Path cannot be empty. Please try again.\n";
                continue;
            }

            if (!is_dir($path)) {
                echo "Directory does not exist. Please try again.\n";
                continue;
            }

            return $path;
        }
    }

    private function promptForName(): string
    {
        echo "Enter display name (optional): ";
        $name = trim(fgets(STDIN));

        return $name ?: basename($this->promptForPath());
    }

    public function showRootsMenu(): void
    {
        while (true) {
            echo "\n🗂️  Roots Management Menu\n";
            echo "========================\n";
            echo "1. List current roots\n";
            echo "2. Add custom root\n";
            echo "3. Remove root\n";
            echo "4. Connect to file server\n";
            echo "5. Auto-detect projects\n";
            echo "6. Exit\n";
            echo "\nChoice: ";

            $choice = trim(fgets(STDIN));

            match($choice) {
                '1' => $this->listCurrentRoots(),
                '2' => $this->addCustomRoot(),
                '3' => $this->removeRootInteractive(),
                '4' => $this->connectToFileServerInteractive(),
                '5' => $this->autoDetectProjects(),
                '6' => break,
                default => echo "Invalid choice. Please try again.\n"
            };
        }
    }

    private function listCurrentRoots(): void
    {
        echo "\n📁 Current Roots:\n";

        if (empty($this->roots)) {
            echo "No roots configured.\n";
            return;
        }

        foreach ($this->roots as $rootId => $root) {
            echo "  ID: {$rootId}\n";
            echo "  Name: {$root['name']}\n";
            echo "  Path: {$root['path']}\n";
            echo "  Type: {$root['type']}\n";
            echo "  Added: " . date('Y-m-d H:i:s', $root['added_at']) . "\n";
            echo "  ---\n";
        }
    }

    private function removeRootInteractive(): void
    {
        if (empty($this->roots)) {
            echo "No roots to remove.\n";
            return;
        }

        echo "\n🗑️ Remove Root\n";
        echo "=============\n";

        $this->listCurrentRoots();

        echo "Enter root ID to remove: ";
        $rootId = trim(fgets(STDIN));

        if (isset($this->roots[$rootId])) {
            $this->removeRoot($rootId);
        } else {
            echo "Root ID not found.\n";
        }
    }

    private function connectToFileServerInteractive(): void
    {
        echo "\n🔌 Connect to File Server\n";
        echo "========================\n";
        echo "Enter path to file server script: ";

        $serverPath = trim(fgets(STDIN));

        if (file_exists($serverPath)) {
            $this->connectToFileServer($serverPath);
        } else {
            echo "Server script not found: {$serverPath}\n";
        }
    }
}

// File watcher implementation
class FileWatcher
{
    private string $path;
    private array $callbacks = [];
    private int $lastModified;
    private bool $running = false;

    public function __construct(string $path)
    {
        $this->path = $path;
        $this->lastModified = $this->getLastModified();
    }

    public function onChanged(callable $callback): void
    {
        $this->callbacks[] = $callback;

        if (!$this->running) {
            $this->start();
        }
    }

    public function start(): void
    {
        $this->running = true;

        async(function () {
            while ($this->running) {
                $currentModified = $this->getLastModified();

                if ($currentModified > $this->lastModified) {
                    $this->lastModified = $currentModified;

                    foreach ($this->callbacks as $callback) {
                        try {
                            $callback();
                        } catch (\Exception $e) {
                            error_log("File watcher callback error: {$e->getMessage()}");
                        }
                    }
                }

                delay(2000)->await(); // Check every 2 seconds
            }
        });
    }

    public function stop(): void
    {
        $this->running = false;
    }

    private function getLastModified(): int
    {
        if (!file_exists($this->path)) {
            return 0;
        }

        $modified = filemtime($this->path);

        // For directories, check all files
        if (is_dir($this->path)) {
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->path)) as $file) {
                $fileModified = $file->getMTime();
                if ($fileModified > $modified) {
                    $modified = $fileModified;
                }
            }
        }

        return $modified;
    }
}

// Usage example
echo "🚀 Project Roots Client Starting...\n";
echo "===================================\n";

$client = new ProjectRootsClient();

// Show interactive menu
$client->showRootsMenu();

echo "👋 Goodbye!\n";
```

## Key Features Demonstrated

### 1. Auto-Detection

- **Project Indicators**: Detects various project types (PHP, Node.js, Python, etc.)
- **Multiple Base Paths**: Scans common development directories
- **Type Recognition**: Identifies project types based on files present

### 2. Security Validation

- **Path Restrictions**: Only allows roots within predefined base paths
- **Path Traversal Prevention**: Uses `realpath()` to resolve paths safely
- **Permission Checks**: Validates read access before adding roots

### 3. Dynamic Updates

- **File System Watching**: Monitors roots for changes
- **Real-time Notifications**: Notifies servers when roots change
- **Interactive Management**: Add/remove roots during runtime

### 4. User Interface

- **Command-Line Menu**: Interactive menu for root management
- **Clear Feedback**: Shows status of all operations
- **Error Handling**: Graceful handling of invalid inputs

## Integration with File Servers

This client works with file servers that support roots. Here's a compatible server example:

```php
// Compatible file server that uses roots
$server->tool(
    'list_files_in_root',
    'List files in a specific root directory',
    [
        'type' => 'object',
        'properties' => [
            'root_uri' => ['type' => 'string'],
            'recursive' => ['type' => 'boolean', 'default' => false]
        ],
        'required' => ['root_uri']
    ],
    function (array $params): array {
        // Get available roots from client
        $rootsResponse = $this->requestRootsFromClient();
        $availableRoots = $rootsResponse['roots'] ?? [];

        // Validate requested root is available
        $requestedUri = $params['root_uri'];
        $rootExists = false;

        foreach ($availableRoots as $root) {
            if ($root['uri'] === $requestedUri) {
                $rootExists = true;
                break;
            }
        }

        if (!$rootExists) {
            throw new McpError(
                ErrorCode::InvalidParams,
                "Root not available: {$requestedUri}"
            );
        }

        // List files in the root
        $path = substr($requestedUri, 7); // Remove 'file://' prefix
        $files = $this->listFilesInPath($path, $params['recursive'] ?? false);

        return [
            'content' => [[
                'type' => 'text',
                'text' => json_encode([
                    'root_uri' => $requestedUri,
                    'file_count' => count($files),
                    'files' => $files
                ], JSON_PRETTY_PRINT)
            ]]
        ];
    }
);
```

## Testing

### Roots Testing

```php
use PHPUnit\Framework\TestCase;

class RootsTest extends TestCase
{
    private ProjectRootsClient $client;
    private string $testDir;

    protected function setUp(): void
    {
        // Create test directory structure
        $this->testDir = sys_get_temp_dir() . '/mcp_roots_test_' . uniqid();
        mkdir($this->testDir, 0755, true);

        // Create test project
        $projectDir = $this->testDir . '/test-project';
        mkdir($projectDir, 0755, true);
        file_put_contents($projectDir . '/composer.json', '{"name": "test/project"}');

        $this->client = new ProjectRootsClient();
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->testDir);
    }

    public function testAutoDetection(): void
    {
        // This would require modifying the client to use test directories
        $this->markTestSkipped('Requires test directory setup');
    }

    public function testAddRoot(): void
    {
        $projectPath = $this->testDir . '/test-project';

        $this->client->addRoot($projectPath, 'Test Project');

        $roots = $this->client->handleRootsRequest();

        $this->assertCount(1, $roots['roots']);
        $this->assertStringContains($projectPath, $roots['roots'][0]['uri']);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        ) as $file) {
            if ($file->isDir()) {
                rmdir($file->getPathname());
            } else {
                unlink($file->getPathname());
            }
        }

        rmdir($dir);
    }
}
```

## See Also

- [MCP Roots Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/roots)
- [File Reader Example](../file-reader)
- [Security Guide](../../guide/security)
- [Roots Management Guide](../../guide/roots)
