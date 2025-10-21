import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Get user from Supabase (for prompt)
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let classificationPrompt =
      "Du bist Assistenz einer Hausverwaltung. Klassifiziere neue E-Mails als Needs reply / Waiting / FYI. Falls Needs reply, verfasse einen höflichen kurzen Antwortentwurf auf Deutsch im 'Sie'-Ton mit fehlenden Infos und nächsten Schritten.";

    if (session) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("classification_prompt")
        .eq("user_id", session.user.id)
        .single();

      if (settings?.classification_prompt) {
        classificationPrompt = settings.classification_prompt;
      }
    }

    // Classify with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${classificationPrompt}\n\nAntworte im JSON-Format mit: {"category": "Needs reply" oder "Waiting" oder "FYI", "draft": "Antwortentwurf falls Needs reply"}`,
        },
        {
          role: "user",
          content: `Betreff: ${subject}\nVon: ${from}\n\nInhalt:\n${bodyContent}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const category = mapCategory(result.classification || result.category);
    const needsReply = category === "To respond";
    const draftReply = result.draft || result.reply;

    // Ensure category exists in Outlook
    await ensureCategoryExists(microsoftAccessToken, category);

    // Apply category
    await applyCategory(microsoftAccessToken, messageId, category);

    // Create draft if needed
    let draftCreated = false;
    if (needsReply && draftReply) {
      await createReplyDraft(microsoftAccessToken, messageId, draftReply);
      draftCreated = true;
    }

    return NextResponse.json({
      success: true,
      category,
      needsReply,
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

function mapCategory(classification: string): string {
  const lower = classification.toLowerCase();
  if (lower.includes("needs reply") || lower.includes("respond")) {
    return "To respond";
  }
  if (lower.includes("waiting")) {
    return "Waiting";
  }
  return "FYI";
}

async function ensureCategoryExists(
  accessToken: string,
  categoryName: string
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
      const colorMap: Record<string, string> = {
        "To respond": "preset0",
        Waiting: "preset4",
        FYI: "preset2",
      };

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
            color: colorMap[categoryName] || "preset2",
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
  await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/createReply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: replyText,
      }),
    }
  );
}
