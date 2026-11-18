import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "TAPX Staff",
    short_name: "TAPX Staff",
    start_url: "/staff",
    scope: "/staff",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f97316",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  });
}
