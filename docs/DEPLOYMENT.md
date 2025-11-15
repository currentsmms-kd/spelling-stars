# Deployment Guide for SpellStars

This guide covers deploying SpellStars to various hosting platforms.

## Prerequisites

### 1. Supabase Project Setup

Before deploying, ensure your Supabase project is configured:

1. ✅ Supabase account created at [supabase.com](https://supabase.com)
2. ✅ New project created in Supabase Dashboard
3. ✅ Database migrations applied (see below)
4. ✅ RLS policies enabled
5. ✅ Storage buckets created (`audio-recordings`, `word-audio`)

### 2. Environment Variables

SpellStars requires two environment variables to function:

#### Required Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### How to Get Your Credentials

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** > **API**
4. Copy **Project URL** → use as `VITE_SUPABASE_URL`
5. Copy **Project API keys** > **anon public** → use as `VITE_SUPABASE_ANON_KEY`

⚠️ **Important**: Use the `anon public` key, NOT the `service_role` key. The service role key should never be exposed in client-side code.

#### Local Development Setup

**Option A: Using .env file (Simple)**

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env and add your credentials
# 3. Start dev server
npm run dev
```

**Option B: Using Doppler (Recommended for teams)**

```bash
# 1. Install Doppler CLI
scoop install doppler  # Windows
brew install doppler   # macOS

# 2. Login and setup
doppler login
doppler setup

# 3. Run with Doppler
doppler run -- pnpm run dev
```

#### Error Handling

If environment variables are missing:

- **Development**: App throws immediately with helpful error message
- **Production**: Shows user-friendly setup error page with instructions

This prevents silent failures and guides developers/deployers to fix configuration issues.

### 3. Database Migrations

Apply all database migrations before first deployment:

```powershell
# Requires SUPABASE_ACCESS_TOKEN (get from https://supabase.com/dashboard/account/tokens)
.\push-migration.ps1
```

Verify migrations applied:

```powershell
.\check-migrations.ps1
.\check-tables.ps1
```

### 4. Local Testing

Test the app locally before deploying:

```bash
# Development mode
npm run dev

# Production build (test locally)
npm run build
npm run preview
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides excellent support for Vite applications and PWAs.

#### Steps

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

### Environment Variable Issues

**Problem**: "Missing Supabase environment variables" error

**Solutions**:

1. Verify `.env` file exists in project root (for local development)
2. Check both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Ensure variable names start with `VITE_` prefix (required by Vite)
4. No spaces or quotes around values in `.env` file
5. Restart dev server after creating/modifying `.env`
6. For Doppler: Run `doppler secrets` to verify secrets are set

**Problem**: "Invalid API key" or authentication errors

**Solutions**:

1. Verify you're using the `anon public` key, not `service_role` key
2. Check for extra spaces or line breaks when copying the key
3. Ensure key is from the correct Supabase project
4. Regenerate key in Supabase dashboard if compromised

**Problem**: Configuration error in production but not locally

**Solutions**:

1. Verify environment variables are set in hosting platform dashboard
2. Check for typos in variable names in hosting platform
3. Redeploy after setting/updating environment variables
4. Review hosting platform logs for specific error messages

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
