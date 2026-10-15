import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

export const inputClass =
  "h-9 w-full rounded-[10px] border border-line bg-white px-3 text-sm outline-none transition-shadow placeholder:text-muted/60 focus:border-ink/40 focus:ring-2 focus:ring-ink/10 aria-[invalid=true]:border-down aria-[invalid=true]:ring-down/15";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-ink bg-ink text-white hover:bg-ink/90",
  secondary: "border-line bg-subtle text-ink hover:bg-[#ecebe7]",
  ghost: "border-transparent text-ink/75 hover:bg-subtle hover:text-ink",
  danger: "border-transparent text-down hover:bg-down/10",
};

export function Button({
  variant = "secondary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading && <LoaderCircle size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[10px] px-3 py-2 text-sm ${tone === "error" ? "bg-down/10 text-down" : "bg-up/10 text-up"}`}
    >
      {children}
    </p>
  );
}
