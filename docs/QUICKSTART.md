# Quick Start Guide

Get SpellStars running in 5 minutes!

## 1. Clone and Install

```bash
cd spelling-stars
npm install
```

## 2. Set Up Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy URL and anon key from Project Settings > API
4. Run the SQL from `README.md` in SQL Editor

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_ANON_KEY=your_key_here
```

## 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## 5. Create Test Account

1. Click "Sign In" on login page
2. Enter email and password
3. Check email for confirmation (if enabled)
4. Profile will be created automatically

## What's Next?

### For Parents:

1. Go to Dashboard
2. Click "New List"
3. Add spelling words
4. Save the list

### For Children:

1. Go to Home
2. Choose "Listen & Type" or "Say & Spell"
3. Practice spelling!
4. Earn stars and view rewards

## Common Issues

**"Missing Supabase environment variables"**

- Make sure `.env` file exists
- Check that values are correct
- Restart dev server after changing `.env`

**Database errors**

- Run the SQL schema from README
- Check RLS policies are enabled
- Verify your Supabase project is active

**Build errors**

- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Make sure Node.js version is 18+

## Features to Try

- ✅ Create spelling lists
- ✅ Add words with audio
- ✅ Play games in child mode
- ✅ Record audio pronunciations
- ✅ View rewards and progress
- ✅ Test offline mode (turn off network)

## Next Steps

- Read full [README.md](../README.md)
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for going live
- Review [database-schema.md](./database-schema.md)

Need help? Check the README or open an issue!
