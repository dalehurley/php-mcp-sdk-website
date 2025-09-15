# PHP MCP SDK Documentation Website

This is the official documentation website for the PHP MCP SDK, built with VitePress.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
phpmcpsdkwebsite/
├── docs/                    # Documentation content
│   ├── .vitepress/         # VitePress configuration
│   │   └── config.js       # Site configuration
│   ├── index.md            # Homepage
│   ├── guide/              # Getting started guides
│   ├── examples/           # Code examples
│   ├── api/                # API reference
│   ├── integrations/       # Framework integrations
│   ├── agentic-ai/         # AI agent development
│   └── enterprise/         # Enterprise features
├── public/                 # Static assets
└── package.json
```

## 🎨 Features

- **Modern Design**: Clean, responsive design with dark/light mode
- **Interactive Examples**: Syntax-highlighted code with copy functionality
- **Fast Search**: Built-in search with instant results
- **Mobile Friendly**: Optimized for all device sizes
- **SEO Optimized**: Meta tags and structured data

## 📝 Content Guidelines

### Writing Style

- Use clear, concise language
- Include practical examples
- Provide step-by-step instructions
- Add troubleshooting sections

### Code Examples

- All code examples should be tested and working
- Include necessary imports and dependencies
- Add comments for complex logic
- Provide complete, runnable examples

### Structure

- Use consistent heading hierarchy
- Include navigation breadcrumbs
- Cross-reference related topics
- Add "Next Steps" sections

## 🚀 Deployment

The site is automatically deployed to production on push to the main branch.

### Manual Deployment

```bash
# Build the site
npm run build

# Deploy to your hosting provider
# (Copy contents of docs/.vitepress/dist/)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

### Adding New Content

1. Create markdown files in the appropriate directory
2. Update navigation in `docs/.vitepress/config.js`
3. Test all links and examples
4. Update the sitemap if needed

## 📊 Analytics

The site includes analytics to track:

- Page views and popular content
- Search queries and results
- User engagement and bounce rates
- Performance metrics

## 🐛 Issues

Report documentation issues at:

- [Documentation Issues](https://github.com/dalehurley/php-mcp-sdk/issues)
- [Website Issues](https://github.com/dalehurley/phpmcpsdkwebsite/issues)

## 📄 License

This documentation is licensed under the MIT License.
