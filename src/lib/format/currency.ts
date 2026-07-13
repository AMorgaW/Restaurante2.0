import { currencyConfig } from "@/config/restaurant";
import type { CurrencyConfig } from "@/types/restaurant";

/**
 * Los precios se almacenan SIEMPRE en unidades menores de la moneda
 * (para COP, decimals = 0, unidad menor = peso). Cambiar la moneda en
 * `src/config/restaurant.ts` actualiza el formateo en toda la app.
 */

export function minorUnitsToMajor(amount: number, config: CurrencyConfig = currencyConfig): number {
  return amount / 10 ** config.decimals;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(config: CurrencyConfig): Intl.NumberFormat {
  const key = `${config.locale}-${config.code}-${config.decimals}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.code,
      minimumFractionDigits: config.decimals > 0 ? 2 : 0,
      maximumFractionDigits: config.decimals > 0 ? 2 : 0,
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Formatea un importe expresado en unidades menores. */
export function formatCurrency(amountMinor: number, config: CurrencyConfig = currencyConfig): string {
  const safeAmount = Number.isFinite(amountMinor) ? amountMinor : 0;
  return getFormatter(config).format(minorUnitsToMajor(safeAmount, config));
}
