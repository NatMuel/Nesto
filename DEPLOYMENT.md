# Deployment Guide

This guide covers deploying your Nesto app to production.

## Prerequisites

- GitHub/GitLab repository with your code
- Production database (PostgreSQL)
- Domain name (optional but recommended)
- Microsoft Azure app configured for production

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel offers the easiest deployment with built-in Next.js support.

#### Steps:

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**

   - Visit [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure environment variables (see below)
   - Deploy!

3. **Configure Environment Variables**

   In Vercel dashboard, add:

   ```
   DATABASE_URL=postgresql://...
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...
   MICROSOFT_TENANT_ID=common
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=<generate-new-secret>
   OPENAI_API_KEY=sk-...
   WEBHOOK_SECRET=<generate-new-secret>
   ```

4. **Update Azure Redirect URI**

   - Go to Azure Portal → Your App Registration
   - Add redirect URI: `https://your-app.vercel.app/api/auth/callback`

5. **Verify Webhook**
   - Your webhook URL: `https://your-app.vercel.app/api/webhook`
   - Must use HTTPS (Vercel provides this automatically)

#### Automatic Subscription Renewal

The `vercel.json` file includes a cron job configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/renew-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs daily at midnight (UTC) to renew expiring subscriptions.

### Option 2: Railway

Railway offers an excellent developer experience with built-in PostgreSQL.

#### Steps:

1. **Create Railway Account**

   - Visit [railway.app](https://railway.app)
   - Sign in with GitHub

2. **Create New Project**

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL**

   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Configure Environment Variables**

   - Go to your service → Variables
   - Add all environment variables from `.env.example`
   - Set `NEXTAUTH_URL` to your Railway URL

5. **Update Azure Configuration**

   - Add Railway URL as redirect URI in Azure

6. **Set Up Cron Job**
   - Railway doesn't have built-in cron
   - Use external service like [cron-job.org](https://cron-job.org)
   - Schedule daily GET request to: `https://your-app.railway.app/api/cron/renew-subscriptions`

### Option 3: Self-Hosted (VPS)

For more control, deploy to a VPS (DigitalOcean, Linode, AWS EC2, etc.).

#### Requirements:

- Ubuntu 22.04 LTS (or similar)
- Node.js 18+
- PostgreSQL 14+
- Nginx (reverse proxy)
- PM2 (process manager)
- Certbot (SSL certificates)

#### Steps:

1. **Set Up Server**

   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PostgreSQL
   sudo apt install -y postgresql postgresql-contrib

   # Install Nginx
   sudo apt install -y nginx

   # Install PM2
   sudo npm install -g pm2
   ```

2. **Configure Database**

   ```bash
   sudo -u postgres psql
   CREATE DATABASE hausverwaltung;
   CREATE USER hausverwaltung_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE hausverwaltung TO hausverwaltung_user;
   \q
   ```

3. **Clone and Build**

   ```bash
   cd /var/www
   git clone <your-repo> hausverwaltung
   cd hausverwaltung
   npm install

   # Create .env file
   nano .env
   # Add all environment variables

   # Run migrations
   npx prisma migrate deploy
   npx prisma generate

   # Build
   npm run build
   ```

4. **Set Up PM2**

   ```bash
   pm2 start npm --name "hausverwaltung" -- start
   pm2 startup
   pm2 save
   ```

5. **Configure Nginx**

   ```nginx
   # /etc/nginx/sites-available/hausverwaltung
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/hausverwaltung /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

6. **Set Up SSL with Certbot**

   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

7. **Set Up Cron Job**
   ```bash
   crontab -e
   # Add:
   0 0 * * * curl https://your-domain.com/api/cron/renew-subscriptions
   ```

## Database Options

### Recommended Providers:

1. **Neon** (Free tier available)

   - Serverless PostgreSQL
   - Great for Vercel deployments
   - [neon.tech](https://neon.tech)

2. **Supabase** (Free tier available)

   - PostgreSQL with extras
   - Great dashboard
   - [supabase.com](https://supabase.com)

3. **Railway** (Free tier available)

   - Simple PostgreSQL
   - Integrated with Railway deployments
   - [railway.app](https://railway.app)

4. **Amazon RDS** (Production)
   - Fully managed PostgreSQL
   - Auto-backups, scaling
   - [aws.amazon.com/rds](https://aws.amazon.com/rds)

## Post-Deployment Checklist

- [ ] Verify OAuth login works
- [ ] Test email classification
- [ ] Check webhook subscription creation
- [ ] Verify categories appear in Outlook
- [ ] Test draft reply creation
- [ ] Confirm cron job for subscription renewal
- [ ] Set up monitoring (optional)
- [ ] Configure backups

## Monitoring (Optional)

### Simple Health Check

Add this endpoint for uptime monitoring:

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: "Database connection failed" },
      { status: 503 }
    );
  }
}
```

Use services like:

- [UptimeRobot](https://uptimerobot.com) - Free uptime monitoring
- [BetterStack](https://betterstack.com) - Comprehensive monitoring
- [Sentry](https://sentry.io) - Error tracking

## Scaling Considerations

### For Multiple Users

If deploying for multiple Hausverwaltung companies:

1. **Database**: Ensure connection pooling

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     connection_limit = 20
   }
   ```

2. **OpenAI Rate Limits**: Monitor usage

   - Implement rate limiting per user
   - Consider caching classifications

3. **Webhook Processing**: Use queue for high volume
   - Consider Redis + Bull for job queue
   - Process emails asynchronously

### Cost Optimization

- **OpenAI**: Use GPT-3.5-turbo for lower costs (~$0.001 per email)
- **Database**: Use connection pooling to reduce costs
- **Hosting**: Start with free tiers, scale as needed

## Security Best Practices

1. **Secrets Management**

   - Never commit `.env` to git
   - Rotate secrets regularly
   - Use environment-specific secrets

2. **Database**

   - Enable SSL connections
   - Regular backups
   - Restrict network access

3. **API Keys**

   - Rotate OpenAI keys periodically
   - Monitor usage for anomalies
   - Set spending limits

4. **Webhooks**
   - Always validate `clientState`
   - Use HTTPS only
   - Implement rate limiting

## Troubleshooting

### Webhook Validation Fails

```bash
# Test webhook endpoint
curl -X POST "https://your-app.com/api/webhook?validationToken=test123"
# Should return: test123
```

### Subscription Keeps Expiring

- Check cron job is running
- Verify token refresh works
- Ensure subscription renewal endpoint is accessible

### Database Connection Issues

```bash
# Test connection string
psql "postgresql://user:pass@host:5432/db?sslmode=require"
```

### High OpenAI Costs

- Switch to GPT-3.5-turbo
- Implement per-user rate limiting
- Add email classification caching

## Rollback Plan

If deployment fails:

1. **Vercel**: Use "Instant Rollback" in dashboard
2. **Railway**: Redeploy previous commit
3. **Self-hosted**:
   ```bash
   cd /var/www/hausverwaltung
   git checkout <previous-commit>
   npm install
   npm run build
   pm2 restart hausverwaltung
   ```

## Support

For deployment issues, check:

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- Project README and GitHub issues
