import { Clock3, Moon, Sun } from "lucide-react";
import { SERVICE_PERIOD_COPY, type ServicePeriod } from "@/lib/menu/service-period";
import { cn } from "@/lib/utils";

export function ServiceStatus({ period }: { period: ServicePeriod }) {
  const copy = SERVICE_PERIOD_COPY[period];

  return (
    <section
      aria-label={`Servicio actual: ${copy.label}. ${copy.description}`}
      data-testid="service-status"
      data-service-period={period}
      className="service-status rounded-[1.35rem] border border-border-strong p-1.5"
    >
      {period === "closed" ? (
        <div className="flex min-h-14 items-center gap-3 rounded-[1rem] bg-error/10 px-4 text-left">
          <Clock3 aria-hidden className="size-5 shrink-0 text-error" />
          <div>
            <p className="font-extrabold">Cerrado</p>
            <p className="text-xs text-muted">{copy.description}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1" role="list" aria-label="Horarios de servicio">
          <div
            role="listitem"
            aria-current={period === "lunch" ? "true" : undefined}
            className={cn("service-period-state", period === "lunch" && "service-period-active")}
          >
            <Sun aria-hidden className="size-5" />
            <span>
              <strong>Almuerzo</strong>
              <small>{period === "lunch" ? SERVICE_PERIOD_COPY.lunch.description : "7:00 a. m. – 5:00 p. m."}</small>
            </span>
          </div>
          <div
            role="listitem"
            aria-current={period === "dinner" ? "true" : undefined}
            className={cn("service-period-state", period === "dinner" && "service-period-active")}
          >
            <Moon aria-hidden className="size-5" />
            <span>
              <strong>Cena</strong>
              <small>{period === "dinner" ? SERVICE_PERIOD_COPY.dinner.description : "5:00 p. m. – 10:00 p. m."}</small>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
