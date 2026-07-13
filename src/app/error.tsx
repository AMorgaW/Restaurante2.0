"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

/** Error boundary de la aplicación (páginas). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Registro local sin datos sensibles; Sentry se conecta aquí si se configura.
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <ErrorState
        title="Algo no salió como esperábamos"
        description="Ocurrió un error inesperado. Puedes intentarlo de nuevo."
        onRetry={reset}
      />
    </div>
  );
}
