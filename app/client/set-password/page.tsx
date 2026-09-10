"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if session token exists in URL hash or session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Listening for auth state change in case hash is processed asynchronously
      }
    });
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => {
        router.push("/client");
      }, 2000);
    } catch (err: any) {
      console.error("Error setting password:", err);
      setError(err?.message || "Failed to update password. Link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
            }}
          >
            TAP<span style={{ color: "#38bdf8" }}>X</span> Client Portal
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#94a3b8",
              marginTop: "8px",
            }}
          >
            Set your account password to access your dashboard
          </p>
        </div>

        {success ? (
          <div
            style={{
              background: "#064e3b",
              border: "1px solid #047857",
              color: "#a7f3d0",
              padding: "16px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>✓</div>
            <div style={{ fontWeight: 700 }}>Password Set Successfully!</div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              Redirecting to your client dashboard...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSetPassword}>
            {error && (
              <div
                style={{
                  background: "#7f1d1d",
                  border: "1px solid #991b1b",
                  color: "#fecaca",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "20px",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "#0284c7",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Saving Password..." : "Set Password & Access Portal"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
