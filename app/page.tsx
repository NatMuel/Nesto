"use client";

import Image from "next/image";
import AuthButton from "@/components/AuthButton";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function HomeContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirected = searchParams.get("redirected");

  return (
    <>
      {redirected && (
        <div className="info" style={{ marginBottom: "1.5rem" }}>
          Bitte melden Sie sich an, um fortzufahren.
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: "1.5rem" }}>
          Fehler: {errorDescription || error}
        </div>
      )}

      <AuthButton />
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.push("/settings");
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isChecking) {
    return null; // or a loading spinner
  }

  return (
    <div
      className="container"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <div
        className="card"
        style={{ textAlign: "center", maxWidth: "500px", padding: "3rem 2rem" }}
      >
        <div style={{ marginBottom: "2rem" }}>
          <Image
            src="/nesto-logo.png"
            alt="Nesto"
            width={180}
            height={90}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>

        <p
          style={{ fontSize: "1.2rem", color: "#555", marginBottom: "2.5rem" }}
        >
          Automatische E-Mail-Klassifizierung und Antwortentwürfe für Ihre
          Hausverwaltung
        </p>

        <Suspense fallback={<AuthButton />}>
          <HomeContent />
        </Suspense>
      </div>
    </div>
  );
}
