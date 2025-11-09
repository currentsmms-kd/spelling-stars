# Deployment Guide for SpellStars

This guide covers deploying SpellStars to various hosting platforms.

## Prerequisites

1. ✅ Supabase project set up with database tables
2. ✅ Environment variables configured
3. ✅ App tested locally

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides excellent support for Vite applications and PWAs.

#### Steps:

1. **Install Vercel CLI** (optional):

   ```bash
   npm i -g vercel
   ```

2. **Deploy via CLI**:

   ```bash
   vercel
   ```

3. **Or deploy via GitHub**:
   - Push code to GitHub
   - Import project in [Vercel Dashboard](https://vercel.com)
   - Set environment variables in Vercel project settings
   - Deploy automatically on push

4. **Configure Environment Variables** in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

5. **Configure Build Settings**:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Option 2: Netlify

1. **Install Netlify CLI** (optional):

   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy via CLI**:

   ```bash
   netlify deploy --prod
   ```

3. **Or deploy via GitHub**:
   - Connect repository in [Netlify Dashboard](https://netlify.com)
   - Configure build settings
   - Deploy automatically

4. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

5. **Environment Variables**:
   - Add in Netlify dashboard under Site Settings > Environment Variables

### Option 3: Static Hosting (Firebase, Cloudflare Pages, etc.)

1. **Build the app**:

   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting provider

3. **Configure redirects** for SPA routing:

   For Firebase (`firebase.json`):

   ```json
   {
     "hosting": {
       "public": "dist",
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

## Post-Deployment Checklist

### 1. Test PWA Installation

- ✅ Visit deployed site on mobile
- ✅ Try "Add to Home Screen"
- ✅ Verify service worker is registered (DevTools > Application)

### 2. Test Offline Functionality

- ✅ Open app while online
- ✅ Turn off network
- ✅ Verify child routes work offline
- ✅ Queue an attempt while offline
- ✅ Turn network back on
- ✅ Verify background sync completes

### 3. Test Authentication

- ✅ Sign up new user
- ✅ Sign in existing user
- ✅ Verify profile creation
- ✅ Test role-based redirects

### 4. Test Features

- ✅ Create spelling list (parent)
- ✅ Add words to list
- ✅ Play Listen & Type (child)
- ✅ Play Say & Spell (child)
- ✅ Audio recording works
- ✅ View rewards page

### 5. Performance Checks

- ✅ Run Lighthouse audit
  - Target: Performance 90+, Accessibility 90+, Best Practices 90+, PWA 100
- ✅ Check bundle size
- ✅ Verify fast initial load

## Environment-Specific Configuration

### Production Environment Variables

Ensure these are set in your hosting platform:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

### Security Considerations

1. **Row Level Security**: Verify RLS policies are enabled in Supabase
2. **API Keys**: Use environment variables, never commit keys
3. **CORS**: Configure allowed origins in Supabase dashboard
4. **HTTPS**: Ensure hosting uses HTTPS (required for service workers)

## Custom Domain

### Vercel

1. Go to Project Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Netlify

1. Go to Site Settings > Domain Management
2. Add custom domain
3. Configure DNS records

## Monitoring & Analytics

### Error Tracking

Consider integrating:

- Sentry
- LogRocket
- Bugsnag

### Analytics

Consider adding:

- Google Analytics
- Plausible
- Umami

### Performance Monitoring

- Vercel Analytics (built-in)
- Web Vitals tracking

## Troubleshooting

### Service Worker Issues

- Clear browser cache
- Check DevTools > Application > Service Workers
- Verify `sw.js` is accessible at root

### Build Failures

- Check Node version (should be 18+)
- Clear `node_modules` and reinstall
- Verify all environment variables are set

### Route 404 Errors

- Ensure SPA redirects are configured
- Check hosting platform's routing documentation

### Supabase Connection Issues

- Verify environment variables
- Check Supabase project status
- Review RLS policies
- Test API keys

## Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      # Add deployment step based on your platform
```

## Support

For deployment issues:

1. Check hosting platform documentation
2. Review build logs
3. Test locally with production build (`npm run build && npm run preview`)
4. Check browser console for errors

## Updates

To deploy updates:

1. Make changes locally
2. Test thoroughly
3. Commit and push to repository
4. Automatic deployment will trigger (if configured)
5. Monitor deployment status
6. Test live site after deployment
