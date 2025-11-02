# 🤖 Automatic Email Classification Setup

## Overview

The automatic email classification feature uses **Microsoft Graph API webhooks** to receive notifications when new emails arrive. This eliminates the need for polling/cron jobs and provides instant classification.

## How It Works

1. **Webhook Subscription**: When a user enables auto-classification, the app creates a subscription with Microsoft Graph API
2. **Email Notification**: When a new email arrives in the user's inbox, Microsoft sends a webhook notification to your app
3. **Instant Processing**: The webhook handler immediately classifies the email and creates a draft if needed
4. **No Polling**: Much more efficient than checking for new emails periodically

## Prerequisites

### 1. Public HTTPS URL

Microsoft Graph webhooks **require a publicly accessible HTTPS endpoint**. This works automatically when deployed to:

- ✅ **Vercel** (recommended)
- ✅ **Heroku**
- ✅ **Railway**
- ✅ Any cloud platform with HTTPS

❌ **Does NOT work locally** unless you use a tunnel service like ngrok

### 2. Environment Variables

Add these to your Vercel environment variables:

```bash
# Required for webhooks
NEXT_PUBLIC_APP_URL=https://your-app-domain.vercel.app

# Required for auto-renewal (generate a random secret)
CRON_SECRET=your-random-secret-string-here

# Required for cron job database access
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**How to get values:**

- `NEXT_PUBLIC_APP_URL`: Your deployed app URL
- `CRON_SECRET`: Generate with `openssl rand -base64 32` or use any random string
- `SUPABASE_SERVICE_ROLE_KEY`: Found in Supabase Dashboard → Settings → API → service_role key ⚠️ Keep this secret!

## Setup Steps

### Step 1: Deploy to Production

Deploy your app to Vercel (or another platform):

```bash
vercel --prod
```

### Step 2: Set Environment Variable

In Vercel Dashboard:

1. Go to your project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_APP_URL` = `https://your-app.vercel.app`
3. Redeploy

### Step 3: Test the Webhook

1. Log in to your deployed app
2. Go to Settings
3. Create at least one label
4. Click "🚀 Auto-Klassifizierung aktivieren"
5. Send yourself a test email
6. The email should be classified within seconds!

## Webhook Endpoint

The webhook endpoint is available at:

```
POST https://your-app.vercel.app/api/webhooks/outlook
```

Microsoft Graph will:

1. First send a validation request with `?validationToken=...`
2. Then send notifications when emails arrive

## Subscription Details

- **Resource**: `/me/mailFolders('Inbox')/messages`
- **Change Type**: `created` (triggered when new email arrives)
- **Expiration**: 3 days (maximum allowed by Microsoft for mail resources)
- **Renewal**: Manual (user must click activate again after 3 days)

## Database Fields

The following fields in `user_settings` table store subscription info:

- `subscription_id`: Microsoft Graph subscription ID
- `subscription_expiry`: When the subscription expires (max 3 days)
- `delta_token`: For future delta query support (optional)

## Troubleshooting

### Webhook Not Receiving Notifications

1. **Check URL is HTTPS**: HTTP is not supported
2. **Verify environment variable**: Make sure `NEXT_PUBLIC_APP_URL` is set correctly
3. **Check subscription status**: Go to Settings → Auto-Classification section
4. **Test validation**: The endpoint should respond to validation tokens

### Subscription Creation Fails

1. **Check Microsoft token**: Ensure user has valid `microsoft_access_token`
2. **Verify permissions**: User must have granted mail permissions during OAuth
3. **Check API limits**: Microsoft has rate limits on subscription creation

### Emails Not Being Classified

1. **Check webhook logs**: Look at Vercel logs for incoming requests
2. **Verify labels exist**: User must have at least one label configured
3. **Check email not already categorized**: Webhook skips already-categorized emails

## Development Testing

For local development, you can use **ngrok**:

```bash
# Terminal 1: Start your dev server
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 3000

# Use the ngrok HTTPS URL as NEXT_PUBLIC_APP_URL
export NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

## API Endpoints

### Create/Renew Subscription

```http
POST /api/subscription
Authorization: User session (automatic)
```

### Delete Subscription

```http
DELETE /api/subscription
Authorization: User session (automatic)
```

### Get Subscription Status

```http
GET /api/subscription
Authorization: User session (automatic)
```

### Webhook Handler

```http
POST /api/webhooks/outlook
# Called by Microsoft Graph (no auth needed)
```

## Security

- **Client State**: Each subscription includes a unique `clientState` to verify authenticity
- **Validation Token**: Microsoft validates the endpoint before creating subscription
- **User Verification**: Webhook handler verifies user exists via `subscription_id`

## Cost Considerations

- ✅ **No polling costs**: Webhooks are push-based, saving API calls
- ✅ **Instant processing**: No delay between email arrival and classification
- ✅ **Efficient**: Only processes new emails, not all emails repeatedly

## Auto-Renewal Feature ✨

The system now automatically renews subscriptions before they expire!

- **Cron Schedule**: Runs daily at 2 AM (`0 2 * * *`)
- **Renewal Window**: Subscriptions expiring within 48 hours are renewed
- **Fallback**: If renewal fails, creates a new subscription
- **No manual intervention needed**: Set it and forget it!

The cron job checks all active subscriptions and extends their expiration by 72 hours (maximum allowed by Microsoft).

### Vercel Hobby Plan Note

The configuration is optimized for Vercel Hobby plan which has these constraints:

- ⚠️ Maximum **2 cron jobs per account**
- ⚠️ Can only run **once per day**
- ⚠️ **Imprecise timing** (may run anytime within the scheduled hour)

For more frequent renewals or guaranteed timing, upgrade to Vercel Pro plan.

## Future Improvements

1. ✅ ~~**Auto-renewal**~~ - Implemented!
2. **Delta queries**: Use `delta_token` to sync missed emails if subscription lapses
3. **Multiple mailboxes**: Support subscriptions for different folders
4. **Retry logic**: Implement exponential backoff for failed classifications

## Support

For issues or questions, check:

- Vercel logs for webhook requests
- Supabase logs for database operations
- Microsoft Graph API documentation: https://docs.microsoft.com/en-us/graph/webhooks
