"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        throw new Error("Please enter both email and password.");
      }

      // 1. Authenticate with Supabase Auth
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr || !data.user) {
        throw new Error(authErr?.message || "Invalid login credentials.");
      }

      // 2. Verify caller is registered in tapx_admin_users
      const { data: adminRow, error: adminErr } = await supabase
        .from("tapx_admin_users")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminErr || !adminRow) {
        // Sign out user immediately if they are not a TAPX admin
        await supabase.auth.signOut();
        throw new Error("Access denied: Your account is not registered as a TAPX Administrator.");
      }

      // 3. Redirect to Admin Dashboard Control Center
      router.push("/");
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError(err?.message || "Unable to sign in as administrator.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
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
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
              letterSpacing: "-0.025em",
            }}
          >
            TAP<span style={{ color: "#60a5fa" }}>X</span>
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#9ca3af",
              marginTop: "6px",
            }}
          >
            System Administrator Access
          </p>
        </div>

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

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#d1d5db",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@tapx.app"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#1f2937",
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
                color: "#d1d5db",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#1f2937",
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
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "background 0.2s",
            }}
          >
            {loading ? "Authenticating Admin..." : "Sign In to Control Center"}
          </button>
        </form>
      </div>
    </main>
  );
}
