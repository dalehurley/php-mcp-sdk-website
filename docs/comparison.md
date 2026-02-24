# PHP MCP SDK vs Alternatives

How does PHP MCP SDK compare to other MCP implementations and integration approaches?

## MCP SDK Comparison

The MCP ecosystem has official SDKs from Anthropic for Python and TypeScript, plus community implementations. Here's how they compare:

| Feature | PHP MCP SDK | Python SDK | TypeScript SDK |
|---------|:-----------:|:----------:|:--------------:|
| **Language** | PHP 8.1+ | Python 3.10+ | TypeScript / Node.js |
| **Status** | Community | Official | Official |
| **Async Architecture** | ✅ Amphp | ✅ asyncio | ✅ Native |
| **MCP Tools** | ✅ Full | ✅ Full | ✅ Full |
| **MCP Resources** | ✅ Full | ✅ Full | ✅ Full |
| **MCP Prompts** | ✅ Full | ✅ Full | ✅ Full |
| **Sampling** | ✅ | ✅ | ✅ |
| **Roots** | ✅ | ✅ | ✅ |
| **Elicitation** | ✅ | ✅ | ✅ |
| **STDIO Transport** | ✅ | ✅ | ✅ |
| **HTTP Streaming** | ✅ | ✅ | ✅ |
| **WebSocket** | ✅ | ✅ | ✅ |
| **OAuth 2.0 + PKCE** | ✅ | ✅ | ✅ |
| **Laravel Integration** | ✅ First-class | ❌ | ❌ |
| **Symfony Integration** | ✅ First-class | ❌ | ❌ |
| **PSR Compliance** | ✅ Full | N/A | N/A |
| **Composer Package** | ✅ | N/A | N/A |
| **Docker Examples** | ✅ | Limited | Limited |
| **Production Examples** | ✅ 20+ | ✅ | ✅ |
| **Enterprise Features** | ✅ | Limited | Limited |

## When to Choose PHP MCP SDK

### Choose PHP MCP SDK when:

- Your team is PHP-first and you want to avoid adding Python or Node.js to your stack
- You're building on **Laravel** or **Symfony** and want native framework integration
- You need to expose existing **PHP business logic** as MCP tools without rewriting it
- Your infrastructure is already PHP-based (shared hosting, existing Laravel apps, etc.)
- You need **PSR-compliant** code that integrates with your existing PHP architecture

### Choose Python SDK when:

- You're working in a Python-native team or have existing Python ML/AI infrastructure
- You need tight integration with Python AI/ML libraries (NumPy, Pandas, Hugging Face)
- Your team prefers Python for data science workflows

### Choose TypeScript SDK when:

- You're building a Next.js or Node.js application
- You want to run MCP servers in the browser or edge environments
- Your team is already JavaScript/TypeScript-first

## PHP MCP SDK vs Direct API Integration

Some developers consider calling LLM APIs directly (OpenAI, Anthropic) without MCP. Here's the comparison:

| Aspect | PHP MCP SDK | Direct API Integration |
|--------|:-----------:|:---------------------:|
| **Protocol standardisation** | ✅ Open standard | ❌ Vendor-specific |
| **AI client compatibility** | ✅ Any MCP client | ❌ API-specific |
| **Tool definition** | ✅ Once, works everywhere | ❌ Per-vendor format |
| **Context management** | ✅ Built-in | ❌ Manual |
| **Resource streaming** | ✅ Built-in | ❌ Manual |
| **Multi-model support** | ✅ Any MCP-compatible LLM | ❌ Locked to one API |
| **Development speed** | ✅ Higher (abstractions) | ❌ Lower (boilerplate) |
| **Fine-grained control** | Moderate | Full |
| **Vendor lock-in** | ✅ None | ❌ High |

**Verdict:** MCP is worth the upfront investment for any project that might need to support multiple AI models, or where you want the AI client (Claude Desktop, VS Code, etc.) to drive tool calls rather than your own code.

## PHP MCP SDK vs Laravel AI Tools (Prism, etc.)

Libraries like [Prism](https://github.com/echolabsdev/prism) focus on LLM API abstraction in PHP. MCP is a different but complementary layer:

| Aspect | PHP MCP SDK | Prism / Direct LLM Wrappers |
|--------|:-----------:|:--------------------------:|
| **Purpose** | Expose your app as AI tools | Call LLMs from your app |
| **Direction** | AI → Your App | Your App → AI |
| **Protocol** | MCP (open standard) | OpenAI/Anthropic APIs |
| **Client compatibility** | Claude Desktop, Cursor, etc. | Your own application |
| **Use case** | AI-driven workflows | App-initiated AI calls |

These are **complementary**, not competing. You can use Prism to call OpenAI from your Laravel app *and* use PHP MCP SDK to expose your app as tools for Claude Desktop.

## Feature Deep Dive

### Async Architecture

PHP MCP SDK uses **Amphp** for non-blocking I/O. This means:
- Multiple concurrent client connections without blocking
- Long-running operations don't block other requests
- Compatible with PHP's traditional synchronous code through `Amp\async()`

```php
// Non-blocking tool that doesn't block the event loop
$server->tool('slow_query', 'Run a slow database query', [...], function(array $args): array {
    // This runs in a coroutine — other requests continue during execution
    $result = Amp\delay(2.0); // Non-blocking wait
    return ['result' => 'done'];
});
```

### Framework Integration

Unlike other SDKs that require manual wiring, PHP MCP SDK's Laravel integration provides:

```php
// Register tools via service provider
class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->make(McpServer::class)->tool(
            'search_products',
            'Search the product catalogue',
            [...],
            fn(array $args) => Product::search($args['query'])->get()->toArray()
        );
    }
}
```

### Enterprise Deployment

PHP MCP SDK ships with production-ready deployment examples:
- **Docker Compose** multi-container setup
- **Kubernetes** manifests for horizontal scaling
- **Nginx** configuration for HTTP MCP transport
- **Supervisor** config for process management

---

*Something incorrect or out of date? [Edit this page on GitHub](https://github.com/dalehurley/php-mcp-sdk/edit/main/docs/comparison.md) or [open a discussion](https://github.com/dalehurley/php-mcp-sdk/discussions).*
