"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-action text-action-foreground font-bold shadow-glow hover:brightness-95 disabled:hover:brightness-100",
  secondary:
    "bg-surface-elevated text-foreground font-semibold border border-border-soft hover:border-border-strong",
  ghost: "bg-transparent text-foreground font-semibold hover:bg-white/5",
  destructive: "bg-error/15 text-error font-semibold border border-error/30 hover:bg-error/25",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-14 px-6 text-base gap-2",
};

/**
 * Botón base con estados: normal, hover, focus visible, presionado,
 * deshabilitado y cargando. `primary` es el CTA amarillo de la casa.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "lg",
    loading = false,
    fullWidth = false,
    className,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-button select-none",
        "transition-[transform,filter,background-color,border-color] duration-150",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        "disabled:opacity-55 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria: el botón solo muestra un icono. */
  "aria-label": string;
  size?: "sm" | "md";
  variant?: "soft" | "action" | "ghost";
  children: ReactNode;
}

/** Botón de icono con área táctil mínima de 44px. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", variant = "soft", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full select-none shrink-0",
        "transition-[transform,background-color] duration-150",
        "active:scale-[0.94] motion-reduce:active:scale-100",
        "disabled:opacity-55 disabled:pointer-events-none",
        size === "md" ? "size-12" : "size-11",
        variant === "soft" && "bg-white/8 text-foreground border border-border-soft hover:bg-white/14",
        variant === "action" && "bg-action text-action-foreground shadow-glow hover:brightness-95",
        variant === "ghost" && "bg-transparent text-foreground hover:bg-white/8",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
