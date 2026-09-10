"use client";

import { useEffect, useState } from "react";

interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

let touchStartListenerCount = 0;
const noopTouchStart = () => {};

function registerGlobalTouchFix() {
  if (typeof window === "undefined") return;
  if (touchStartListenerCount === 0) {
    window.addEventListener("touchstart", noopTouchStart, { passive: true });
  }
  touchStartListenerCount++;
}

function unregisterGlobalTouchFix() {
  if (typeof window === "undefined") return;
  touchStartListenerCount--;
  if (touchStartListenerCount <= 0) {
    touchStartListenerCount = 0;
    window.removeEventListener("touchstart", noopTouchStart);
  }
}

export default function TactileButton({
  children,
  variant = "primary",
  onClick,
  className = "",
  style,
  ...props
}: TactileButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isRippling, setIsRippling] = useState(false);

  useEffect(() => {
    registerGlobalTouchFix();
    return () => {
      unregisterGlobalTouchFix();
    };
  }, []);

  const handleTouchStart = () => {
    setIsPressed(true);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    setIsPressed(false);
    setIsRippling(true);
    setTimeout(() => {
      setIsRippling(false);
    }, 250);
  };

  const handleTouchCancel = () => {
    setIsPressed(false);
    setIsRippling(false);
  };

  return (
    <button
      {...props}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => {
        setIsPressed(false);
        setIsRippling(true);
        setTimeout(() => setIsRippling(false), 250);
      }}
      onClick={onClick}
      className={`tapx-tactile-btn ${isPressed ? "is-pressed" : ""} ${isRippling ? "is-rippling" : ""} ${className}`}
      style={{
        position: "relative",
        borderRadius: "14px",
        padding: "13px 22px",
        fontWeight: 700,
        fontSize: "14px",
        cursor: "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease",
        transform: isPressed ? "scale(0.97)" : "scale(1.0)",
        ...style,
      }}
    >
      {children}
      {isRippling && (
        <span
          style={{
            position: "absolute",
            inset: "-4px",
            borderRadius: "18px",
            border: "2px solid currentColor",
            opacity: 0.5,
            animation: "hapticRipple 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
            pointerEvents: "none",
          }}
        />
      )}
    </button>
  );
}
