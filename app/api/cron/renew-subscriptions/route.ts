import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshAccessTokenIfNeeded } from "@/lib/tokenRefresh";

// Use service role for cron jobs (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting subscription renewal check...");

    // Find subscriptions that expire within the next 48 hours
    // (Hobby plan: cron runs once per day, so we need more buffer time)
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() + 48);

    const { data: expiringSubscriptions, error: fetchError } =
      await supabaseAdmin
        .from("user_settings")
        .select("*")
        .not("subscription_id", "is", null)
        .not("microsoft_access_token", "is", null)
        .lt("subscription_expiry", expiryThreshold.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      console.log("No subscriptions need renewal");
      return NextResponse.json({
        success: true,
        message: "No subscriptions need renewal",
        renewed: 0,
      });
    }

    console.log(`Found ${expiringSubscriptions.length} subscriptions to renew`);

    let renewedCount = 0;
    let failedCount = 0;

    // Renew each subscription
    for (const settings of expiringSubscriptions) {
      try {
        // Refresh access token if needed
        const accessToken = await refreshAccessTokenIfNeeded(
          settings.user_id,
          settings.microsoft_access_token,
          settings.microsoft_refresh_token,
          settings.microsoft_token_expiry
        );

        // Extend the subscription by updating expiration time
        const newExpirationDateTime = new Date();
        newExpirationDateTime.setHours(newExpirationDateTime.getHours() + 72);

        const renewResponse = await fetch(
          `https://graph.microsoft.com/v1.0/subscriptions/${settings.subscription_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              expirationDateTime: newExpirationDateTime.toISOString(),
            }),
          }
        );

        if (!renewResponse.ok) {
          const error = await renewResponse.json();
          console.error(
            `Failed to renew subscription ${settings.subscription_id}:`,
            error
          );

          // If token expired or subscription invalid, try to create a new one
          if (renewResponse.status === 401 || renewResponse.status === 404) {
            await createNewSubscription(settings);
            renewedCount++;
          } else {
            failedCount++;
          }
          continue;
        }

        const renewedSubscription = await renewResponse.json();

        // Update database with new expiry
        await supabaseAdmin
          .from("user_settings")
          .update({
            subscription_expiry: renewedSubscription.expirationDateTime,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", settings.user_id);

        console.log(
          `Successfully renewed subscription for user ${settings.user_id}`
        );
        renewedCount++;
      } catch (error) {
        console.error(
          `Error renewing subscription for user ${settings.user_id}:`,
          error
        );
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Renewed ${renewedCount} subscriptions, ${failedCount} failed`,
      renewed: renewedCount,
      failed: failedCount,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Renewal check failed", details: error.message },
      { status: 500 }
    );
  }
}

async function createNewSubscription(settings: any) {
  try {
    // Refresh access token if needed
    const accessToken = await refreshAccessTokenIfNeeded(
      settings.user_id,
      settings.microsoft_access_token,
      settings.microsoft_refresh_token,
      settings.microsoft_token_expiry
    );

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`;

    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + 72);

    const subscriptionPayload = {
      changeType: "created",
      notificationUrl: webhookUrl,
      resource: "/me/mailFolders('Inbox')/messages",
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: `nesto_${settings.user_id}`,
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
      throw new Error("Failed to create new subscription");
    }

    const newSubscription = await response.json();

    // Update database with new subscription
    await supabaseAdmin
      .from("user_settings")
      .update({
        subscription_id: newSubscription.id,
        subscription_expiry: newSubscription.expirationDateTime,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", settings.user_id);

    console.log(
      `Created new subscription for user ${settings.user_id} after old one expired`
    );
  } catch (error) {
    console.error(`Failed to create new subscription:`, error);
    throw error;
  }
}
