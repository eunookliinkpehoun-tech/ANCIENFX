type FxMirrorLogoProps = {
  className?: string
  title?: string
}

export function FxMirrorLogo({ className = "", title = "FXMIRROR" }: FxMirrorLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 760 160"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M670 24v112" stroke="var(--fx-logo-accent, #2563eb)" strokeWidth="8" />
        <rect
          x="644"
          y="48"
          width="52"
          height="58"
          rx="4"
          fill="var(--fx-logo-accent, #2563eb)"
        />
        <path d="M730 42v88" stroke="var(--fx-logo-text, #0a1730)" strokeWidth="8" />
        <rect
          x="706"
          y="64"
          width="48"
          height="42"
          rx="4"
          fill="var(--fx-logo-text, #0a1730)"
        />
        <path
          d="M644 48h52M706 106h48"
          fill="none"
          stroke="rgba(255,255,255,0.34)"
          strokeWidth="4"
        />
      </g>
      <text
        x="0"
        y="106"
        fill="var(--fx-logo-accent, #2563eb)"
        fontFamily="Inter, Arial Black, Arial, sans-serif"
        fontSize="102"
        fontWeight="900"
        letterSpacing="-3"
      >
        FX
      </text>
      <text
        x="176"
        y="106"
        fill="var(--fx-logo-text, #0a1730)"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="92"
        fontWeight="700"
        letterSpacing="-1"
      >
        MIRROR
      </text>
    </svg>
  )
}
