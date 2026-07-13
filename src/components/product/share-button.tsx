"use client";

import { Share2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { shareOrCopy } from "@/lib/share";

/** Compartir nativo con fallback a copiar el enlace. */
export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const { toast } = useToast();

  return (
    <IconButton
      aria-label={`Compartir ${title}`}
      onClick={async () => {
        const result = await shareOrCopy({ title, text, url });
        if (result === "copied") {
          toast({ title: "Enlace copiado", description: "Pégalo donde quieras compartirlo." });
        } else if (result === "failed") {
          toast({
            title: "No se pudo compartir",
            description: "Copia la dirección desde la barra del navegador.",
            variant: "error",
          });
        }
      }}
    >
      <Share2 aria-hidden className="size-5" />
    </IconButton>
  );
}
