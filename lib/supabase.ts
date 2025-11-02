import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Create a singleton instance for client components
let supabaseInstance: any = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClientComponentClient();
  }
  return supabaseInstance;
};

// For backward compatibility
export const supabase = getSupabase();
