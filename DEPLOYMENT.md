# Deployment Guide

This guide covers deploying the PHP MCP SDK documentation website to various hosting platforms.

## 🏗️ Build Process

### Development Build

```bash
npm run dev
```

Starts the development server with hot reload at `http://localhost:5173`

### Production Build

```bash
npm run build
```

Generates static files in `docs/.vitepress/dist/`

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing

## 🚀 Deployment Options

### GitHub Pages

1. **Enable GitHub Pages** in repository settings
2. **Set up GitHub Actions** workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy Documentation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build documentation
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        if: github.ref == 'refs/heads/main'
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

### Netlify

1. **Connect repository** to Netlify
2. **Set build settings**:
   - Build command: `npm run build`
   - Publish directory: `docs/.vitepress/dist`
3. **Configure redirects** (optional):

```toml
# netlify.toml
[build]
  publish = "docs/.vitepress/dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Vercel

1. **Import project** from GitHub
2. **Configure settings**:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `docs/.vitepress/dist`
3. **Deploy automatically** on push

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Enable gzip compression
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    }
}
```

### AWS S3 + CloudFront

1. **Build the site**:

   ```bash
   npm run build
   ```

2. **Upload to S3**:

   ```bash
   aws s3 sync docs/.vitepress/dist/ s3://your-bucket-name --delete
   ```

3. **Configure CloudFront** for SPA routing
4. **Set up custom domain** (optional)

## 🔧 Configuration

### Base URL Configuration

For subdirectory deployments, update `docs/.vitepress/config.js`:

```js
export default defineConfig({
  base: "/your-subdirectory/",
  // ... other config
});
```

### Environment Variables

Create `.env` files for different environments:

```bash
# .env.production
VITE_API_URL=https://api.example.com
VITE_ANALYTICS_ID=your-analytics-id
```

### Custom Domain

For custom domains, add a `CNAME` file to `public/`:

```
docs.phpmcpsdk.com
```

## 📊 Analytics Integration

### Google Analytics

Add to `docs/.vitepress/config.js`:

```js
export default defineConfig({
  head: [
    [
      "script",
      {
        async: "",
        src: "https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID",
      },
    ],
    [
      "script",
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID');`,
    ],
  ],
});
```

## 🛡️ Security Headers

### Netlify Headers

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:;"
```

### Nginx Headers

```nginx
# Add to nginx.conf server block
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 🔍 SEO Optimization

### Sitemap Generation

VitePress automatically generates a sitemap. Ensure it's accessible:

```js
// docs/.vitepress/config.js
export default defineConfig({
  sitemap: {
    hostname: "https://docs.phpmcpsdk.com",
  },
});
```

### Meta Tags

Ensure proper meta tags in each page:

```markdown
---
title: Page Title
description: Page description for SEO
head:
  - - meta
    - name: keywords
      content: php, mcp, sdk, documentation
---
```

## 📈 Performance Optimization

### Build Optimization

```js
// docs/.vitepress/config.js
export default defineConfig({
  vite: {
    build: {
      minify: "terser",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["vue"],
          },
        },
      },
    },
  },
});
```

### Image Optimization

Use WebP format and appropriate sizes:

```markdown
![Example](./image.webp)
```

### CDN Integration

Configure CDN for static assets:

```js
export default defineConfig({
  vite: {
    build: {
      assetsDir: "assets",
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name].[hash].[ext]",
        },
      },
    },
  },
});
```

## 🚨 Monitoring

### Uptime Monitoring

Set up monitoring with services like:

- UptimeRobot
- Pingdom
- StatusCake

### Performance Monitoring

Monitor Core Web Vitals:

- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

### Error Tracking

Integrate error tracking:

```js
// docs/.vitepress/theme/index.js
import { defineComponent } from "vue";
import DefaultTheme from "vitepress/theme";

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    // Add error tracking
    window.addEventListener("error", (event) => {
      // Send to error tracking service
    });
  },
};
```

## 🔄 Continuous Deployment

### Automated Testing

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run test # if you have tests
```

### Preview Deployments

Set up preview deployments for pull requests:

```yaml
- name: Deploy Preview
  if: github.event_name == 'pull_request'
  run: |
    npm run build
    # Deploy to preview environment
```

## 📝 Maintenance

### Regular Updates

- Update dependencies monthly
- Monitor security vulnerabilities
- Test builds regularly
- Review analytics data

### Content Updates

- Keep documentation current
- Fix broken links
- Update examples
- Improve SEO

## 🆘 Troubleshooting

### Common Issues

**Build fails**: Check Node.js version and dependencies
**Images not loading**: Verify image paths and formats
**404 errors**: Configure proper routing for SPA
**Slow loading**: Optimize images and enable compression

### Debug Mode

Enable debug mode for troubleshooting:

```bash
DEBUG=vitepress:* npm run build
```

## 📞 Support

For deployment issues:

- [GitHub Issues](https://github.com/dalehurley/phpmcpsdkwebsite/issues)
- [Documentation](https://vitepress.dev/guide/deploy)
- [Community Support](https://github.com/dalehurley/php-mcp-sdk/discussions)

Your documentation site is now ready for production! 🚀
