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
    <div className={cn("menu-search-field relative rounded-full", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-[1.125rem] top-1/2 size-5 -translate-y-1/2 text-faint transition-colors duration-200"
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
          "h-14 min-h-14 w-full rounded-full border border-border-soft bg-white/6 pl-12 pr-12 text-[15px] text-foreground",
          "placeholder:text-faint outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:border-lime/60 focus:bg-white/8 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_-24px_rgba(183,255,60,0.68)]",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
        {...rest}
      />
      {value.length > 0 ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-muted transition-[background-color,color,transform] hover:bg-white/14 hover:text-foreground active:scale-95 motion-reduce:active:scale-100"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
});
