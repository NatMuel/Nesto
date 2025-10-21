"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("Client-side callback handler");

        // Check if we have a session (tokens might be in hash)
        const { data, error } = await supabase.auth.getSession();

        console.log("Session check:", { data, error });

        if (error) {
          console.error("Session error:", error);
          router.push(`/?error=${encodeURIComponent(error.message)}`);
          return;
        }

        if (data.session) {
          console.log("Session found, redirecting to settings");
          router.push("/settings");
        } else {
          console.log("No session found");
          router.push("/?error=no_session");
        }
      } catch (err) {
        console.error("Callback error:", err);
        router.push("/?error=callback_failed");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <p>Authentifizierung läuft...</p>
    </div>
  );
}
