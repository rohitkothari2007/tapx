import React from "react";

export function InstagramIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="tapx-ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#tapx-ig-gradient)" />
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="4.2"
        stroke="#ffffff"
        strokeWidth="1.6"
        fill="none"
      />
      <circle cx="12" cy="12" r="3.7" stroke="#ffffff" strokeWidth="1.6" fill="none" />
      <circle cx="16.5" cy="7.5" r="1.1" fill="#ffffff" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <rect width="24" height="24" rx="12" fill="#25D366" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.2C7.7 4.2 4.2 7.7 4.2 12c0 1.45.39 2.8 1.07 3.97L4.5 19.5l3.65-.77C9.28 19.35 10.61 19.8 12 19.8c4.3 0 7.8-3.5 7.8-7.8S16.3 4.2 12 4.2zm4.2 10.95c-.18.5-.9 1.01-1.46 1.06-.38.03-.87.05-2.54-.64-2.02-.83-3.32-2.9-3.42-3.03-.1-.13-.81-1.08-.81-2.05s.51-1.46.69-1.66c.18-.2.4-.24.53-.24.14 0 .27 0 .38.01.12.01.29-.05.45.35.18.43.6 1.47.66 1.58.05.11.09.23.02.38-.07.14-.11.23-.22.36-.11.13-.23.28-.32.38-.11.11-.22.23-.09.45.13.23.56.92 1.2 1.49.82.73 1.51.96 1.74 1.06.23.11.35.09.48-.05.13-.14.54-.63.68-.85.14-.22.29-.18.48-.11.19.07 1.21.57 1.41.67.21.11.34.16.4.25.05.09.05.52-.13 1.03z"
        fill="#ffffff"
      />
    </svg>
  );
}
