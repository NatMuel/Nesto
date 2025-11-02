# Conversation History Feature

## Overview

The email classification and drafting system now includes **conversation history context**. When processing an email, the system automatically fetches previous email exchanges with the same sender and includes this context when classifying and drafting responses.

## How It Works

### 1. Automatic History Retrieval

For each incoming email, the system:

- Extracts the sender's email address
- Fetches up to 5 sent emails to that address
- Fetches up to 5 received emails from that address (excluding the current one)
- Combines and sorts them chronologically

### 2. Context Integration

The conversation history is formatted and appended to the AI prompts for:

- **Email classification**: Helps choose the correct label based on previous interactions
- **Draft generation**: Creates more contextually aware and relevant draft responses

### 3. Format

The history is presented to the AI in this format:

```
--- VORHERIGE KOMMUNIKATION MIT DIESEM ABSENDER ---

[Absender an uns] Subject Line
Email body content (truncated to 500 chars)...

---

[Wir an Absender] Re: Subject Line
Reply content (truncated to 500 chars)...

--- ENDE VORHERIGE KOMMUNIKATION ---
```

## Benefits

- **Better Context**: AI understands the ongoing conversation and relationship
- **Consistent Responses**: Drafts reference previous exchanges when appropriate
- **Improved Classification**: More accurate label assignment based on conversation history
- **Continuity**: Responses feel more natural and connected to the thread

## Implementation

The feature is automatically enabled in:

- ✅ Manual email classification (`/api/classify-email`)
- ✅ Automatic webhook processing (`/api/webhooks/outlook`)

No configuration required - it works out of the box!

## Testing

To test the conversation history feature:

1. **Send a test email** to your connected Outlook account from an external address
2. **Classify it manually** in the settings page
3. **Reply to that email** (you can edit the draft or send a new reply)
4. **Send another email from the same address**
5. **Observe** that the AI's classification and draft now reference the previous exchange

## Performance

- History fetching adds minimal latency (~200-500ms per email)
- Graceful fallback: If history fetch fails, processing continues without context
- Errors are logged but don't interrupt the classification/drafting process

## Microsoft Graph API Permissions

This feature uses the existing permissions:

- `Mail.Read` - to fetch email history
- No additional permissions required

## Troubleshooting

If conversation history isn't working:

1. Check logs for `[Webhook] Failed to fetch conversation history` warnings
2. Verify the Microsoft access token is valid and not expired
3. Ensure the sender's email address is correctly formatted
4. Check that previous emails exist in the mailbox

## Future Enhancements

Potential improvements:

- Increase history limit (currently 5 emails each way)
- Filter by date range (e.g., only last 30 days)
- Include attachments metadata
- Thread detection for better context grouping
