import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Initialize default labels and settings for a new user
 * This endpoint is called automatically when a user first accesses the settings page
 */
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

    // Check if user already has labels
    const { data: existingLabels, error: labelsError } = await supabase
      .from("labels")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (labelsError) {
      throw labelsError;
    }

    // If user already has labels, nothing to do
    if (existingLabels && existingLabels.length > 0) {
      return NextResponse.json({
        message: "User already has labels",
        initialized: false,
      });
    }

    // Call the database function to create default labels
    const { error: functionError } = await supabase.rpc(
      "create_default_labels_for_user",
      {
        p_user_id: user.id,
      }
    );

    if (functionError) {
      throw functionError;
    }

    // Verify labels were created
    const { data: newLabels, error: verifyError } = await supabase
      .from("labels")
      .select("id, name")
      .eq("user_id", user.id);

    if (verifyError) {
      throw verifyError;
    }

    return NextResponse.json({
      message: "Default labels created successfully",
      initialized: true,
      labelsCreated: newLabels?.length || 0,
      labels: newLabels,
    });
  } catch (error: any) {
    console.error("Error initializing defaults:", error);
    return NextResponse.json(
      { error: "Failed to initialize defaults", details: error.message },
      { status: 500 }
    );
  }
}
