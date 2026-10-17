import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "UPI Test (Temporary)",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DevUpiTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
