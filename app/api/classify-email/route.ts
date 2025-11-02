import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fetch conversation history with the sender
async function fetchConversationHistory(
  accessToken: string,
  senderEmail: string,
  currentMessageId: string
): Promise<string> {
  try {
    // Extract email address from sender string (format: "Name <email@domain.com>")
    const emailMatch = senderEmail.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : senderEmail;

    // Fetch sent emails using $search (more reliable than complex filters)
    // Note: $search doesn't support $orderby - results are sorted by relevance
    const sentResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$search="to:${email}"&$select=subject,body,sentDateTime&$top=5`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Fetch received emails using $search
    const receivedResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$search="from:${email}"&$select=subject,body,receivedDateTime,from&$top=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!sentResponse.ok || !receivedResponse.ok) {
      console.warn("Failed to fetch conversation history");
      return "";
    }

    const sentEmails = await sentResponse.json();
    const receivedEmails = await receivedResponse.json();

    // Filter out the current message from received emails
    const filteredReceivedEmails = (receivedEmails.value || []).filter(
      (email: any) => email.id !== currentMessageId
    );

    // Combine and sort by date
    const allEmails = [
      ...(sentEmails.value || []).map((email: any) => ({
        ...email,
        type: "sent",
        date: new Date(email.sentDateTime),
      })),
      ...filteredReceivedEmails.map((email: any) => ({
        ...email,
        type: "received",
        date: new Date(email.receivedDateTime),
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    if (allEmails.length === 0) {
      return "";
    }

    // Format conversation history
    const history = allEmails
      .map((email) => {
        const bodyContent =
          email.body?.content?.replace(/<[^>]*>/g, "").substring(0, 500) || "";
        const direction =
          email.type === "sent" ? "Wir an Absender" : "Absender an uns";
        return `[${direction}] ${
          email.subject || "(Kein Betreff)"
        }\n${bodyContent.trim()}${bodyContent.length >= 500 ? "..." : ""}\n`;
      })
      .join("\n---\n\n");

    return `\n\n--- VORHERIGE KOMMUNIKATION MIT DIESEM ABSENDER ---\n${history}\n--- ENDE VORHERIGE KOMMUNIKATION ---\n`;
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get Microsoft access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const microsoftAccessToken = authHeader.substring(7);

    const requestBody = await request.json();
    const { messageId, subject, body: bodyContent, from } = requestBody;

    // Get user from Supabase (for prompt and labels)
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user settings and labels
    const { data: settings } = await supabase
      .from("user_settings")
      .select("general_prompt")
      .eq("user_id", session.user.id)
      .single();

    const { data: labels } = await supabase
      .from("labels")
      .select("*")
      .eq("user_id", session.user.id)
      .order("display_order", { ascending: true });

    if (!labels || labels.length === 0) {
      return NextResponse.json(
        { error: "No labels configured. Please create labels in settings." },
        { status: 400 }
      );
    }

    const generalPrompt =
      settings?.general_prompt ||
      "Du bist Assistenz einer Hausverwaltung. Analysiere eingehende E-Mails basierend auf den verfügbaren Kategorien und erstelle professionelle Antwortentwürfe auf Deutsch im 'Sie'-Ton.";

    // Fetch conversation history with this sender
    const conversationHistory = await fetchConversationHistory(
      microsoftAccessToken,
      from,
      messageId
    );

    // Build classification prompt with dynamic labels
    const labelDescriptions = labels
      .map((label) => `- **${label.name}**: ${label.description}`)
      .join("\n");

    const labelNames = labels.map((label) => label.name);

    const classificationSystemPrompt = `${generalPrompt}

Verfügbare Kategorien:
${labelDescriptions}

Wähle die passendste Kategorie für die E-Mail aus und bewerte die Priorität basierend auf dem Inhalt.

PRIORITÄT-BEWERTUNG:
- "Hoch": Muss sofort beantwortet werden (Notfälle, Rechtsfälle mit Fristen, dringende Schäden, Beschwerden mit Eskalation)
- "Mittel": Sollte in den nächsten Tagen beantwortet werden (normale Anfragen, Terminvereinbarungen, reguläre Schadenmeldungen)
- "Niedrig": Kann eine Woche warten (allgemeine Infos, nicht dringende Anfragen, Newsletter)

Antworte im JSON-Format mit: {"label": "gewählter Label-Name", "create_draft": true/false, "priority": "Hoch"|"Mittel"|"Niedrig"}

Setze "create_draft" auf true, wenn ein Antwortentwurf erstellt werden soll.`;

    // Classify with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: classificationSystemPrompt,
        },
        {
          role: "user",
          content: `Betreff: ${subject}\nVon: ${from}\n\nInhalt:\n${bodyContent}${conversationHistory}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const classificationResult = JSON.parse(
      completion.choices[0].message.content || "{}"
    );
    const selectedLabelName = classificationResult.label;
    const shouldCreateDraft = classificationResult.create_draft === true;
    const priority = classificationResult.priority || "Mittel";

    // Find the selected label
    const selectedLabel = labels.find(
      (label) => label.name.toLowerCase() === selectedLabelName?.toLowerCase()
    );

    if (!selectedLabel) {
      return NextResponse.json(
        { error: `Unknown label: ${selectedLabelName}` },
        { status: 400 }
      );
    }

    // Ensure category exists in Outlook
    await ensureCategoryExists(
      microsoftAccessToken,
      selectedLabel.name,
      selectedLabel.color
    );

    // Apply category
    await applyCategory(microsoftAccessToken, messageId, selectedLabel.name);

    // Set email importance based on priority
    await setEmailImportance(microsoftAccessToken, messageId, priority);

    // Create draft if needed
    let draftCreated = false;
    if (shouldCreateDraft && selectedLabel.draft_prompt) {
      // Build system prompt with conversation history awareness
      const contextInstruction = conversationHistory
        ? `\n\nKONTEXT UND VORHERIGE KOMMUNIKATION:\nEs existieren vorherige E-Mails mit diesem Absender (siehe unten im Kontext). Berücksichtige diese Korrespondenz in deiner Antwort:\n- Beziehe dich auf frühere Versprechen, Termine oder besprochene Themen\n- Passe Ton und Dringlichkeit basierend auf dem Verlauf der Konversation an\n- Wenn es Wiederholungen oder Eskalationen gibt, erkenne und adressiere diese\n- Zeige, dass du den bisherigen Austausch kennst`
        : "";

      const draftCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${generalPrompt}${contextInstruction}\n\n${selectedLabel.draft_prompt}\n\nWICHTIG: Gebe NUR den E-Mail-Text zurück, OHNE Klassifizierung, Betreff oder zusätzliche Formatierung. Keine Markdown-Formatierung verwenden. Nur der reine Text der E-Mail-Antwort.`,
          },
          {
            role: "user",
            content: `Erstelle einen Antwortentwurf für diese E-Mail:\n\nBetreff: ${subject}\nVon: ${from}\n\nInhalt:\n${bodyContent}${conversationHistory}`,
          },
        ],
        temperature: 0.3,
      });

      let draftReply = draftCompletion.choices[0].message.content || "";

      // Clean up any markdown formatting or classification text that might still appear
      draftReply = draftReply
        .replace(/\*\*Klassifizierung:\*\*.*?\n/g, "")
        .replace(/\*\*Antwortentwurf:\*\*.*?\n/g, "")
        .replace(/^Betreff:.*?\n/gm, "")
        .trim();

      await createReplyDraft(microsoftAccessToken, messageId, draftReply);
      draftCreated = true;
    }

    return NextResponse.json({
      success: true,
      category: selectedLabel.name,
      label: selectedLabel.name,
      priority,
      draftCreated,
    });
  } catch (error: any) {
    console.error("Classification error:", error);
    return NextResponse.json(
      { error: "Classification failed", details: error.message },
      { status: 500 }
    );
  }
}

async function ensureCategoryExists(
  accessToken: string,
  categoryName: string,
  color: string = "preset2"
): Promise<void> {
  try {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/outlook/masterCategories",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    const exists = data.value.some(
      (cat: any) => cat.displayName === categoryName
    );

    if (!exists) {
      await fetch(
        "https://graph.microsoft.com/v1.0/me/outlook/masterCategories",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName: categoryName,
            color: color,
          }),
        }
      );
    }
  } catch (error) {
    console.error("Error ensuring category exists:", error);
  }
}

async function applyCategory(
  accessToken: string,
  messageId: string,
  category: string
): Promise<void> {
  await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      categories: [category],
    }),
  });
}

async function createReplyDraft(
  accessToken: string,
  messageId: string,
  replyText: string
): Promise<void> {
  // First create the reply draft
  const createResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/createReply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!createResponse.ok) {
    throw new Error("Failed to create reply draft");
  }

  const draft = await createResponse.json();

  // Update the draft with plain text content (preserves line breaks)
  await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: {
        contentType: "Text",
        content: replyText,
      },
    }),
  });
}

async function setEmailImportance(
  accessToken: string,
  messageId: string,
  priority: string
): Promise<void> {
  // Map German priority to Outlook importance
  const importanceMap: Record<string, string> = {
    Hoch: "high",
    Mittel: "normal",
    Niedrig: "low",
  };

  const importance = importanceMap[priority] || "normal";

  await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      importance,
    }),
  });
}
