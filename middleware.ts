import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session
  await supabase.auth.getSession();

  // Always allow through - let the page handle auth checks client-side
  return res;
}

export const config = {
  matcher: ["/settings/:path*", "/auth/callback"],
};
