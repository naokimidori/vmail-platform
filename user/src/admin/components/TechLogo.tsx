import { useId } from "react";

import { cn } from "../lib/utils";

export function TechLogo({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gradientId = `${id}-logo-gradient`;
  const glowId = `${id}-logo-glow`;

  return (
    <svg
      role="img"
      aria-label="V-Mail technology logo"
      className={cn("h-11 w-11 flex-none", className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="13" y1="10" x2="52" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B6FB83" />
          <stop offset="0.48" stopColor="#5DE1D6" />
          <stop offset="1" stopColor="#123F34" />
        </linearGradient>
        <filter id={glowId} x="2" y="2" width="60" height="60" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.36 0 0 0 0 0.88 0 0 0 0 0.78 0 0 0 0.55 0"
          />
          <feBlend in="SourceGraphic" />
        </filter>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#123F34" />
      <path
        d="M14 21.5C14 18.46 16.46 16 19.5 16h25c3.04 0 5.5 2.46 5.5 5.5v23c0 3.04-2.46 5.5-5.5 5.5h-25A5.5 5.5 0 0 1 14 44.5v-23Z"
        fill="#F8FFF3"
        fillOpacity="0.08"
      />
      <g filter={`url(#${glowId})`}>
        <path d="M16 20h32L32 34 16 20Z" fill={`url(#${gradientId})`} />
        <path
          d="M16 22.5 28.2 36a5.1 5.1 0 0 0 7.6 0L48 22.5V45H16V22.5Z"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M20 47h24" stroke="#B6FB83" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <path d="M22 12v6M32 10v8M42 12v6" stroke="#B6FB83" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="12" r="2" fill="#5DE1D6" />
      <circle cx="32" cy="10" r="2" fill="#B6FB83" />
      <circle cx="42" cy="12" r="2" fill="#5DE1D6" />
    </svg>
  );
}
