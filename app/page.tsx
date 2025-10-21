"use client";

import Image from "next/image";
import AuthButton from "@/components/AuthButton";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirected = searchParams.get("redirected");

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
      </div>
    </div>
  );
}
