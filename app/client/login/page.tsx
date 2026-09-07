"use client";

import {
  FormEvent,
  useEffect,
  useState,
  CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ClientLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        router.replace("/client");
      } else {
        setLoading(false);
      }
    };

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  const getFriendlyError = (message: string) => {
    const text = message.toLowerCase();

    if (
      text.includes("invalid login credentials") ||
      text.includes("invalid credentials")
    ) {
      return "The email or password is incorrect.";
    }

    if (text.includes("email not confirmed")) {
      return "Please verify your email before signing in.";
    }

    if (text.includes("too many requests")) {
      return "Too many attempts. Please wait a moment and try again.";
    }

    return message || "Unable to sign in. Please try again.";
  };

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoggingIn(true);

    try {
      const { error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (authError) {
        setError(getFriendlyError(authError.message));
        return;
      }

      router.replace("/client");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <main className="login-loading">
        <div className="loading-logo">T</div>
        <div className="loading-spinner" />
        <p>Preparing your TAPX workspace...</p>

        <style jsx>{`
          .login-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f7f8fa;
            color: #18202a;
          }

          .loading-logo {
            width: 52px;
            height: 52px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111820;
            color: white;
            font-size: 24px;
            font-weight: 900;
          }

          .loading-spinner {
            width: 27px;
            height: 27px;
            margin-top: 22px;
            border-radius: 50%;
            border: 3px solid #e4e8eb;
            border-top-color: #111820;
            animation: spin .7s linear infinite;
          }

          p {
            margin-top: 14px;
            color: #89919a;
            font-size: 12px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="showcase-glow" />

        <div className="showcase-brand">
          <div className="brand-logo">T</div>

          <div>
            <div className="brand-name">TAPX</div>
            <div className="brand-subtitle">
              BUSINESS PLATFORM
            </div>
          </div>
        </div>

        <div className="showcase-content">
          <div className="eyebrow">
            <span />
            BUSINESS CONTROL CENTER
          </div>

          <h1>
            Your business.
            <br />
            Your customers.
            <br />
            <em>One workspace.</em>
          </h1>

          <p>
            Manage your TAPX customer experience,
            orders, digital services, offers and
            business performance from one place.
          </p>

          <div className="feature-grid">
            <Feature
              icon="▣"
              title="Live Orders"
              text="See and manage customer orders."
            />

            <Feature
              icon="✦"
              title="Digital Experience"
              text="Keep your customer touchpoint active."
            />

            <Feature
              icon="↗"
              title="Business Insights"
              text="Understand customer activity."
            />

            <Feature
              icon="♡"
              title="Customer Growth"
              text="Build repeat customer relationships."
            />
          </div>
        </div>

        <div className="showcase-footer">
          <span>© {new Date().getFullYear()} TAPX</span>
          <span>
            Smart digital touchpoints for modern businesses.
          </span>
        </div>
      </section>

      <section className="login-form-side">
        <div className="mobile-brand">
          <div className="mobile-logo">T</div>
          <strong>TAPX</strong>
        </div>

        <div className="login-card">
          <div className="secure-badge">
            <span>✓</span>
            Secure Business Portal
          </div>

          <h2>Welcome back</h2>

          <p className="login-description">
            Sign in to manage your TAPX business
            workspace.
          </p>

          <form onSubmit={handleLogin}>
            <label>Business email</label>

            <div className="input-box">
              <span className="input-icon">@</span>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@business.com"
                autoComplete="email"
                disabled={loggingIn}
              />
            </div>

            <label>Password</label>

            <div className="input-box">
              <span className="input-icon">●</span>

              <input
                type={
                  showPassword ? "text" : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loggingIn}
              />

              <button
                type="button"
                className="show-password"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="form-options">
              <span>
                Secure client access
              </span>

              <button
                type="button"
                onClick={() =>
                  setError(
                    "Please contact your TAPX administrator to reset your password."
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="error-message">
                <span>!</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loggingIn}
            >
              {loggingIn ? (
                <>
                  <span className="button-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Enter workspace
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="security-card">
            <div className="security-icon">✓</div>

            <div>
              <strong>Your workspace is protected</strong>
              <p>
                Your account only provides access to
                the TAPX business connected to your
                login.
              </p>
            </div>
          </div>
        </div>

        <div className="login-footer">
          Need help? Contact your TAPX administrator.
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.08fr .92fr;
          background: white;
          color: #18202a;
        }

        .login-showcase {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          padding: 42px 7vw 32px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background:
            radial-gradient(
              circle at 85% 12%,
              #293646 0,
              transparent 28%
            ),
            linear-gradient(
              145deg,
              #0f151c,
              #19222c 55%,
              #0d1218
            );
          color: white;
        }

        .showcase-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(
              circle at 20% 80%,
              rgba(255,255,255,.035),
              transparent 25%
            );
        }

        .showcase-brand,
        .showcase-content,
        .showcase-footer {
          position: relative;
          z-index: 1;
        }

        .showcase-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: white;
          color: #111820;
          font-size: 22px;
          font-weight: 900;
        }

        .brand-name {
          font-size: 19px;
          font-weight: 850;
          letter-spacing: 2px;
        }

        .brand-subtitle {
          margin-top: 3px;
          color: rgba(255,255,255,.4);
          font-size: 8px;
          letter-spacing: 2.2px;
        }

        .showcase-content {
          max-width: 700px;
          margin: 60px 0;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 25px;
          color: rgba(255,255,255,.52);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.8px;
        }

        .eyebrow span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6ddd9b;
          box-shadow:
            0 0 0 5px rgba(109,221,155,.08);
        }

        .showcase-content h1 {
          margin: 0;
          font-size: clamp(42px, 5vw, 72px);
          line-height: 1.02;
          letter-spacing: -3px;
          font-weight: 850;
        }

        .showcase-content h1 em {
          color: rgba(255,255,255,.42);
          font-style: normal;
        }

        .showcase-content > p {
          max-width: 590px;
          margin: 27px 0 0;
          color: rgba(255,255,255,.58);
          font-size: 15px;
          line-height: 1.75;
        }

        .feature-grid {
          max-width: 610px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 11px;
          margin-top: 38px;
        }

        .feature-card {
          display: flex;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 13px;
          background: rgba(255,255,255,.045);
        }

        .feature-icon {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: rgba(255,255,255,.08);
          font-size: 13px;
        }

        .feature-title {
          font-size: 12px;
          font-weight: 750;
        }

        .feature-text {
          margin-top: 3px;
          color: rgba(255,255,255,.4);
          font-size: 9px;
          line-height: 1.5;
        }

        .showcase-footer {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          color: rgba(255,255,255,.28);
          font-size: 9px;
        }

        .login-form-side {
          min-height: 100vh;
          padding: 35px 7vw 25px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #fff;
        }

        .login-card {
          width: 100%;
          max-width: 470px;
          margin: auto;
        }

        .secure-badge {
          width: fit-content;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border-radius: 100px;
          background: #f1f7f3;
          color: #52735e;
          font-size: 10px;
          font-weight: 750;
        }

        .login-card h2 {
          margin: 23px 0 7px;
          font-size: 39px;
          line-height: 1.1;
          letter-spacing: -1.6px;
        }

        .login-description {
          margin: 0;
          color: #7f8892;
          font-size: 13px;
          line-height: 1.6;
        }

        form {
          margin-top: 32px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #303945;
          font-size: 11px;
          font-weight: 750;
        }

        .input-box {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 19px;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          color: #9da5ae;
          font-size: 12px;
          z-index: 1;
        }

        input {
          width: 100%;
          height: 52px;
          padding: 0 50px 0 40px;
          border: 1px solid #e0e4e8;
          border-radius: 12px;
          outline: none;
          background: white;
          color: #17202a;
          font-size: 13px;
          transition: .2s;
        }

        input:focus {
          border-color: #9da6b0;
          box-shadow: 0 0 0 3px rgba(17,24,39,.04);
        }

        input::placeholder {
          color: #b0b6bd;
        }

        .show-password {
          position: absolute;
          right: 11px;
          border: 0;
          background: transparent;
          color: #727c87;
          font-size: 10px;
          font-weight: 700;
        }

        .form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 1px 0 19px;
          color: #929aa3;
          font-size: 10px;
        }

        .form-options button {
          border: 0;
          background: transparent;
          color: #38424d;
          font-size: 10px;
          font-weight: 700;
        }

        .error-message {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          padding: 11px 12px;
          margin-bottom: 14px;
          border-radius: 10px;
          background: #fff2f1;
          color: #a3413b;
          font-size: 11px;
          line-height: 1.5;
        }

        .login-button {
          width: 100%;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 0;
          border-radius: 13px;
          background: #111820;
          color: white;
          font-size: 13px;
          font-weight: 750;
          box-shadow: 0 12px 28px rgba(17,24,32,.13);
          transition: .2s;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #1a222c;
        }

        .login-button:disabled {
          cursor: not-allowed;
          opacity: .7;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }

        .security-card {
          display: flex;
          gap: 11px;
          margin-top: 23px;
          padding: 13px;
          border-radius: 12px;
          background: #f7f8f9;
        }

        .security-icon {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #e9f3ec;
          color: #52735e;
          font-size: 11px;
          font-weight: 800;
        }

        .security-card strong {
          font-size: 10px;
        }

        .security-card p {
          margin: 3px 0 0;
          color: #8b949d;
          font-size: 9px;
          line-height: 1.5;
        }

        .login-footer {
          text-align: center;
          color: #a2a9b0;
          font-size: 9px;
        }

        .mobile-brand {
          display: none;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .login-page {
            grid-template-columns: 1fr;
          }

          .login-showcase {
            display: none;
          }

          .login-form-side {
            padding: 25px;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 20px;
          }

          .mobile-logo {
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: #111820;
            color: white;
            font-weight: 900;
          }

          .mobile-brand strong {
            letter-spacing: 1.5px;
          }
        }

        @media (max-width: 500px) {
          .login-form-side {
            padding: 20px;
          }

          .login-card h2 {
            font-size: 33px;
          }
        }
      `}</style>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>

      <div>
        <div className="feature-title">{title}</div>
        <div className="feature-text">{text}</div>
      </div>

      <style jsx>{`
        .feature-card {
          display: flex;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 13px;
          background: rgba(255,255,255,.045);
        }

        .feature-icon {
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: rgba(255,255,255,.08);
          font-size: 13px;
        }

        .feature-title {
          font-size: 12px;
          font-weight: 750;
        }

        .feature-text {
          margin-top: 3px;
          color: rgba(255,255,255,.4);
          font-size: 9px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}