"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function AuthButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    try {
      console.log("Starting OAuth flow...");
      console.log("Window origin:", window.location.origin);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes:
            "Mail.ReadWrite MailboxSettings.ReadWrite User.Read offline_access email openid profile",
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      console.log("OAuth response:", { data, error });

      if (error) {
        console.error("OAuth error:", error);
        throw error;
      }

      if (data?.url) {
        console.log("Should redirect to:", data.url);
      } else {
        console.error("No redirect URL returned from Supabase");
      }
    } catch (error) {
      console.error("Error signing in:", error);
      alert("Login failed: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleMicrosoftLogin}
      disabled={isLoading}
      className="button"
      style={{
        fontSize: "1.1rem",
        padding: "0.9rem 2.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        margin: "0 auto",
      }}
    >
      <Image
        src="/outlook-logo.png"
        alt="Outlook"
        width={24}
        height={24}
        style={{ objectFit: "contain" }}
      />
      {isLoading ? "Wird geladen..." : "Mit Outlook anmelden"}
    </button>
  );
}
