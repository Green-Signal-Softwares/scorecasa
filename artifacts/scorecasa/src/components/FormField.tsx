import type { ComponentType, SVGProps } from "react";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export interface FormFieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  invalid?: boolean;
  error?: string;
  hint?: string;
  icon?: IconComp;
  max?: number;
  min?: number;
  testId?: string;
  size?: "compact" | "comfortable";
  required?: boolean;
  inputMode?: "numeric" | "text" | "decimal" | "email" | "tel" | "search" | "url";
}

export function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  invalid,
  error,
  hint,
  icon: Icon,
  max,
  min,
  testId,
  size = "comfortable",
  required,
  inputMode,
}: FormFieldProps) {
  const isInvalid = !!(invalid || error);

  const sizeCls =
    size === "compact"
      ? "h-10 px-3 rounded-md text-sm"
      : "px-3 py-2.5 rounded-lg text-sm";

  const stateCls = readOnly
    ? "bg-gray-50 text-gray-400 border-gray-200 cursor-default"
    : isInvalid
    ? "border-red-500 bg-red-50 text-red-700 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500"
    : "border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D1B8C]/30 focus:border-[#0D1B8C]";

  const labelCls = isInvalid ? "text-red-600" : "text-gray-700";
  const labelSize = size === "compact" ? "text-xs mb-1" : "text-sm font-medium mb-1";

  // Separa o asterisco do label para renderizá-lo em vermelho
  const labelText = label.endsWith(" *") ? label.slice(0, -2) : label;
  const isRequired = required || label.endsWith(" *");

  return (
    <div>
      <label className={`block ${labelSize} ${labelCls} flex items-center gap-1`}>
        {Icon && <Icon className="w-3 h-3" />}
        <span>
          {labelText}
          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>
      <input
        type={type}
        inputMode={inputMode}
        min={min ?? (type === "number" ? 0 : undefined)}
        max={max}
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        data-testid={testId}
        aria-invalid={isInvalid || undefined}
        className={`w-full border ${sizeCls} ${stateCls} transition-colors`}
      />
      {hint && !isInvalid && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
