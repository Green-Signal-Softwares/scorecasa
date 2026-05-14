import scorecasaIconUrl from "@assets/image_1778778122241.png";

interface ScoreCasaIconProps {
  size?: number;
  className?: string;
}

export function ScoreCasaIcon({ size = 36, className }: ScoreCasaIconProps) {
  return (
    <img
      src={scorecasaIconUrl}
      width={size}
      height={size}
      alt="ScoreCasa"
      className={className}
      style={{ display: "block", objectFit: "contain" }}
    />
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
