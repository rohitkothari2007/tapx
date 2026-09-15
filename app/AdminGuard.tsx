"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // DEFAULT-DENY ROUTE PROTECTION:
  // Every route is protected as an Admin Route by default.
  // ONLY explicitly declared public/client paths are exempt.
  const isExemptRoute =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname.startsWith("/devices") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/tap") ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/t") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    pathname === "/favicon.ico";

  useEffect(() => {
    if (isExemptRoute) {
      setChecking(false);
      return;
    }

    verifyAdminSession();
  }, [pathname, isExemptRoute]);

  async function verifyAdminSession() {
    setChecking(true);
    try {
      // 1. Check active user session
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/admin/login");
        return;
      }

      // 2. Check tapx_admin_users membership (Strict default-deny)
      const { data: adminRow, error: adminError } = await supabase
        .from("tapx_admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminRow) {
        // Log out unauthorized user and redirect to admin login
        await supabase.auth.signOut();
        router.push("/admin/login");
        return;
      }

      setIsAdmin(true);
    } catch (err) {
      console.error("AdminGuard verification error:", err);
      router.push("/admin/login");
    } finally {
      setChecking(false);
    }
  }

  if (isExemptRoute) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b1220",
          color: "#9ca3af",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>⚡</div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff" }}>
          Verifying TAPX Admin Access
        </div>
        <div style={{ fontSize: "13px", marginTop: "6px" }}>
          Validating administrator security credentials...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
