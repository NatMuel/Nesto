import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Create or renew subscription
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get fresh access token from current session
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.provider_token;
    const refreshToken = sessionData.session?.provider_refresh_token;

    console.log("[Subscription] Token check:", {
      hasSession: !!sessionData.session,
      hasToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      tokenLength: accessToken?.length,
      userId: user.id,
    });

    if (!accessToken) {
      console.error("[Subscription] No access token found in session");
      return NextResponse.json(
        {
          error:
            "Microsoft access token not found in session. Please log out and log back in.",
        },
        { status: 400 }
      );
    }

    // Get user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Check if subscription already exists and is valid
    if (
      settings.subscription_id &&
      settings.subscription_expiry &&
      new Date(settings.subscription_expiry) > new Date()
    ) {
      return NextResponse.json({
        subscription_id: settings.subscription_id,
        expiry: settings.subscription_expiry,
        status: "active",
      });
    }

    // Create new subscription
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      ""
    ).replace(/\/$/, ""); // Remove trailing slash if present
    const webhookUrl = `${baseUrl}/api/webhooks/outlook`;

    console.log("[Subscription] Creating subscription:", {
      webhookUrl,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      origin: request.headers.get("origin"),
    });

    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + 72); // Max 3 days for mail

    const subscriptionPayload = {
      changeType: "created",
      notificationUrl: webhookUrl,
      resource: "/me/mailFolders('Inbox')/messages",
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: `nesto_${user.id}`, // Security validation
    };

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscriptionPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }
      console.error("[Subscription] Failed to create subscription:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return NextResponse.json(
        { error: "Failed to create subscription", details: errorData },
        { status: response.status }
      );
    }

    const subscription = await response.json();
    console.log("[Subscription] Created successfully:", {
      id: subscription.id,
      expiry: subscription.expirationDateTime,
    });

    // Save subscription info to database along with current access token
    const { error: updateError } = await supabase
      .from("user_settings")
      .update({
        subscription_id: subscription.id,
        subscription_expiry: subscription.expirationDateTime,
        microsoft_access_token: accessToken, // Save current token for webhook use
        microsoft_refresh_token: refreshToken, // Save refresh token for token renewal
        microsoft_token_expiry: new Date(
          Date.now() + 3600 * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[Subscription] Failed to save to database:", updateError);
    } else {
      console.log("[Subscription] Saved to database for user:", user.id);
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      expiry: subscription.expirationDateTime,
      status: "created",
    });
  } catch (error: any) {
    console.error("[Subscription] Creation error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { error: "Failed to create subscription", details: error.message },
      { status: 500 }
    );
  }
}

// Delete subscription
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get fresh access token from current session
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.provider_token;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!settings || !settings.subscription_id) {
      return NextResponse.json({
        success: true,
        message: "No active subscription",
      });
    }

    // Delete subscription from Microsoft Graph
    if (accessToken) {
      try {
        const response = await fetch(
          `https://graph.microsoft.com/v1.0/subscriptions/${settings.subscription_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // 204 = success, 404 = already deleted/expired
        if (!response.ok && response.status !== 404) {
          console.error("Failed to delete subscription from Graph API");
        }
      } catch (error) {
        console.error("Error deleting subscription:", error);
      }
    }

    // Clear subscription from database
    await supabase
      .from("user_settings")
      .update({
        subscription_id: null,
        subscription_expiry: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: "Subscription deleted",
    });
  } catch (error: any) {
    console.error("Subscription deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription", details: error.message },
      { status: 500 }
    );
  }
}

// Get subscription status
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("subscription_id, subscription_expiry")
      .eq("user_id", user.id)
      .single();

    if (!settings || !settings.subscription_id) {
      return NextResponse.json({
        active: false,
        subscription_id: null,
        expiry: null,
      });
    }

    const isActive =
      settings.subscription_expiry &&
      new Date(settings.subscription_expiry) > new Date();

    return NextResponse.json({
      active: isActive,
      subscription_id: settings.subscription_id,
      expiry: settings.subscription_expiry,
    });
  } catch (error: any) {
    console.error("Subscription status error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription status", details: error.message },
      { status: 500 }
    );
  }
}
