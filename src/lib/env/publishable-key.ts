const MODERN_PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]{10,}$/;
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  if (!BASE64URL_SEGMENT.test(segment)) return null;
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      Math.ceil(segment.length / 4) * 4,
      "=",
    );
    const parsed = JSON.parse(globalThis.atob(normalized)) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Solo admite la clave publicable moderna o un JWT legacy cuyo rol sea anon. */
export function isSafeSupabasePublishableKey(candidate: string | undefined): candidate is string {
  if (!candidate || candidate.trim() !== candidate || /\s/.test(candidate)) return false;
  if (/^sb_(?:secret|service_role)_/i.test(candidate) || /service_role/i.test(candidate)) return false;
  if (MODERN_PUBLISHABLE_KEY.test(candidate)) return true;

  const segments = candidate.split(".");
  if (segments.length !== 3 || segments.some((segment) => !BASE64URL_SEGMENT.test(segment))) return false;
  if (segments[2]!.length !== 43) return false;
  const header = decodeJsonSegment(segments[0]!);
  const payload = decodeJsonSegment(segments[1]!);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT" || !payload) return false;
  return payload.role === "anon";
}
