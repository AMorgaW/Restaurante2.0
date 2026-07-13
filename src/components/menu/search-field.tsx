"use client";

import { Search, X } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
}

/** Campo de búsqueda accesible con botón de limpiar. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, label = "Buscar en el menú", className, id: providedId, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint"
      />
      <input
        ref={ref}
        id={id}
        type="search"
        role="searchbox"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "h-12 min-h-12 w-full rounded-full border border-border-soft bg-white/6 pl-11 pr-11 text-[15px] text-foreground",
          "placeholder:text-faint outline-none transition-colors focus:border-lime/60 focus:bg-white/8",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
        {...rest}
      />
      {value.length > 0 ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => onValueChange("")}
          className="absolute right-2.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-muted transition-colors hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
});
