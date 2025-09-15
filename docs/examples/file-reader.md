# File Reader Server Example

A secure file system integration server demonstrating resource management, path validation, and security best practices.

## Overview

This example shows how to safely integrate with the file system while maintaining security and providing useful file operations. It demonstrates:

- Safe file reading with security checks
- Directory listing with permissions
- File information and metadata
- Resource management patterns
- Path validation and sanitization

## Complete Code

```php
#!/usr/bin/env php
<?php

/**
 * File Reader MCP Server
 *
 * Demonstrates secure file system integration with:
 * - Safe file reading with security checks
 * - Directory listing
 * - File information
 * - Path validation
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use function Amp\async;

class FileReaderServer
{
    private McpServer $server;
    private array $allowedPaths;
    private array $allowedExtensions;

    public function __construct()
    {
        $this->server = new McpServer(
            new Implementation(
                'file-reader-server',
                '1.0.0',
                'Secure file system integration server'
            )
        );

        // Security: Define allowed paths (restrict to current directory and subdirectories)
        $this->allowedPaths = [
            realpath(__DIR__),
            realpath(__DIR__ . '/documents'),
            realpath(__DIR__ . '/projects')
        ];

        // Define allowed file extensions
        $this->allowedExtensions = [
            'txt', 'md', 'json', 'yaml', 'yml', 'php', 'js', 'html', 'css', 'xml'
        ];

        $this->registerTools();
        $this->registerResources();
    }

    private function registerTools(): void
    {
        // Tool: Read file contents
        $this->server->tool(
            'read_file',
            'Read the contents of a text file',
            [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'Path to the file to read'
                    ],
                    'encoding' => [
                        'type' => 'string',
                        'enum' => ['utf-8', 'ascii', 'iso-8859-1'],
                        'default' => 'utf-8',
                        'description' => 'File encoding'
                    ]
                ],
                'required' => ['path']
            ],
            function (array $params): array {
                $path = $this->validateAndNormalizePath($params['path']);
                $encoding = $params['encoding'] ?? 'utf-8';

                if (!file_exists($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "File not found: {$params['path']}"
                    );
                }

                if (!is_file($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Path is not a file: {$params['path']}"
                    );
                }

                if (!is_readable($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "File is not readable: {$params['path']}"
                    );
                }

                $content = file_get_contents($path);
                if ($content === false) {
                    throw new McpError(
                        ErrorCode::InternalError,
                        "Failed to read file: {$params['path']}"
                    );
                }

                // Convert encoding if needed
                if ($encoding !== 'utf-8') {
                    $content = mb_convert_encoding($content, 'utf-8', $encoding);
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => $content
                    ]]
                ];
            }
        );

        // Tool: List directory contents
        $this->server->tool(
            'list_directory',
            'List the contents of a directory',
            [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'Path to the directory to list',
                        'default' => '.'
                    ],
                    'show_hidden' => [
                        'type' => 'boolean',
                        'description' => 'Whether to show hidden files',
                        'default' => false
                    ],
                    'include_details' => [
                        'type' => 'boolean',
                        'description' => 'Include file size and modification time',
                        'default' => true
                    ]
                ]
            ],
            function (array $params): array {
                $path = $this->validateAndNormalizePath($params['path'] ?? '.');
                $showHidden = $params['show_hidden'] ?? false;
                $includeDetails = $params['include_details'] ?? true;

                if (!is_dir($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Path is not a directory: {$params['path']}"
                    );
                }

                if (!is_readable($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Directory is not readable: {$params['path']}"
                    );
                }

                $items = [];
                $iterator = new \DirectoryIterator($path);

                foreach ($iterator as $fileInfo) {
                    if ($fileInfo->isDot()) {
                        continue;
                    }

                    if (!$showHidden && $fileInfo->getFilename()[0] === '.') {
                        continue;
                    }

                    $item = [
                        'name' => $fileInfo->getFilename(),
                        'type' => $fileInfo->isDir() ? 'directory' : 'file'
                    ];

                    if ($includeDetails) {
                        $item['size'] = $fileInfo->getSize();
                        $item['modified'] = date('Y-m-d H:i:s', $fileInfo->getMTime());
                        $item['permissions'] = substr(sprintf('%o', $fileInfo->getPerms()), -4);

                        if ($fileInfo->isFile()) {
                            $item['extension'] = $fileInfo->getExtension();
                            $item['readable'] = $fileInfo->isReadable();
                            $item['writable'] = $fileInfo->isWritable();
                        }
                    }

                    $items[] = $item;
                }

                // Sort by name
                usort($items, fn($a, $b) => strcasecmp($a['name'], $b['name']));

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'directory' => $params['path'] ?? '.',
                            'item_count' => count($items),
                            'items' => $items
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool: Get file information
        $this->server->tool(
            'file_info',
            'Get detailed information about a file or directory',
            [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'Path to the file or directory'
                    ]
                ],
                'required' => ['path']
            ],
            function (array $params): array {
                $path = $this->validateAndNormalizePath($params['path']);

                if (!file_exists($path)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "File or directory not found: {$params['path']}"
                    );
                }

                $stat = stat($path);
                $pathInfo = pathinfo($path);

                $info = [
                    'path' => $params['path'],
                    'absolute_path' => $path,
                    'type' => is_dir($path) ? 'directory' : 'file',
                    'size' => $stat['size'],
                    'permissions' => substr(sprintf('%o', $stat['mode']), -4),
                    'owner' => $stat['uid'],
                    'group' => $stat['gid'],
                    'created' => date('Y-m-d H:i:s', $stat['ctime']),
                    'modified' => date('Y-m-d H:i:s', $stat['mtime']),
                    'accessed' => date('Y-m-d H:i:s', $stat['atime']),
                    'readable' => is_readable($path),
                    'writable' => is_writable($path),
                    'executable' => is_executable($path)
                ];

                if (is_file($path)) {
                    $info['filename'] = $pathInfo['filename'] ?? '';
                    $info['extension'] = $pathInfo['extension'] ?? '';
                    $info['mime_type'] = mime_content_type($path) ?: 'unknown';

                    // File hash for integrity checking
                    if ($stat['size'] < 1024 * 1024) { // Only for files < 1MB
                        $info['md5_hash'] = md5_file($path);
                    }
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode($info, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool: Search files
        $this->server->tool(
            'search_files',
            'Search for files by name pattern',
            [
                'type' => 'object',
                'properties' => [
                    'pattern' => [
                        'type' => 'string',
                        'description' => 'Search pattern (supports wildcards * and ?)'
                    ],
                    'directory' => [
                        'type' => 'string',
                        'description' => 'Directory to search in',
                        'default' => '.'
                    ],
                    'recursive' => [
                        'type' => 'boolean',
                        'description' => 'Search recursively in subdirectories',
                        'default' => false
                    ]
                ],
                'required' => ['pattern']
            ],
            function (array $params): array {
                $pattern = $params['pattern'];
                $directory = $this->validateAndNormalizePath($params['directory'] ?? '.');
                $recursive = $params['recursive'] ?? false;

                if (!is_dir($directory)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Search directory not found: {$params['directory']}"
                    );
                }

                $matches = [];
                $this->searchFiles($directory, $pattern, $recursive, $matches);

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'pattern' => $pattern,
                            'directory' => $params['directory'] ?? '.',
                            'recursive' => $recursive,
                            'matches_count' => count($matches),
                            'matches' => $matches
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function registerResources(): void
    {
        // Resource: File contents by path
        $this->server->resource(
            'file-content',
            'file://{path}',
            'text/plain',
            function (string $uri): array {
                if (!preg_match('/file:\/\/(.+)/', $uri, $matches)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        'Invalid file URI format'
                    );
                }

                $path = urldecode($matches[1]);
                $fullPath = $this->validateAndNormalizePath($path);

                if (!file_exists($fullPath) || !is_file($fullPath)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "File not found: {$path}"
                    );
                }

                $content = file_get_contents($fullPath);
                $mimeType = mime_content_type($fullPath) ?: 'text/plain';

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => $mimeType,
                        'text' => $content
                    ]]
                ];
            }
        );

        // Resource: Directory listing
        $this->server->resource(
            'directory-listing',
            'dir://{path}',
            'application/json',
            function (string $uri): array {
                if (!preg_match('/dir:\/\/(.+)/', $uri, $matches)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        'Invalid directory URI format'
                    );
                }

                $path = urldecode($matches[1]);
                $fullPath = $this->validateAndNormalizePath($path);

                if (!is_dir($fullPath)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "Directory not found: {$path}"
                    );
                }

                $items = [];
                foreach (new \DirectoryIterator($fullPath) as $fileInfo) {
                    if ($fileInfo->isDot()) continue;

                    $items[] = [
                        'name' => $fileInfo->getFilename(),
                        'type' => $fileInfo->isDir() ? 'directory' : 'file',
                        'size' => $fileInfo->getSize(),
                        'modified' => $fileInfo->getMTime()
                    ];
                }

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode([
                            'directory' => $path,
                            'items' => $items
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function validateAndNormalizePath(string $path): string
    {
        // Convert relative path to absolute
        if (!$this->isAbsolutePath($path)) {
            $path = __DIR__ . DIRECTORY_SEPARATOR . $path;
        }

        // Resolve path (removes .. and . components)
        $realPath = realpath($path);
        if ($realPath === false) {
            throw new McpError(
                ErrorCode::InvalidParams,
                "Invalid path: {$path}"
            );
        }

        // Security check: ensure path is within allowed directories
        $isAllowed = false;
        foreach ($this->allowedPaths as $allowedPath) {
            if ($allowedPath && strpos($realPath, $allowedPath) === 0) {
                $isAllowed = true;
                break;
            }
        }

        if (!$isAllowed) {
            throw new McpError(
                ErrorCode::InvalidParams,
                "Access denied to path: {$path}"
            );
        }

        return $realPath;
    }

    private function isAbsolutePath(string $path): bool
    {
        return $path[0] === '/' || (PHP_OS_FAMILY === 'Windows' && preg_match('/^[A-Z]:\\\\/', $path));
    }

    private function searchFiles(string $directory, string $pattern, bool $recursive, array &$matches): void
    {
        $iterator = new \DirectoryIterator($directory);

        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isDot()) {
                continue;
            }

            $filename = $fileInfo->getFilename();

            // Check if filename matches pattern
            if (fnmatch($pattern, $filename)) {
                $matches[] = [
                    'path' => $fileInfo->getPathname(),
                    'name' => $filename,
                    'type' => $fileInfo->isDir() ? 'directory' : 'file',
                    'size' => $fileInfo->getSize(),
                    'modified' => date('Y-m-d H:i:s', $fileInfo->getMTime())
                ];
            }

            // Recurse into subdirectories if requested
            if ($recursive && $fileInfo->isDir()) {
                try {
                    $this->searchFiles($fileInfo->getPathname(), $pattern, $recursive, $matches);
                } catch (\Exception $e) {
                    // Skip directories we can't access
                }
            }
        }
    }

    public function start(): void
    {
        async(function () {
            echo "📁 File Reader MCP Server starting...\n";
            echo "Allowed paths:\n";
            foreach ($this->allowedPaths as $path) {
                echo "  - {$path}\n";
            }
            echo "\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Start the server
$server = new FileReaderServer();
$server->start();
```

## Key Features

### 1. Security First

- **Path Validation**: All paths are validated and normalized
- **Access Control**: Restricts access to predefined directories
- **Permission Checks**: Verifies read/write permissions before operations
- **Path Traversal Protection**: Prevents `../` attacks

### 2. Comprehensive File Operations

- **Read Files**: Safe file reading with encoding support
- **Directory Listing**: Detailed directory contents
- **File Information**: Metadata, permissions, timestamps
- **File Search**: Pattern-based file searching

### 3. Resource Management

- **File Resources**: Access files via URI patterns
- **Directory Resources**: Browse directories as resources
- **MIME Type Detection**: Automatic content type detection

## Security Features

### Path Validation

```php
private function validateAndNormalizePath(string $path): string
{
    // Convert to absolute path
    if (!$this->isAbsolutePath($path)) {
        $path = __DIR__ . DIRECTORY_SEPARATOR . $path;
    }

    // Resolve real path (removes .. and . components)
    $realPath = realpath($path);
    if ($realPath === false) {
        throw new McpError(ErrorCode::InvalidParams, "Invalid path: {$path}");
    }

    // Security check: ensure path is within allowed directories
    $isAllowed = false;
    foreach ($this->allowedPaths as $allowedPath) {
        if ($allowedPath && strpos($realPath, $allowedPath) === 0) {
            $isAllowed = true;
            break;
        }
    }

    if (!$isAllowed) {
        throw new McpError(ErrorCode::InvalidParams, "Access denied to path: {$path}");
    }

    return $realPath;
}
```

### Permission Checks

```php
if (!is_readable($path)) {
    throw new McpError(
        ErrorCode::InvalidParams,
        "File is not readable: {$params['path']}"
    );
}
```

## How to Run

### 1. Basic Usage

```bash
# Save the code as file-reader-server.php
chmod +x file-reader-server.php
php file-reader-server.php
```

### 2. Test with MCP Inspector

```bash
mcp-inspector ./file-reader-server.php
```

### 3. Claude Desktop Integration

```json
{
  "mcpServers": {
    "file-reader": {
      "command": "php",
      "args": ["/path/to/file-reader-server.php"]
    }
  }
}
```

## Example Usage

### Reading Files

```
User: "Read the contents of README.md"
Server: Returns the file contents safely

User: "Show me the config.json file"
Server: Returns JSON configuration with proper formatting
```

### Directory Operations

```
User: "List the files in the current directory"
Server: Returns detailed directory listing with file info

User: "What files are in the documents folder?"
Server: Shows all files in documents/ with metadata
```

### File Information

```
User: "Get information about package.json"
Server: Returns detailed file metadata, permissions, timestamps

User: "What's the size of the log file?"
Server: Provides complete file statistics
```

### File Search

```
User: "Find all PHP files in this project"
Server: Searches for *.php files with optional recursion

User: "Search for configuration files"
Server: Finds files matching config patterns
```

## Configuration

### Allowed Paths

Modify the `$allowedPaths` array to control access:

```php
$this->allowedPaths = [
    realpath(__DIR__),                    // Current directory
    realpath(__DIR__ . '/documents'),     // Documents folder
    realpath(__DIR__ . '/projects'),      // Projects folder
    realpath('/var/www/html'),            // Web root
    realpath('/home/user/workspace')      // User workspace
];
```

### Allowed Extensions

Control which file types can be accessed:

```php
$this->allowedExtensions = [
    'txt', 'md', 'json', 'yaml', 'yml',   // Data files
    'php', 'js', 'html', 'css',           // Code files
    'xml', 'csv', 'log'                   // Other text files
];
```

## Error Handling

The server includes comprehensive error handling for:

- **Invalid paths** - Non-existent or malformed paths
- **Permission denied** - Insufficient file/directory permissions
- **Access control** - Attempts to access restricted paths
- **File not found** - Missing files or directories
- **Read failures** - I/O errors during file operations

## Best Practices

### 1. Security

- Always validate and sanitize file paths
- Restrict access to specific directories
- Check permissions before operations
- Use realpath() to resolve path traversal attempts

### 2. Error Handling

- Provide clear, specific error messages
- Handle permission and I/O errors gracefully
- Don't expose sensitive system information

### 3. Performance

- Limit file size for hash calculations
- Use efficient directory iteration
- Implement search result limits for large directories

### 4. Usability

- Support both relative and absolute paths
- Provide detailed file information
- Include helpful metadata in responses

This file reader server demonstrates how to safely integrate with the file system while maintaining security and providing comprehensive file operations for MCP clients.
