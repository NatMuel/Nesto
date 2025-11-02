# Conversation History Feature

## Overview

The email classification and drafting system automatically includes **conversation history context** when processing emails. This helps the AI generate more relevant and contextually aware responses.

## How It Works

When a new email arrives, the system:

1. **Identifies the sender** from the email address
2. **Fetches previous communications** with that sender:
   - Up to 5 sent emails (from Sent Items folder)
   - Up to 10 received emails (from Inbox)
3. **Formats the history** chronologically with clear labels:
   - `[Wir an Absender]` - Emails you sent to them
   - `[Absender an uns]` - Emails they sent to you
4. **Includes context** in both classification and draft generation

## Technical Implementation

### Microsoft Graph Search API

The feature uses the `$search` query parameter with KQL (Keyword Query Language) syntax:

```typescript
// Sent emails
$search = "to:email@domain.com";

// Received emails
$search = "from:email@domain.com";
```

This approach is more reliable than complex `$filter` queries for email data.

### Context Integration

The system automatically adds explicit instructions to the AI when conversation history exists:

```
KONTEXT UND VORHERIGE KOMMUNIKATION:
Es existieren vorherige E-Mails mit diesem Absender (siehe unten im Kontext).
Berücksichtige diese Korrespondenz in deiner Antwort:
- Beziehe dich auf frühere Versprechen, Termine oder besprochene Themen
- Passe Ton und Dringlichkeit basierend auf dem Verlauf der Konversation an
- Wenn es Wiederholungen oder Eskalationen gibt, erkenne und adressiere diese
- Zeige, dass du den bisherigen Austausch kennst
```

The conversation history itself is appended to the user message:

```
Betreff: [Current Email Subject]
Von: [Sender]
Inhalt: [Current Email Body]

--- VORHERIGE KOMMUNIKATION MIT DIESEM ABSENDER ---
[Previous email exchanges...]
--- ENDE VORHERIGE KOMMUNIKATION ---
```

This dual approach ensures the AI:

1. **Knows** to look for and use conversation history (system instruction)
2. **Has** the actual conversation data to reference (user message)

## Benefits

- **Better Context**: AI understands ongoing conversations and relationships
- **Consistent Responses**: Drafts naturally reference previous exchanges
- **Improved Classification**: More accurate label assignment based on conversation flow
- **Escalation Detection**: AI recognizes when conversations are becoming urgent

## Automatic Operation

The feature works automatically in:

- ✅ Manual email classification (Settings page)
- ✅ Webhook-triggered auto-classification (real-time)

No configuration required!

## Privacy & Performance

- **Privacy**: Only fetches emails between you and the specific sender
- **Performance**: Minimal latency (~200-500ms per email)
- **Reliability**: Gracefully handles failures without interrupting classification
- **Token Efficiency**: Email bodies are truncated to 500 characters each

## Limitations

- Maximum 5 sent emails per sender
- Maximum 10 received emails per sender
- No thread detection (emails sorted chronologically, not by conversation)
- Results sorted by relevance, not strictly by date
- Requires valid Microsoft Graph API access token

## Future Improvements

Potential enhancements:

- Increase history limits
- Add date range filtering (e.g., last 30 days only)
- Implement proper email thread detection
- Include attachment metadata
- Cache history for frequently contacted senders
