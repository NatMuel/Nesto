import { createClient } from "@supabase/supabase-js";

// Use service role for token refresh operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Refresh Microsoft access token if needed
 * @param userId - The user ID
 * @param accessToken - Current access token
 * @param refreshToken - Refresh token
 * @param tokenExpiry - Token expiry timestamp
 * @returns Fresh access token
 */
export async function refreshAccessTokenIfNeeded(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string
): Promise<string> {
  try {
    const expiryDate = new Date(tokenExpiry);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // If token is still valid for more than 5 minutes, return it
    if (expiryDate > fiveMinutesFromNow) {
      return accessToken;
    }

    console.log(
      `[TokenRefresh] Token expired or expiring soon for user ${userId}, refreshing...`
    );

    // Refresh the token
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          scope: "https://graph.microsoft.com/.default offline_access",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[TokenRefresh] Token refresh failed:", error);
      throw new Error("Failed to refresh token");
    }

    const tokenData = await tokenResponse.json();
    const newAccessToken = tokenData.access_token;
    const newRefreshToken = tokenData.refresh_token || refreshToken;
    const newExpiry = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    // Update tokens in database
    const { error: updateError } = await supabaseAdmin
      .from("user_settings")
      .update({
        microsoft_access_token: newAccessToken,
        microsoft_refresh_token: newRefreshToken,
        microsoft_token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error(
        "[TokenRefresh] Failed to update tokens in database:",
        updateError
      );
    } else {
      console.log(
        "[TokenRefresh] Token refreshed successfully for user",
        userId
      );
    }

    return newAccessToken;
  } catch (error) {
    console.error("[TokenRefresh] Error in token refresh:", error);
    return accessToken; // Return old token as fallback
  }
}
