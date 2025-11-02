import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use service role for webhooks (no user session available)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

// Handle webhook validation (Microsoft Graph sends this on subscription creation)
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const validationToken = url.searchParams.get("validationToken");

    // Step 1: Handle validation request
    if (validationToken) {
      console.log("[Webhook] Validation request received");
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Step 2: Handle notification
    const body = await request.json();
    const notifications = body.value || [];

    console.log(`[Webhook] Received ${notifications.length} notifications`);

    // Process each notification
    for (const notification of notifications) {
      const { subscriptionId, resource, resourceData } = notification;

      // Get user by subscription_id (using admin client since no user session)
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("user_settings")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .single();

      if (settingsError || !settings) {
        console.error(
          `[Webhook] No user found for subscription ${subscriptionId}`,
          settingsError
        );
        continue;
      }

      console.log(`[Webhook] Processing notification for user ${settings.user_id}`);

      // Get message details
      const messageId = resourceData?.id;
      if (!messageId) {
        console.error("[Webhook] No message ID in notification");
        continue;
      }

      console.log(`[Webhook] Fetching email ${messageId}`);

      // Fetch full email details
      const emailResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,body,bodyPreview,categories`,
        {
          headers: {
            Authorization: `Bearer ${settings.microsoft_access_token}`,
          },
        }
      );

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("[Webhook] Failed to fetch email details:", {
          status: emailResponse.status,
          error: errorText,
        });
        continue;
      }

      const email = await emailResponse.json();

      // Skip if already categorized
      if (email.categories && email.categories.length > 0) {
        console.log(`[Webhook] Email ${messageId} already categorized, skipping`);
        continue;
      }

      // Get user's labels
      const { data: labels } = await supabaseAdmin
        .from("labels")
        .select("*")
        .eq("user_id", settings.user_id)
        .order("display_order", { ascending: true });

      if (!labels || labels.length === 0) {
        console.error("[Webhook] No labels configured for user");
        continue;
      }

      console.log(`[Webhook] Processing with ${labels.length} labels`);

      // Classify the email
      await classifyEmail(
        email,
        labels,
        settings.general_prompt,
        settings.microsoft_access_token
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: error.message },
      { status: 500 }
    );
  }
}

async function classifyEmail(
  email: any,
  labels: any[],
  generalPrompt: string,
  accessToken: string
) {
  try {
    const { id: messageId, subject, body, bodyPreview, from } = email;
    const bodyContent = body?.content || bodyPreview;

    // Build classification prompt
    const labelDescriptions = labels
      .map((label) => `- **${label.name}**: ${label.description}`)
      .join("\n");

    const classificationSystemPrompt = `${generalPrompt}

Verfügbare Kategorien:
${labelDescriptions}

Wähle die passendste Kategorie für die E-Mail aus.

Antworte im JSON-Format mit: {"label": "gewählter Label-Name", "create_draft": true/false}

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
          content: `Betreff: ${subject}\nVon: ${from?.emailAddress?.address}\n\nInhalt:\n${bodyContent}`,
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

    // Find the selected label
    const selectedLabel = labels.find(
      (label) => label.name.toLowerCase() === selectedLabelName?.toLowerCase()
    );

    if (!selectedLabel) {
      console.error(`Unknown label: ${selectedLabelName}`);
      return;
    }

    // Ensure category exists in Outlook
    await ensureCategoryExists(
      accessToken,
      selectedLabel.name,
      selectedLabel.color
    );

    // Apply category
    await applyCategory(accessToken, messageId, selectedLabel.name);

    // Create draft if needed
    if (shouldCreateDraft && selectedLabel.draft_prompt) {
      const draftCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${generalPrompt}\n\n${selectedLabel.draft_prompt}\n\nWICHTIG: Gebe NUR den E-Mail-Text zurück, OHNE Klassifizierung, Betreff oder zusätzliche Formatierung. Keine Markdown-Formatierung verwenden. Nur der reine Text der E-Mail-Antwort.`,
          },
          {
            role: "user",
            content: `Erstelle einen Antwortentwurf für diese E-Mail:\n\nBetreff: ${subject}\nVon: ${from?.emailAddress?.address}\n\nInhalt:\n${bodyContent}`,
          },
        ],
        temperature: 0.3,
      });

      let draftReply = draftCompletion.choices[0].message.content || "";

      // Clean up any markdown formatting or classification text
      draftReply = draftReply
        .replace(/\*\*Klassifizierung:\*\*.*?\n/g, "")
        .replace(/\*\*Antwortentwurf:\*\*.*?\n/g, "")
        .replace(/^Betreff:.*?\n/gm, "")
        .trim();

      await createReplyDraft(accessToken, messageId, draftReply);
    }

    console.log(
      `[Webhook] Successfully classified email ${messageId} as ${selectedLabel.name}`
    );
  } catch (error: any) {
    console.error("[Webhook] Error classifying email:", {
      message: error.message,
      stack: error.stack,
    });
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
