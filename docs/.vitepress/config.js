import { defineConfig } from "vitepress";

export default defineConfig({
  title: "PHP MCP SDK",
  description:
    "Model Context Protocol implementation for PHP - Build intelligent AI agents and applications",

  // Re-enable dead link checking to identify issues
  ignoreDeadLinks: false,

  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["meta", { name: "theme-color", content: "#646cff" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:locale", content: "en" }],
    ["meta", { name: "og:site_name", content: "PHP MCP SDK" }],
    ["meta", { name: "og:image", content: "/images/og-image.png" }],
  ],

  themeConfig: {
    logo: "/images/logo.svg",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Examples", link: "/examples/" },
      { text: "API Reference", link: "/api/" },
      { text: "Integrations", link: "/integrations/" },
      { text: "Agentic AI", link: "/agentic-ai/" },
      {
        text: "v1.0.0",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/dalehurley/php-mcp-sdk/blob/main/CHANGELOG.md",
          },
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

    footer: {
      message: "Released under the MIT License.",
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
      // Add custom markdown plugins if needed
    },
  },

  vite: {
    optimizeDeps: {
      exclude: ["vitepress"],
    },
  },
});
