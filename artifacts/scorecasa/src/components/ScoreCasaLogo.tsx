interface ScoreCasaIconProps {
  size?: number;
  className?: string;
}

export function ScoreCasaIcon({ size = 36, className }: ScoreCasaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="sc-icon-bg" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D1B8C" />
          <stop offset="100%" stopColor="#07113A" />
        </linearGradient>
        <clipPath id="sc-icon-clip">
          <rect width="200" height="200" rx="40" />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width="200" height="200" rx="40" fill="url(#sc-icon-bg)" />

      {/* Green wave at the bottom */}
      <path
        d="M0 148 Q50 132 100 148 Q150 164 200 148 L200 200 L0 200 Z"
        fill="#10A65A"
        opacity="0.3"
        clipPath="url(#sc-icon-clip)"
      />
      <path
        d="M0 162 Q50 150 100 162 Q150 174 200 162 L200 200 L0 200 Z"
        fill="#10A65A"
        opacity="0.45"
        clipPath="url(#sc-icon-clip)"
      />

      {/* Bold white S — Poppins-like, centered */}
      <text
        x="106"
        y="148"
        fontFamily="Poppins, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="140"
        fill="white"
        textAnchor="middle"
        dominantBaseline="auto"
        letterSpacing="-4"
        opacity="0.97"
      >
        S
      </text>

      {/* Green checkmark — large, upper-left, overlapping S */}
      <polyline
        points="28,88 62,124 118,44"
        stroke="#10A65A"
        strokeWidth="19"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface ScoreCasaLogoProps {
  variant?: "dark" | "light" | "color";
  size?: "sm" | "md" | "lg" | "xl";
  showIcon?: boolean;
  className?: string;
}

export function ScoreCasaLogo({
  variant = "dark",
  size = "md",
  showIcon = true,
  className,
}: ScoreCasaLogoProps) {
  const iconSize = { sm: 28, md: 34, lg: 42, xl: 54 }[size];
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[size];

  const wordColor = variant === "light" ? "#FFFFFF" : "#07113A";

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {showIcon && <ScoreCasaIcon size={iconSize} />}
      <span
        style={{
          fontFamily: "Poppins, sans-serif",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        className={textSize}
      >
        <span style={{ color: wordColor }}>score</span>
        <span style={{ color: "#10A65A" }}>casa</span>
        <sup
          style={{
            fontSize: "0.38em",
            color: wordColor,
            opacity: 0.55,
            marginLeft: "1px",
            verticalAlign: "super",
          }}
        >
          ®
        </sup>
      </span>
    </div>
  );
}

export function ScoreCasaWordmark({
  variant = "dark",
  size = "md",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const textSize = { sm: "text-lg", md: "text-2xl", lg: "text-3xl", xl: "text-4xl" }[size];
  const color = variant === "light" ? "#FFFFFF" : "#07113A";

  return (
    <span
      style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}
      className={textSize}
    >
      <span style={{ color }}>score</span>
      <span style={{ color: "#10A65A" }}>casa</span>
      <sup
        style={{
          fontSize: "0.38em",
          color,
          opacity: 0.55,
          marginLeft: "1px",
          verticalAlign: "super",
        }}
      >
        ®
      </sup>
    </span>
  );
}
