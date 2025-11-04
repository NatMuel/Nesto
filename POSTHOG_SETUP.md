# PostHog Analytics Setup

PostHog is now integrated to track email classification metrics and errors.

## Environment Variables

Add these to your deployment (Vercel/Railway):

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Get these from your PostHog project:
1. Go to [PostHog](https://posthog.com)
2. Create a project (or use existing)
3. Copy Project API Key from Settings → Project
4. Use EU host: `https://eu.i.posthog.com` or US: `https://us.i.posthog.com`

## Tracked Events

### Automatic (Webhook)
- **`email_classified`** - When webhook successfully classifies an email
  - Properties: `label`, `priority`, `draft_created`, `message_id`
- **`email_classification_error`** - When classification fails
  - Properties: `error`, `stack`
- **`webhook_fetch_email_error`** - When fetching email details fails
  - Properties: `status`, `error`, `message_id`

### Manual (User Test Button)
- **`manual_email_classified`** - When user manually classifies via settings
  - Properties: `label`, `priority`, `draft_created`
- **`manual_classification_error`** - When manual classification fails
  - Properties: `error`

### Client-side (Automatic)
- Page views
- User sessions
- Navigation events

## Viewing Analytics

1. Go to your PostHog dashboard
2. Navigate to **Events** to see all tracked events
3. Create **Insights** for:
   - Total emails classified per day/week
   - Classification success rate
   - Error rate trends
   - Most common labels
   - Draft creation rate

## Example Queries

**Email Classification Rate:**
```
Event: email_classified
Breakdown by: label
Time range: Last 7 days
```

**Error Monitoring:**
```
Event: email_classification_error
Breakdown by: error
Alert when count > 10 per hour
```

## Privacy

- User IDs are hashed for webhook events
- No email content is sent to PostHog
- Only metadata (label, priority, error messages)
- Complies with GDPR (EU hosting available)

## Optional: Disable Analytics

If you don't want analytics, simply don't set the environment variables. The app will work normally without PostHog.

