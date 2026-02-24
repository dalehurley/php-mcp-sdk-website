import { defineConfig } from "vitepress";

export default defineConfig({
  title: "PHP MCP SDK",
  description:
    "The most comprehensive Model Context Protocol SDK for PHP. Build intelligent AI agents, connect LLMs to external data sources, and create production-ready MCP servers and clients.",

  ignoreDeadLinks: false,

  sitemap: {
    hostname: "https://phpmcpsdk.com",
  },

  head: [
    // Favicon
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/images/logo.svg" }],

    // Theme color
    ["meta", { name: "theme-color", content: "#646cff" }],

    // SEO - canonical and keywords
    ["link", { rel: "canonical", href: "https://phpmcpsdk.com" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "PHP MCP SDK, Model Context Protocol, PHP AI, MCP server, MCP client, PHP LLM, AI agents PHP, Claude PHP, OpenAI PHP, Laravel MCP, Symfony MCP",
      },
    ],
    ["meta", { name: "author", content: "Dale Hurley" }],
    ["meta", { name: "robots", content: "index, follow" }],

    // Open Graph
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:locale", content: "en" }],
    ["meta", { name: "og:site_name", content: "PHP MCP SDK" }],
    ["meta", { name: "og:url", content: "https://phpmcpsdk.com" }],
    [
      "meta",
      {
        name: "og:title",
        content:
          "PHP MCP SDK - Model Context Protocol for PHP AI Agents",
      },
    ],
    [
      "meta",
      {
        name: "og:description",
        content:
          "Build intelligent AI agents and MCP servers in PHP. Full MCP protocol support, async architecture, Laravel/Symfony integration, OAuth 2.0, and 20+ production examples.",
      },
    ],
    ["meta", { name: "og:image", content: "https://phpmcpsdk.com/images/og-image.png" }],
    ["meta", { name: "og:image:width", content: "1200" }],
    ["meta", { name: "og:image:height", content: "630" }],

    // Twitter Cards
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:site", content: "@phpmcpsdk" }],
    [
      "meta",
      {
        name: "twitter:title",
        content: "PHP MCP SDK - Model Context Protocol for PHP",
      },
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Build intelligent AI agents and MCP servers in PHP. Async-first, Laravel/Symfony ready, OAuth 2.0, 20+ examples.",
      },
    ],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://phpmcpsdk.com/images/og-image.png",
      },
    ],

    // JSON-LD Structured Data
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "PHP MCP SDK",
        description:
          "Model Context Protocol implementation for PHP. Build intelligent AI agents, MCP servers and clients with async support, OAuth 2.0, and framework integrations.",
        url: "https://phpmcpsdk.com",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        programmingLanguage: "PHP",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: "Dale Hurley",
          url: "https://github.com/dalehurley",
        },
        license: "https://opensource.org/licenses/MIT",
        codeRepository: "https://github.com/dalehurley/php-mcp-sdk",
        softwareVersion: "1.0.0",
        releaseNotes:
          "https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md",
        keywords: [
          "PHP",
          "MCP",
          "Model Context Protocol",
          "AI agents",
          "LLM",
          "Laravel",
          "Symfony",
        ],
      }),
    ],
  ],

  themeConfig: {
    logo: "/images/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Examples", link: "/examples/" },
      { text: "API Reference", link: "/api/" },
      { text: "Integrations", link: "/integrations/" },
      { text: "Agentic AI", link: "/agentic-ai/" },
      { text: "FAQ", link: "/faq" },
      { text: "Community", link: "/community" },
      {
        text: "v1.0.0",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md",
          },
          { text: "Comparison", link: "/comparison" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Core Concepts", link: "/guide/concepts" },
            { text: "Understanding MCP", link: "/guide/understanding-mcp" },
            { text: "First Server", link: "/guide/first-server" },
            { text: "First Client", link: "/guide/first-client" },
          ],
        },
        {
          text: "Development",
          items: [
            { text: "Creating Servers", link: "/guide/creating-servers" },
            { text: "Creating Clients", link: "/guide/creating-clients" },
            { text: "Authentication", link: "/guide/authentication" },
            { text: "Transports", link: "/guide/transports" },
            { text: "Error Handling", link: "/guide/error-handling" },
          ],
        },
        {
          text: "Client Features",
          items: [
            { text: "Roots Management", link: "/guide/roots" },
            { text: "Sampling (LLM)", link: "/guide/sampling" },
            { text: "Elicitation (User Input)", link: "/guide/elicitation" },
          ],
        },
        {
          text: "Advanced Topics",
          items: [
            { text: "Security Best Practices", link: "/guide/security" },
            { text: "Performance Optimization", link: "/guide/performance" },
            { text: "Testing", link: "/guide/testing" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
          ],
        },
        {
          text: "Resources",
          items: [
            { text: "FAQ", link: "/faq" },
            { text: "Community", link: "/community" },
            { text: "Comparison", link: "/comparison" },
          ],
        },
      ],

      "/examples/": [
        {
          text: "Getting Started Examples",
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "Hello World", link: "/examples/hello-world" },
            { text: "Calculator Server", link: "/examples/calculator" },
            { text: "File Reader", link: "/examples/file-reader" },
            { text: "Weather Client", link: "/examples/weather-client" },
          ],
        },
        {
          text: "Client Features Examples",
          items: [
            {
              text: "Roots Management",
              link: "/examples/client-features/roots-example",
            },
            {
              text: "Sampling (LLM)",
              link: "/examples/client-features/sampling-example",
            },
            {
              text: "Elicitation (User Input)",
              link: "/examples/client-features/elicitation-example",
            },
          ],
        },
        {
          text: "Real-World Applications",
          items: [
            { text: "Blog CMS", link: "/examples/real-world/blog-cms" },
            { text: "Task Manager", link: "/examples/real-world/task-manager" },
            { text: "API Gateway", link: "/examples/real-world/api-gateway" },
            {
              text: "Code Analyzer",
              link: "/examples/real-world/code-analyzer",
            },
            {
              text: "Data Pipeline",
              link: "/examples/real-world/data-pipeline",
            },
          ],
        },
        {
          text: "Enterprise Examples",
          items: [
            {
              text: "Docker Deployment",
              link: "/examples/enterprise/docker-deployment",
            },
            {
              text: "Microservices Architecture",
              link: "/examples/enterprise/microservices",
            },
            {
              text: "Monitoring & Observability",
              link: "/examples/enterprise/monitoring",
            },
          ],
        },
      ],

      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Server API", link: "/api/server" },
            { text: "Client API", link: "/api/client" },
            { text: "Types & Schemas", link: "/api/types" },
            { text: "Transport APIs", link: "/api/transports" },
            { text: "Authentication", link: "/api/authentication" },
          ],
        },
      ],

      "/integrations/": [
        {
          text: "Framework Integrations",
          items: [
            { text: "Overview", link: "/integrations/" },
            { text: "Laravel Integration", link: "/integrations/laravel" },
            { text: "Symfony Integration", link: "/integrations/symfony" },
            { text: "OpenAI Integration", link: "/integrations/openai" },
            { text: "FullCX Integration", link: "/integrations/fullcx" },
          ],
        },
        {
          text: "Laravel MCP SDK",
          items: [
            {
              text: "Server Implementation",
              link: "/integrations/laravel/server-implementation",
            },
            {
              text: "Client Implementation",
              link: "/integrations/laravel/client-implementation",
            },
            {
              text: "OpenAI Integration",
              link: "/integrations/laravel/openai-integration",
            },
            {
              text: "Caching Best Practices",
              link: "/integrations/laravel/caching-best-practices",
            },
          ],
        },
      ],

      "/agentic-ai/": [
        {
          text: "Agentic AI Development",
          items: [
            { text: "Overview", link: "/agentic-ai/" },
            { text: "Building AI Agents", link: "/agentic-ai/building-agents" },
            { text: "Multi-Agent Systems", link: "/agentic-ai/multi-agent" },
            { text: "Agent Orchestration", link: "/agentic-ai/orchestration" },
            { text: "Best Practices", link: "/agentic-ai/best-practices" },
          ],
        },
      ],

      "/enterprise/": [
        {
          text: "Enterprise Features",
          items: [
            { text: "Overview", link: "/enterprise/" },
            { text: "Deployment Strategies", link: "/enterprise/deployment" },
            { text: "Monitoring & Logging", link: "/enterprise/monitoring" },
            { text: "Security & Compliance", link: "/enterprise/security" },
            { text: "Scaling & Performance", link: "/enterprise/scaling" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/dalehurley/php-mcp-sdk" },
    ],

    // Improvement 12: Enhanced footer with more useful links
    footer: {
      message: `
        <nav class="footer-links">
          <a href="/guide/getting-started">Documentation</a> ·
          <a href="/examples/">Examples</a> ·
          <a href="/api/">API Reference</a> ·
          <a href="/faq">FAQ</a> ·
          <a href="/community">Community</a> ·
          <a href="/comparison">Comparison</a> ·
          <a href="https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md" target="_blank">Changelog</a> ·
          <a href="https://github.com/dalehurley/php-mcp-sdk" target="_blank">GitHub</a>
        </nav>
        Released under the MIT License.
      `,
      copyright: "Copyright © 2025 Dale Hurley",
    },

    search: {
      provider: "local",
      options: {
        detailedView: true,
      },
    },

    editLink: {
      pattern: "https://github.com/dalehurley/php-mcp-sdk/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    lastUpdated: {
      text: "Last updated",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "medium",
      },
    },
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    lineNumbers: true,
    config: (md) => {
      // Custom markdown plugins can be added here
    },
  },

  vite: {
    optimizeDeps: {
      exclude: ["vitepress"],
    },
  },
});
