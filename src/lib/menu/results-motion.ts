const RESULTS_SETTLE_GAP_MS = 220;

interface FilterIdentity {
  category: string;
  query: string;
  sort: string;
}

function splitFilterKey(key: string): FilterIdentity {
  const first = key.indexOf("::");
  const last = key.lastIndexOf("::");
  if (first <= 0 || last <= first) {
    return { category: key, query: "", sort: "" };
  }
  return {
    category: key.slice(0, first),
    query: key.slice(first + 2, last),
    sort: key.slice(last + 2),
  };
}

/**
 * Un asentamiento corto solo cuando cambia la categoría o el orden.
 * La búsqueda no lo dispara, y un segundo cambio dentro de la ventana
 * deja los resultados nuevos en reposo.
 */
export function shouldPlayResultsSettle(
  previousKey: string,
  nextKey: string,
  lastPlayedAt: number,
  now: number,
): boolean {
  if (previousKey === nextKey) return false;
  const previous = splitFilterKey(previousKey);
  const next = splitFilterKey(nextKey);
  const structureChanged = previous.category !== next.category || previous.sort !== next.sort;
  if (!structureChanged) return false;
  if (lastPlayedAt > 0 && now - lastPlayedAt < RESULTS_SETTLE_GAP_MS) return false;
  return true;
}
