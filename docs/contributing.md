# Contributing to PHP MCP SDK

Thank you for your interest in contributing to the PHP MCP SDK! This guide will help you get started with contributing to the project.

## 🤝 How to Contribute

There are many ways to contribute to the PHP MCP SDK:

- **Report bugs** and request features
- **Improve documentation** and examples
- **Submit code** improvements and new features
- **Help other users** in discussions and issues
- **Share your projects** built with the SDK

## 📋 Before You Start

### Code of Conduct

This project follows a Code of Conduct to ensure a welcoming environment for all contributors. Please read and follow our community guidelines.

### Getting Familiar

Before contributing, please:

1. Read the [documentation](./guide/getting-started.md)
2. Try the [examples](./examples/)
3. Understand the [MCP protocol](https://modelcontextprotocol.io)
4. Review existing [issues](https://github.com/dalehurley/php-mcp-sdk/issues)

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (PHP version, OS, etc.)
- **Code samples** that demonstrate the issue

### Feature Requests

For new features, please describe:

- **Use case** and problem it solves
- **Proposed solution** or implementation approach
- **Alternative approaches** considered
- **Impact** on existing functionality

## 🛠️ Development Setup

### Prerequisites

- PHP 8.1 or higher
- Composer
- Git

### Setting Up Your Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/your-username/php-mcp-sdk.git
   cd php-mcp-sdk
   ```

3. **Install dependencies**:

   ```bash
   composer install
   ```

4. **Run tests** to ensure everything works:
   ```bash
   composer test
   ```

### Development Workflow

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Add tests** for your changes

4. **Run the test suite**:

   ```bash
   composer test
   composer test:coverage
   ```

5. **Check code quality**:

   ```bash
   composer lint
   composer analyze
   ```

6. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Add: your descriptive commit message"
   ```

7. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request** on GitHub

## 📝 Coding Standards

### PHP Standards

We follow these coding standards:

- **PSR-12** for code style
- **PSR-4** for autoloading
- **PHPDoc** for documentation
- **Type declarations** for all parameters and return types

### Code Style

```php
<?php

declare(strict_types=1);

namespace MCP\Example;

use MCP\Server\McpServer;
use MCP\Types\Implementation;

/**
 * Example class demonstrating coding standards.
 */
class ExampleClass
{
    private string $property;

    public function __construct(string $property)
    {
        $this->property = $property;
    }

    /**
     * Example method with proper documentation.
     */
    public function exampleMethod(array $parameters): array
    {
        return [
            'property' => $this->property,
            'parameters' => $parameters,
        ];
    }
}
```

### Naming Conventions

- **Classes**: PascalCase (`McpServer`, `TransportInterface`)
- **Methods**: camelCase (`executeTask`, `validateInput`)
- **Properties**: camelCase (`$serverName`, `$connectionPool`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_CONNECTIONS`, `DEFAULT_TIMEOUT`)

## 🧪 Testing Guidelines

### Test Structure

```php
<?php

declare(strict_types=1);

namespace MCP\Tests\Server;

use MCP\Server\McpServer;
use MCP\Types\Implementation;
use PHPUnit\Framework\TestCase;

class McpServerTest extends TestCase
{
    private McpServer $server;

    protected function setUp(): void
    {
        $this->server = new McpServer(
            new Implementation('test-server', '1.0.0')
        );
    }

    public function testServerCreation(): void
    {
        $this->assertInstanceOf(McpServer::class, $this->server);
    }

    public function testToolRegistration(): void
    {
        $this->server->tool(
            'test-tool',
            'Test tool description',
            ['type' => 'object'],
            fn($args) => ['result' => 'success']
        );

        $tools = $this->server->getTools();
        $this->assertCount(1, $tools);
        $this->assertEquals('test-tool', $tools[0]['name']);
    }
}
```

### Test Categories

- **Unit Tests**: Test individual classes and methods
- **Integration Tests**: Test component interactions
- **Feature Tests**: Test complete features end-to-end
- **Performance Tests**: Test performance characteristics

### Running Tests

```bash
# Run all tests
composer test

# Run specific test suite
composer test -- --testsuite=Unit

# Run with coverage
composer test:coverage

# Run performance tests
composer test:performance
```

## 📚 Documentation

### Documentation Standards

- **Clear and concise** explanations
- **Code examples** for all features
- **Real-world use cases** when possible
- **API documentation** for all public methods

### Documentation Structure

````markdown
# Feature Name

Brief description of the feature.

## Overview

Detailed explanation of what the feature does and why it's useful.

## Basic Usage

```php
// Simple example
$example = new ExampleClass();
$result = $example->doSomething();
```
````

## Advanced Usage

```php
// More complex example with configuration
$example = new ExampleClass([
    'option1' => 'value1',
    'option2' => 'value2',
]);
```

## API Reference

### Methods

#### `doSomething(array $parameters): array`

Description of what the method does.

**Parameters:**

- `$parameters` (array): Description of parameters

**Returns:**

- `array`: Description of return value

**Example:**

```php
$result = $example->doSomething(['key' => 'value']);
```

````

## 🔄 Pull Request Process

### Before Submitting

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] No merge conflicts with main branch

### Pull Request Template

When creating a pull request, please include:

```markdown
## Description

Brief description of changes and motivation.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
````

### Review Process

1. **Automated checks** must pass (tests, linting, etc.)
2. **Code review** by maintainers
3. **Discussion** and feedback incorporation
4. **Final approval** and merge

## 🏗️ Architecture Guidelines

### Design Principles

- **Single Responsibility**: Each class should have one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Dependency Injection**: Use constructor injection for dependencies
- **Interface Segregation**: Prefer small, focused interfaces
- **Type Safety**: Use strict types throughout

### Project Structure

```
src/
├── Client/          # MCP client implementations
├── Server/          # MCP server implementations
├── Shared/          # Shared components
├── Types/           # Type definitions and schemas
├── Transport/       # Transport layer implementations
├── Validation/      # Input validation and schemas
└── Utils/           # Utility classes

tests/
├── Unit/            # Unit tests
├── Integration/     # Integration tests
├── Feature/         # Feature tests
└── Performance/     # Performance tests

examples/
├── server/          # Server examples
├── client/          # Client examples
└── real-world/      # Real-world applications
```

## 🎯 Contribution Areas

### High Priority

- **Performance optimizations**
- **Additional transport implementations**
- **Enhanced error handling**
- **More comprehensive examples**
- **Documentation improvements**

### Medium Priority

- **Framework integrations** (Symfony, CakePHP, etc.)
- **Additional validation schemas**
- **Monitoring and observability tools**
- **Development utilities**

### Ideas Welcome

- **Creative examples** and use cases
- **Performance benchmarks**
- **Security enhancements**
- **Developer experience improvements**

## 🏆 Recognition

Contributors are recognized in:

- **README.md** contributors section
- **CHANGELOG.md** for significant contributions
- **GitHub releases** for major features
- **Documentation** for examples and guides

## 📞 Getting Help

### Community Support

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Discord/Slack**: Real-time community chat (if available)

### Direct Contact

For sensitive issues or private discussions:

- Email: [maintainers@example.com](mailto:maintainers@example.com)

## 📄 Legal

### Licensing

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (MIT License).

### Copyright

Please ensure you have the right to contribute any code or content you submit.

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Cycle

- **Regular releases** every 2-4 weeks
- **Hotfix releases** for critical bugs
- **Major releases** for significant changes

Thank you for contributing to PHP MCP SDK! Your contributions help make AI development more accessible and powerful for the PHP community. 🎉
