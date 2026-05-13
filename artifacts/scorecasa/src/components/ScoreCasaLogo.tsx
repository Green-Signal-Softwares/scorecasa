interface ScoreCasaIconProps {
  size?: number;
  className?: string;
}

export function ScoreCasaIcon({ size = 36, className }: ScoreCasaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="20" fill="#07113A" />
      <rect width="100" height="100" rx="20" fill="url(#sc-grad)" />

      {/* S letter */}
      <text
        x="52"
        y="74"
        fontFamily="Poppins, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="66"
        fill="white"
        textAnchor="middle"
        dominantBaseline="auto"
        letterSpacing="-2"
        opacity="0.95"
      >
        S
      </text>

      {/* Green checkmark overlaid on top-left of S */}
      <polyline
        points="17,46 30,60 52,28"
        stroke="#10A65A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Green accent at bottom */}
      <path
        d="M0 82 Q50 72 100 82 L100 100 Q50 100 0 100 Z"
        fill="#10A65A"
        opacity="0.25"
      />

      <defs>
        <linearGradient id="sc-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D1B8C" />
          <stop offset="100%" stopColor="#07113A" />
        </linearGradient>
      </defs>
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
  const iconSize = { sm: 28, md: 36, lg: 44, xl: 56 }[size];
  const textSize = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[size];
  const subSize  = { sm: "text-[9px]", md: "text-[10px]", lg: "text-xs", xl: "text-sm" }[size];

  const wordmarkColor = variant === "light"
    ? "text-white"
    : "text-[#07113A]";

  const subColor = variant === "light"
    ? "text-[#10A65A]"
    : "text-[#10A65A]";

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      {showIcon && <ScoreCasaIcon size={iconSize} />}
      <div className="leading-none">
        <div className={`font-bold tracking-tight leading-none ${textSize} ${wordmarkColor}`}>
          <span>score</span>
          <span style={{ color: "#10A65A" }}>casa</span>
          <sup className="text-[0.4em] align-super ml-0.5 opacity-60">®</sup>
        </div>
        <div className={`font-medium mt-0.5 leading-none ${subSize} ${subColor}`}>
          Inteligência de Crédito Imobiliário
        </div>
      </div>
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
  const color = variant === "light" ? "text-white" : "text-[#07113A]";

  return (
    <span className={`font-bold tracking-tight leading-none ${textSize} ${color}`}>
      <span>score</span>
      <span style={{ color: "#10A65A" }}>casa</span>
      <sup className="text-[0.4em] align-super ml-0.5 opacity-60">®</sup>
    </span>
  );
}
