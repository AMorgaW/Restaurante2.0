"use client";

import Image from "next/image";
import { CalendarDays, CheckCircle2, CircleAlert, Moon, Sun, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { menuItems } from "@/data/menu";
import { PensionDomainError } from "@/lib/pension/operations";
import { formatPensionMoney, calculatePensionSurplus } from "@/lib/pension/pricing";
import { getPensionMenu, getPensionMenuDates } from "@/lib/pension/selectors";
import type { PensionDailyMenu, PensionSelection } from "@/lib/pension/types";
import { usePensionStore } from "@/stores/pension";

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

function optionImage(productId?: string): string {
  return menuItems.find((item) => item.id === productId)?.image.publicPath ?? "/generated/menu/plato-de-carne-asada.jpg";
}

export function PensionMenuSelector({ observedAt }: { observedAt: string }) {
  const { toast } = useToast();
  const registerConsumption = usePensionStore((state) => state.registerConsumption);
  const dates = getPensionMenuDates();
  const [date, setDate] = useState(dates[0]!);
  const [period, setPeriod] = useState<PensionDailyMenu["period"]>("lunch");
  const [selections, setSelections] = useState<PensionSelection[]>([]);
  const menu = getPensionMenu(date, period);
  const selectedOptions = useMemo(() => selections.flatMap((selection) => menu?.categories.find((category) => category.id === selection.categoryId)?.options.filter((option) => option.id === selection.optionId) ?? []), [menu, selections]);
  const pricing = useMemo(() => calculatePensionSurplus(menu, selections), [menu, selections]);
  const complete = Boolean(menu?.published && menu.serviceOpen && menu.categories.filter((category) => category.required).every((category) => selections.some((selection) => selection.categoryId === category.id)));

  function choose(categoryId: string, optionId: string) {
    setSelections((current) => [...current.filter((selection) => selection.categoryId !== categoryId), { categoryId, optionId }]);
  }

  function changeDate(nextDate: string) {
    setDate(nextDate);
    setSelections([]);
  }

  function changePeriod(nextPeriod: PensionDailyMenu["period"]) {
    setPeriod(nextPeriod);
    setSelections([]);
  }

  function confirm() {
    if (!menu) return;
    try {
      registerConsumption(menu, selections, observedAt);
      toast({ title: "Consumo demo confirmado", description: pricing.totalAdditional > 0 ? `Excedente informativo: ${formatPensionMoney(pricing.totalAdditional)}.` : "La comida fue aplicada al plan local.", variant: "success" });
      setSelections([]);
    } catch (error) {
      const description = error instanceof PensionDomainError ? error.message : "La selección no pudo confirmarse.";
      toast({ title: "No se pudo confirmar", description, variant: "error" });
    }
  }

  return (
    <section id="menu-plan" aria-labelledby="menu-plan-titulo" className="rounded-card border border-border-soft bg-surface p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Beneficio del plan</p><h2 id="menu-plan-titulo" className="mt-1 text-2xl font-extrabold">Arma tu comida</h2><p className="mt-1 text-sm text-muted">Elige una opción en cada categoría obligatoria.</p></div><Badge variant="lime"><Utensils aria-hidden className="size-4" /> Consumo demo</Badge></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold"><span className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4 text-lime" />Fecha del menú</span><select value={date} onChange={(event) => changeDate(event.target.value)} className="min-h-12 rounded-xl border border-border-soft bg-background-secondary px-3 font-normal capitalize text-foreground focus-visible:outline-2 focus-visible:outline-lime">{dates.map((candidate) => <option key={candidate} value={candidate}>{formatDate(candidate)}</option>)}</select></label><div><span className="text-sm font-semibold">Periodo</span><div role="group" aria-label="Periodo del menú" className="mt-1 grid grid-cols-2 rounded-xl border border-border-soft bg-background-secondary p-1"><button type="button" aria-pressed={period === "lunch"} onClick={() => changePeriod("lunch")} className={`min-h-11 rounded-lg text-sm font-bold focus-visible:outline-2 focus-visible:outline-lime ${period === "lunch" ? "bg-action text-action-foreground" : "text-muted"}`}><Sun aria-hidden className="mr-1 inline size-4" />Almuerzo</button><button type="button" aria-pressed={period === "dinner"} onClick={() => changePeriod("dinner")} className={`min-h-11 rounded-lg text-sm font-bold focus-visible:outline-2 focus-visible:outline-lime ${period === "dinner" ? "bg-action text-action-foreground" : "text-muted"}`}><Moon aria-hidden className="mr-1 inline size-4" />Cena</button></div></div></div>
      {!menu ? <div role="status" className="mt-5 rounded-2xl border border-border-soft bg-background-secondary/50 p-4 text-sm text-muted">No hay menú configurado para esta fecha y periodo.</div> : !menu.published ? <div role="status" className="mt-5 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning"><CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />El menú todavía no está publicado.</div> : !menu.serviceOpen ? <div role="status" className="mt-5 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning"><CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />Servicio cerrado para este fixture. Puedes consultar el menú más tarde.</div> : <div className="mt-5 grid gap-4 lg:grid-cols-3">{menu.categories.map((category) => <fieldset key={category.id} className="rounded-2xl border border-border-soft bg-background-secondary/40 p-3"><legend className="px-1 text-sm font-extrabold">{category.label} <span className="text-lime">{category.required ? "(elige 1)" : "(opcional)"}</span></legend><div className="mt-2 grid gap-2">{category.options.map((option) => { const selected = selections.some((selection) => selection.categoryId === category.id && selection.optionId === option.id); return <label key={option.id} className={`flex min-h-16 items-center gap-2 rounded-xl border px-2 py-2 text-sm ${selected ? "border-lime bg-lime/10" : "border-border-soft bg-surface"} ${!option.available || !option.configured ? "opacity-65" : "cursor-pointer"}`}><input type="radio" name={`pension-${category.id}`} value={option.id} checked={selected} disabled={!option.available || !option.configured} onChange={() => choose(category.id, option.id)} className="size-4 accent-lime" /><Image src={optionImage(option.productId)} alt="" width={44} height={44} className="size-11 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block font-semibold">{option.name}</span>{!option.configured ? <span className="block text-xs text-warning">Por configurar</span> : option.surplusPrice ? <span className="block text-xs text-lime">Excedente +{formatPensionMoney(option.surplusPrice)}</span> : <span className="block text-xs text-lime">Incluido</span>}</span>{selected ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-lime" /> : null}</label>; })}</div></fieldset>)}</div>}
      <div className="mt-5 rounded-2xl border border-border-soft bg-background-secondary/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold">Resumen de selección</p><p className="mt-1 text-xs text-muted">El excedente es informativo y no se cobra en línea.</p></div><p className="text-xl font-extrabold">{formatPensionMoney(pricing.totalAdditional)}</p></div><div className="mt-3 flex flex-wrap gap-2">{selectedOptions.length ? selectedOptions.map((option) => <Badge key={option.id} variant={option.surplusPrice ? "warning" : "lime"}>{option.name}</Badge>) : <span className="text-sm text-muted">Aún no has seleccionado tu comida.</span>}</div><Button fullWidth size="lg" className="mt-4 sm:w-auto" disabled={!complete} onClick={confirm}>Confirmar consumo demo</Button></div>
    </section>
  );
}
