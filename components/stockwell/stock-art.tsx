import { useId } from "react";

/** Lightweight vector artwork; silver stock forms echo the supplied reference. */
export function StockArt({ compact = false }: { compact?: boolean }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      className={compact ? "stock-art compact" : "stock-art"}
      viewBox="0 0 360 300"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-top`}
          x1="70"
          y1="40"
          x2="290"
          y2="130"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e8e9ee" />
          <stop offset=".52" stopColor="#b7b9c5" />
          <stop offset="1" stopColor="#f5f5f8" />
        </linearGradient>
        <linearGradient
          id={`${id}-side`}
          x1="220"
          y1="60"
          x2="300"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7d7e8e" />
          <stop offset=".48" stopColor="#d1d2dc" />
          <stop offset="1" stopColor="#8b8c9f" />
        </linearGradient>
        <linearGradient
          id={`${id}-front`}
          x1="80"
          y1="120"
          x2="220"
          y2="260"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#c9cad6" />
          <stop offset=".4" stopColor="#b7b8c6" />
          <stop offset=".56" stopColor="#dedfe8" />
          <stop offset="1" stopColor="#9699ac" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#6c6a80" stopOpacity=".38" />
          <stop offset="1" stopColor="#6c6a80" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="180" cy="262" rx="154" ry="33" fill={`url(#${id}-shadow)`} />
      <g stroke="#ececf5" strokeWidth=".7">
        <path d="m49 174 130-65 132 70-130 67z" fill={`url(#${id}-top)`} />
        <path d="m49 174 132 72v38L49 212z" fill={`url(#${id}-front)`} />
        <path d="m181 246 130-67v38l-130 67z" fill={`url(#${id}-side)`} />
        <path d="m61 113 130-65 132 70-130 67z" fill={`url(#${id}-top)`} />
        <path d="m61 113 132 72v45L61 158z" fill={`url(#${id}-front)`} />
        <path d="m193 185 130-67v45l-130 67z" fill={`url(#${id}-side)`} />
        <path d="m43 54 130-45 132 70-130 47z" fill={`url(#${id}-top)`} />
        <path d="m43 54 132 72v42L43 96z" fill={`url(#${id}-front)`} />
        <path d="m175 126 130-47v42l-130 47z" fill={`url(#${id}-side)`} />
      </g>
      <g stroke="#8f91a4" strokeWidth="1" opacity=".5">
        <path d="m54 192 118 64M67 130l118 64M49 73l118 63" />
      </g>
    </svg>
  );
}
