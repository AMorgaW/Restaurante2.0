"use client";

/**
 * Error boundary global (falla del layout raíz): HTML mínimo autónomo,
 * sin dependencias de estilos que pudieran haber fallado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[global-error]", error.digest ?? error.message);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020118",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            La aplicación encontró un error
          </h1>
          <p style={{ color: "#b6bfdc", marginBottom: "1.25rem" }}>
            Intenta recargar; si persiste, vuelve en unos minutos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#fdf501",
              color: "#111111",
              border: 0,
              borderRadius: "14px",
              padding: "14px 28px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
