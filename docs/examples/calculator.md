# Calculator Server Example

A comprehensive calculator server demonstrating multiple tools, error handling, and resource management.

## Overview

This example shows how to build a practical MCP server with multiple related tools that work together. It demonstrates:

- Multiple tools with different input schemas
- Error handling and validation
- Resources and prompts
- Practical tool design patterns

## Complete Code

```php
#!/usr/bin/env php
<?php

/**
 * Basic Calculator MCP Server
 *
 * A simple calculator server that demonstrates:
 * - Multiple tools with different input schemas
 * - Error handling and validation
 * - Returning different types of responses
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use function Amp\async;

// Create calculator server
$server = new McpServer(
    new Implementation(
        'basic-calculator',
        '1.0.0',
        'A simple calculator server with basic math operations'
    )
);

// Add basic math operations
$server->tool(
    'add',
    'Add two numbers together',
    [
        'type' => 'object',
        'properties' => [
            'a' => ['type' => 'number', 'description' => 'First number'],
            'b' => ['type' => 'number', 'description' => 'Second number']
        ],
        'required' => ['a', 'b']
    ],
    function (array $args): array {
        $result = $args['a'] + $args['b'];
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "{$args['a']} + {$args['b']} = {$result}"
                ]
            ]
        ];
    }
);

$server->tool(
    'subtract',
    'Subtract second number from first number',
    [
        'type' => 'object',
        'properties' => [
            'a' => ['type' => 'number', 'description' => 'First number'],
            'b' => ['type' => 'number', 'description' => 'Second number']
        ],
        'required' => ['a', 'b']
    ],
    function (array $args): array {
        $result = $args['a'] - $args['b'];
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "{$args['a']} - {$args['b']} = {$result}"
                ]
            ]
        ];
    }
);

$server->tool(
    'multiply',
    'Multiply two numbers',
    [
        'type' => 'object',
        'properties' => [
            'a' => ['type' => 'number', 'description' => 'First number'],
            'b' => ['type' => 'number', 'description' => 'Second number']
        ],
        'required' => ['a', 'b']
    ],
    function (array $args): array {
        $result = $args['a'] * $args['b'];
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "{$args['a']} × {$args['b']} = {$result}"
                ]
            ]
        ];
    }
);

$server->tool(
    'divide',
    'Divide first number by second number',
    [
        'type' => 'object',
        'properties' => [
            'a' => ['type' => 'number', 'description' => 'Dividend (number to be divided)'],
            'b' => ['type' => 'number', 'description' => 'Divisor (number to divide by)']
        ],
        'required' => ['a', 'b']
    ],
    function (array $args): array {
        if ($args['b'] == 0) {
            throw new McpError(
                code: -32602,
                message: 'Division by zero is not allowed'
            );
        }

        $result = $args['a'] / $args['b'];
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "{$args['a']} ÷ {$args['b']} = {$result}"
                ]
            ]
        ];
    }
);

$server->tool(
    'power',
    'Raise first number to the power of second number',
    [
        'type' => 'object',
        'properties' => [
            'base' => ['type' => 'number', 'description' => 'Base number'],
            'exponent' => ['type' => 'number', 'description' => 'Exponent']
        ],
        'required' => ['base', 'exponent']
    ],
    function (array $args): array {
        $result = pow($args['base'], $args['exponent']);
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "{$args['base']}^{$args['exponent']} = {$result}"
                ]
            ]
        ];
    }
);

$server->tool(
    'sqrt',
    'Calculate square root of a number',
    [
        'type' => 'object',
        'properties' => [
            'number' => ['type' => 'number', 'description' => 'Number to find square root of']
        ],
        'required' => ['number']
    ],
    function (array $args): array {
        if ($args['number'] < 0) {
            throw new McpError(
                code: -32602,
                message: 'Cannot calculate square root of negative number'
            );
        }

        $result = sqrt($args['number']);
        return [
            'content' => [
                [
                    'type' => 'text',
                    'text' => "√{$args['number']} = {$result}"
                ]
            ]
        ];
    }
);

// Add a resource that provides calculation history
$server->resource(
    'calculation-history',
    'calculator://history',
    'text/plain',
    function (): array {
        return [
            'contents' => [[
                'uri' => 'calculator://history',
                'mimeType' => 'text/plain',
                'text' => "Calculator History:\n" .
                    "- This is a demo calculator\n" .
                    "- Available operations: add, subtract, multiply, divide, power, sqrt\n" .
                    "- Use the tools to perform calculations\n" .
                    "- All operations return formatted results\n"
            ]]
        ];
    }
);

// Add a help prompt
$server->prompt(
    'calculator_help',
    'Get help using the calculator',
    [],
    function (): array {
        return [
            'description' => 'Calculator Help and Usage Guide',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => 'How do I use this calculator?'
                        ]
                    ]
                ],
                [
                    'role' => 'assistant',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => "This calculator provides the following operations:\n\n" .
                                "• **add** - Add two numbers: add(a, b)\n" .
                                "• **subtract** - Subtract: subtract(a, b) = a - b\n" .
                                "• **multiply** - Multiply: multiply(a, b) = a × b\n" .
                                "• **divide** - Divide: divide(a, b) = a ÷ b\n" .
                                "• **power** - Exponentiation: power(base, exponent)\n" .
                                "• **sqrt** - Square root: sqrt(number)\n\n" .
                                "All operations include error handling for invalid inputs.\n" .
                                "Try: 'Use the add tool to calculate 5 + 3'"
                        ]
                    ]
                ]
            ]
        ];
    }
);

// Start the server
async(function () use ($server) {
    echo "🧮 Basic Calculator MCP Server starting...\n";
    echo "Available operations: add, subtract, multiply, divide, power, sqrt\n";

    $transport = new StdioServerTransport();
    $server->connect($transport)->await();
})->await();
```

## Key Features

### 1. Multiple Tools

The server provides six mathematical operations:

- **add** - Addition
- **subtract** - Subtraction
- **multiply** - Multiplication
- **divide** - Division (with zero-division protection)
- **power** - Exponentiation
- **sqrt** - Square root (with negative number protection)

### 2. Error Handling

```php
// Division by zero protection
if ($args['b'] == 0) {
    throw new McpError(
        code: -32602,
        message: 'Division by zero is not allowed'
    );
}

// Negative square root protection
if ($args['number'] < 0) {
    throw new McpError(
        code: -32602,
        message: 'Cannot calculate square root of negative number'
    );
}
```

### 3. Resource Management

Provides a calculation history resource that clients can read:

```php
$server->resource(
    'calculation-history',
    'calculator://history',
    'text/plain',
    function (): array {
        return [
            'contents' => [[
                'uri' => 'calculator://history',
                'mimeType' => 'text/plain',
                'text' => "Calculator History:\n..."
            ]]
        ];
    }
);
```

### 4. Interactive Help

Includes a help prompt that guides users on how to use the calculator:

```php
$server->prompt(
    'calculator_help',
    'Get help using the calculator',
    [],
    function (): array {
        return [
            'description' => 'Calculator Help and Usage Guide',
            'messages' => [/* help content */]
        ];
    }
);
```

## How to Run

### 1. Basic Usage

```bash
# Save the code as calculator-server.php
chmod +x calculator-server.php
php calculator-server.php
```

### 2. Test with MCP Inspector

```bash
# Install MCP Inspector (requires Node.js)
npm install -g @modelcontextprotocol/inspector

# Test your server
mcp-inspector ./calculator-server.php
```

### 3. Test with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "php",
      "args": ["/path/to/calculator-server.php"]
    }
  }
}
```

## Example Interactions

### Basic Calculations

```
User: "Add 15 and 27"
Calculator: "15 + 27 = 42"

User: "What's the square root of 144?"
Calculator: "√144 = 12"

User: "Divide 100 by 4"
Calculator: "100 ÷ 4 = 25"
```

### Error Handling

```
User: "Divide 10 by 0"
Calculator: Error - "Division by zero is not allowed"

User: "Square root of -25"
Calculator: Error - "Cannot calculate square root of negative number"
```

### Using Resources

```
User: "Show me the calculator history"
Calculator: Returns the history resource with available operations
```

### Getting Help

```
User: "How do I use this calculator?"
Calculator: Returns comprehensive help with all available operations
```

## Learning Points

### 1. Tool Design Patterns

- Clear, descriptive tool names
- Comprehensive input schemas
- Meaningful error messages
- Consistent return formats

### 2. Input Validation

- Use JSON Schema for basic validation
- Add custom validation in tool handlers
- Provide helpful error messages
- Handle edge cases gracefully

### 3. Resource Organization

- Group related resources logically
- Use meaningful URI schemes
- Provide appropriate MIME types
- Include helpful metadata

### 4. User Experience

- Provide help and documentation
- Use clear, formatted output
- Include context in responses
- Handle errors gracefully

## Next Steps

1. **Add More Operations**: Implement trigonometric functions, logarithms, etc.
2. **Add Memory Functions**: Store and recall previous results
3. **Add History Tracking**: Keep track of actual calculations performed
4. **Add Unit Conversions**: Extend to handle different units
5. **Add Complex Numbers**: Support for complex number operations

## Troubleshooting

**Tool not found errors**: Check tool names match exactly  
**Parameter validation errors**: Verify parameter names and types  
**Division errors**: Handled automatically with error responses  
**Connection issues**: Ensure server is running and accessible

This calculator example demonstrates the fundamental patterns you'll use in most MCP servers: multiple related tools, proper error handling, resource management, and user guidance through prompts.
