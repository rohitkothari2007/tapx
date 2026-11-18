"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function StaffLoginPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkExistingAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.user) {
          const email = session.user.email || "";
          if (email.includes("@staff.tapx.example.com")) {
            // Already logged in as staff -> check if context is valid
            const { data, error } = await supabase.rpc("staff_get_context");
            if (!active) return;
            if (!error && data?.staff?.id) {
              router.replace("/staff/app");
              return;
            }
          } else {
            // Logged in as regular owner/client user
            setIsOwnerLoggedIn(true);
            setCheckingAuth(false);
            return;
          }
        }
      } catch {
        // Ignore session read error
      }

      if (active) {
        // Load saved phone if any
        if (typeof window !== "undefined") {
          const savedPhone = localStorage.getItem("tapx_staff_phone");
          if (savedPhone) setPhone(savedPhone);
        }
        setCheckingAuth(false);
      }
    }

    checkExistingAuth();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleOwnerSignOut() {
    setSubmitting(true);
    await supabase.auth.signOut();
    setIsOwnerLoggedIn(false);
    setSubmitting(false);
  }

  function handleKeypadPress(digit: string) {
    if (submitting) return;
    setErrorMsg("");
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 6 && phone.replace(/\D/g, "").length >= 10) {
        // Auto-submit when 6 digits are reached
        executeLogin(phone, nextPin);
      }
    }
  }

  function handleBackspace() {
    if (submitting) return;
    setErrorMsg("");
    setPin((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (submitting) return;
    setErrorMsg("");
    setPin("");
  }

  async function executeLogin(rawPhone: string, rawPin: string) {
    const cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number");
      return;
    }
    if (rawPin.length !== 6) {
      setErrorMsg("Please enter your 6-digit PIN");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, pin: rawPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Wrong mobile number or PIN");
        setPin("");
        setSubmitting(false);
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("tapx_staff_phone", cleanPhone);
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        setErrorMsg("Failed to start session. Please try again.");
        setPin("");
        setSubmitting(false);
        return;
      }

      router.replace("/staff/app");
    } catch {
      setErrorMsg("Connection error. Please check your network.");
      setPin("");
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fffaf3",
          color: "#78716c",
          fontSize: 15,
        }}
      >
        Checking login...
      </div>
    );
  }

  if (isOwnerLoggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#fffaf3",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "100%",
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
            border: "1px solid #fed7aa",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "#ffedd5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 26,
            }}
          >
            👤
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1c1410", marginBottom: 8 }}>
            Owner account active
          </h2>
          <p style={{ fontSize: 14, color: "#78716c", lineHeight: 1.5, marginBottom: 24 }}>
            You are logged in as an owner. Sign out to use staff login.
          </p>
          <button
            onClick={handleOwnerSignOut}
            disabled={submitting}
            style={{
              width: "100%",
              minHeight: 46,
              backgroundColor: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Signing out..." : "Sign out"}
          </button>
          <div style={{ marginTop: 16 }}>
            <a
              href="/client"
              style={{ fontSize: 13, color: "#ea580c", textDecoration: "none", fontWeight: 500 }}
            >
              Go to Owner Dashboard →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        maxWidth: 420,
        margin: "0 auto",
        padding: "24px 20px 28px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Header & Mobile Input */}
      <div>
        <div style={{ textAlign: "center", marginBottom: 24, marginTop: 12 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              backgroundColor: "#f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              color: "#fff",
              fontWeight: 800,
              fontSize: 22,
              boxShadow: "0 8px 18px rgba(249, 115, 22, 0.3)",
            }}
          >
            🍽️
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1c1410", margin: 0 }}>
            Staff login
          </h1>
          <p style={{ fontSize: 13, color: "#78716c", marginTop: 4, marginBottom: 0 }}>
            Enter your mobile number and 6-digit PIN
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 13,
              marginBottom: 16,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Mobile Input */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="staff-phone"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#57534e",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Mobile Number
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#fff",
              border: "1.5px solid #e7e5e4",
              borderRadius: 12,
              overflow: "hidden",
              height: 48,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <span
              style={{
                padding: "0 12px",
                fontSize: 15,
                fontWeight: 600,
                color: "#78716c",
                backgroundColor: "#f5f5f4",
                height: "100%",
                display: "flex",
                alignItems: "center",
                borderRight: "1px solid #e7e5e4",
              }}
            >
              +91
            </span>
            <input
              id="staff-phone"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(val);
                setErrorMsg("");
              }}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                padding: "0 14px",
                fontSize: 16,
                fontWeight: 600,
                color: "#1c1410",
                backgroundColor: "transparent",
              }}
            />
          </div>
        </div>

        {/* PIN boxes */}
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#57534e",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            6-Digit PIN
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = pin.length > idx;
              const isCurrent = pin.length === idx;
              return (
                <div
                  key={idx}
                  style={{
                    width: 44,
                    height: 50,
                    borderRadius: 12,
                    border: isCurrent
                      ? "2px solid #f97316"
                      : isFilled
                      ? "1.5px solid #ea580c"
                      : "1.5px solid #d6d3d1",
                    backgroundColor: isFilled ? "#fff7ed" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#ea580c",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isFilled ? "●" : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* On-screen Numeric Keypad */}
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleKeypadPress(d)}
              disabled={submitting}
              style={{
                minHeight: 52,
                borderRadius: 14,
                border: "1px solid #e7e5e4",
                backgroundColor: "#fff",
                fontSize: 22,
                fontWeight: 600,
                color: "#1c1410",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
                touchAction: "manipulation",
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting}
            style={{
              minHeight: 52,
              borderRadius: 14,
              border: "1px solid #e7e5e4",
              backgroundColor: "#f5f5f4",
              fontSize: 14,
              fontWeight: 600,
              color: "#78716c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress("0")}
            disabled={submitting}
            style={{
              minHeight: 52,
              borderRadius: 14,
              border: "1px solid #e7e5e4",
              backgroundColor: "#fff",
              fontSize: 22,
              fontWeight: 600,
              color: "#1c1410",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
              touchAction: "manipulation",
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={submitting}
            style={{
              minHeight: 52,
              borderRadius: 14,
              border: "1px solid #e7e5e4",
              backgroundColor: "#f5f5f4",
              fontSize: 18,
              fontWeight: 600,
              color: "#78716c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            ⌫
          </button>
        </div>

        {/* Manual Submit Button if user preferred */}
        <button
          type="button"
          onClick={() => executeLogin(phone, pin)}
          disabled={submitting || phone.replace(/\D/g, "").length < 10 || pin.length !== 6}
          style={{
            width: "100%",
            minHeight: 48,
            borderRadius: 14,
            border: "none",
            backgroundColor: "#f97316",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor:
              submitting || phone.replace(/\D/g, "").length < 10 || pin.length !== 6
                ? "not-allowed"
                : "pointer",
            opacity:
              submitting || phone.replace(/\D/g, "").length < 10 || pin.length !== 6 ? 0.6 : 1,
            boxShadow: "0 4px 12px rgba(249, 115, 22, 0.25)",
            touchAction: "manipulation",
          }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  );
}
