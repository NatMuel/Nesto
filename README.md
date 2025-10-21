# Nesto

A Next.js app that automatically classifies incoming Outlook emails and creates draft replies for property management (Hausverwaltung).

## Features

- 🔐 **Microsoft OAuth Authentication** - Secure login with Outlook
- 🏷️ **Automatic Email Classification** - Categorizes emails as "To respond", "Waiting", or "FYI"
- ✍️ **Draft Reply Generation** - Creates German draft replies using OpenAI
- 📨 **Real-time Processing** - Webhook-based email monitoring (within ~30s)
- ⚙️ **Customizable Prompts** - Configure classification behavior

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Supabase Setup

1. Create a new project at [Supabase](https://supabase.com)
2. Go to SQL Editor and run the migration in `supabase/migrations/20251021_init.sql`
3. In Authentication settings, enable Microsoft OAuth provider:
   - Get your Microsoft Client ID and Secret from Azure Portal
   - Add redirect URL: `https://your-domain.com/auth/callback`

### 3. Environment Variables

Create a `.env.local` file with:

```bash
# Supabase
SUPABASE_PROJECT_URL="your-supabase-project-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# OpenAI
OPENAI_API_KEY="sk-..."

# App settings
WEBHOOK_SECRET="generate-random-string"
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Supabase
- **Auth**: Supabase Auth with Microsoft OAuth
- **AI**: OpenAI GPT-4
- **Email**: Microsoft Graph API
