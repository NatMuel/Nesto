import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in GET /api/labels:", authError);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: labels, error } = await supabase
      .from("labels")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ labels: labels || [] });
  } catch (error: any) {
    console.error("Error fetching labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch labels", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in POST /api/labels:", authError);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, draft_prompt, color } = body;

    if (!name || !description || !draft_prompt) {
      return NextResponse.json(
        { error: "Name, description, and draft_prompt are required" },
        { status: 400 }
      );
    }

    // Get the current max display_order
    const { data: maxOrderData } = await supabase
      .from("labels")
      .select("display_order")
      .eq("user_id", user.id)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    const { data: label, error } = await supabase
      .from("labels")
      .insert({
        user_id: user.id,
        name,
        description,
        draft_prompt,
        color: color || "preset2",
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ label });
  } catch (error: any) {
    console.error("Error creating label:", error);
    return NextResponse.json(
      { error: "Failed to create label", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in PUT /api/labels:", authError);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, draft_prompt, color, display_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (draft_prompt !== undefined) updateData.draft_prompt = draft_prompt;
    if (color !== undefined) updateData.color = color;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: label, error } = await supabase
      .from("labels")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ label });
  } catch (error: any) {
    console.error("Error updating label:", error);
    return NextResponse.json(
      { error: "Failed to update label", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error in DELETE /api/labels:", authError);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Label ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("labels")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting label:", error);
    return NextResponse.json(
      { error: "Failed to delete label", details: error.message },
      { status: 500 }
    );
  }
}
