import type { CheckoutInput } from "@/features/checkout/schema";

export const GUEST_RECEIPT_ATTEMPT_STORAGE_KEY = "rb-checkout-receipt-attempts";
export const GUEST_RECEIPT_ATTEMPT_VERSION = 1 as const;
export const MAX_GUEST_RECEIPT_RESERVATIONS = 8;

export type GuestReceiptAttemptState = "prepared" | "uncertain" | "confirmed";
export type CommercialCheckoutPayload = Omit<CheckoutInput, "idempotencyKey" | "receiptKey">;

export type GuestReceiptAttempt = {
  version: typeof GUEST_RECEIPT_ATTEMPT_VERSION;
  state: GuestReceiptAttemptState;
  idempotencyKey: string;
  receiptKey: string;
  commercialFingerprint: string;
  createdAt: string;
  updatedAt: string;
  orderId?: string;
  acknowledgedAt?: string;
};

/** Metadata used by the session manager before a user explicitly reveals a key. */
export type GuestReceiptAttemptMetadata = Omit<GuestReceiptAttempt, "receiptKey">;

export type ConfirmedGuestReceiptIdentity = Pick<
  GuestReceiptAttempt,
  "version" | "idempotencyKey" | "receiptKey" | "commercialFingerprint" | "createdAt" | "orderId"
>;

type AttemptEnvelope = {
  version: typeof GUEST_RECEIPT_ATTEMPT_VERSION;
  pending: GuestReceiptAttempt | null;
  confirmed: GuestReceiptAttempt[];
};

type StorageResult =
  | { kind: "available"; storage: Storage }
  | { kind: "unavailable" }
  | { kind: "corrupt"; storage: Storage };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isCanonicalBase64Url(value: unknown, expectedBytes = 32): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const bytes = decodeBase64Url(value);
    return bytes.length === expectedBytes && encodeBase64Url(bytes) === value;
  } catch {
    return false;
  }
}

export function isCanonicalReceiptKey(value: unknown): value is string {
  return isCanonicalBase64Url(value, 32) && typeof value === "string" && value.length === 43;
}

function validateAttempt(
  value: unknown,
  expectedState?: GuestReceiptAttemptState,
): value is GuestReceiptAttempt {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "version",
      "state",
      "idempotencyKey",
      "receiptKey",
      "commercialFingerprint",
      "createdAt",
      "updatedAt",
      "orderId",
      "acknowledgedAt",
    ])
  )
    return false;
  if (value.version !== GUEST_RECEIPT_ATTEMPT_VERSION) return false;
  if (value.state !== "prepared" && value.state !== "uncertain" && value.state !== "confirmed")
    return false;
  if (expectedState && value.state !== expectedState) return false;
  if (!isUuid(value.idempotencyKey) || !isCanonicalReceiptKey(value.receiptKey)) return false;
  if (!isCanonicalBase64Url(value.commercialFingerprint)) return false;
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) return false;
  if (value.orderId !== undefined && !isUuid(value.orderId)) return false;
  if (value.state === "confirmed" && !value.orderId) return false;
  if (value.state !== "confirmed" && value.orderId !== undefined) return false;
  if (value.state !== "confirmed" && value.acknowledgedAt !== undefined) return false;
  if (value.acknowledgedAt !== undefined && !isIsoDate(value.acknowledgedAt)) return false;
  return true;
}

function validateEnvelope(value: unknown): value is AttemptEnvelope {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "pending", "confirmed"])) return false;
  if (
    value.version !== GUEST_RECEIPT_ATTEMPT_VERSION ||
    !(value.pending === null || validateAttempt(value.pending, "prepared") || validateAttempt(value.pending, "uncertain"))
  ) {
    return false;
  }
  const confirmedIds = new Set<string>();
  const confirmedReceiptKeys = new Set<string>();
  if (!Array.isArray(value.confirmed)) return false;
  for (const entry of value.confirmed) {
    if (!validateAttempt(entry, "confirmed")) return false;
    if (confirmedIds.has(entry.idempotencyKey) || confirmedReceiptKeys.has(entry.receiptKey)) {
      return false;
    }
    confirmedIds.add(entry.idempotencyKey);
    confirmedReceiptKeys.add(entry.receiptKey);
  }
  if (value.pending && confirmedIds.has(value.pending.idempotencyKey)) return false;
  return (
    value.confirmed.length <= MAX_GUEST_RECEIPT_RESERVATIONS &&
    value.confirmed.length + (value.pending ? 1 : 0) <= MAX_GUEST_RECEIPT_RESERVATIONS
  );
}

function getStorageResult(): StorageResult {
  if (typeof window === "undefined") return { kind: "unavailable" };
  try {
    const storage = window.sessionStorage;
    const probe = `${GUEST_RECEIPT_ATTEMPT_STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    const raw = storage.getItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY);
    if (raw === null) return { kind: "available", storage };
    try {
      const parsed: unknown = JSON.parse(raw);
      return validateEnvelope(parsed)
        ? { kind: "available", storage }
        : { kind: "corrupt", storage };
    } catch {
      return { kind: "corrupt", storage };
    }
  } catch {
    return { kind: "unavailable" };
  }
}

export function canUseGuestReceiptAttemptStorage(): boolean {
  return getStorageResult().kind !== "unavailable";
}

function requireStorage(): Storage {
  const result = getStorageResult();
  if (result.kind === "unavailable") throw new Error("guest-receipt-storage-unavailable");
  if (result.kind === "corrupt") throw new Error("guest-receipt-storage-corrupt");
  return result.storage;
}

function readEnvelope(storage: Storage): AttemptEnvelope {
  const raw = storage.getItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY);
  if (raw === null) return { version: GUEST_RECEIPT_ATTEMPT_VERSION, pending: null, confirmed: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("guest-receipt-storage-corrupt");
  }
  if (!validateEnvelope(parsed)) throw new Error("guest-receipt-storage-corrupt");
  return cleanupEnvelope(parsed);
}

function cleanupEnvelope(envelope: AttemptEnvelope): AttemptEnvelope {
  // PostgreSQL is authoritative for the 30-day lifetime. Keep local copies
  // until the user explicitly removes one, so capacity is never freed silently.
  const confirmed = envelope.confirmed.sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  return { ...envelope, confirmed };
}

function writeEnvelope(storage: Storage, envelope: AttemptEnvelope): void {
  if (!validateEnvelope(envelope)) throw new Error("guest-receipt-storage-corrupt");
  const reservedCount = envelope.confirmed.length + (envelope.pending ? 1 : 0);
  if (reservedCount > MAX_GUEST_RECEIPT_RESERVATIONS) {
    throw new Error("guest-receipt-capacity-exhausted");
  }
  storage.setItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY, JSON.stringify(cleanupEnvelope(envelope)));
}

type AttemptIdentity = Pick<
  GuestReceiptAttempt,
  "version" | "idempotencyKey" | "receiptKey" | "commercialFingerprint" | "createdAt"
>;

function sameAttemptIdentity(left: GuestReceiptAttempt, right: AttemptIdentity): boolean {
  return (
    left.version === right.version &&
    left.idempotencyKey === right.idempotencyKey &&
    left.receiptKey === right.receiptKey &&
    left.commercialFingerprint === right.commercialFingerprint &&
    left.createdAt === right.createdAt
  );
}

function requirePendingAttempt(
  storage: Storage,
  expected: AttemptIdentity,
  allowedStates: readonly GuestReceiptAttemptState[],
): GuestReceiptAttempt {
  const pending = readEnvelope(storage).pending;
  if (!pending) throw new Error("guest-receipt-reservation-missing");
  if (!sameAttemptIdentity(pending, expected)) {
    throw new Error("guest-receipt-reservation-mismatch");
  }
  if (!allowedStates.includes(pending.state)) {
    throw new Error("guest-receipt-attempt-invalid-transition");
  }
  return pending;
}

function verifyPendingAttempt(
  storage: Storage,
  expected: AttemptIdentity,
  state: GuestReceiptAttemptState,
): void {
  const pending = requirePendingAttempt(storage, expected, [state]);
  if (pending.state !== state) throw new Error("guest-receipt-attempt-not-persisted");
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("invalid-base64url");
  }
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function generateReceiptKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function canonicalizeCommercialPayload(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeCommercialPayload).join(",")}]`;
  if (!isRecord(value)) return "null";
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeCommercialPayload(value[key])}`)
    .join(",")}}`;
}

async function hmacFingerprint(
  receiptKey: string,
  commercialPayload: CommercialCheckoutPayload,
): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    decodeBase64Url(receiptKey) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonicalizeCommercialPayload(commercialPayload)),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function prepareGuestReceiptAttempt(
  commercialPayload: CommercialCheckoutPayload,
): Promise<GuestReceiptAttempt> {
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const pending = envelope.pending;
  if (pending) {
    const fingerprint = await hmacFingerprint(pending.receiptKey, commercialPayload);
    if (fingerprint === pending.commercialFingerprint) return pending;
    if (pending.state === "uncertain") throw new Error("guest-receipt-attempt-mismatch");
    if (envelope.confirmed.length + 1 > MAX_GUEST_RECEIPT_RESERVATIONS) {
      throw new Error("guest-receipt-capacity-exhausted");
    }
  }

  if (!pending && envelope.confirmed.length >= MAX_GUEST_RECEIPT_RESERVATIONS) {
    throw new Error("guest-receipt-capacity-exhausted");
  }

  const receiptKey = generateReceiptKey();
  const createdAt = nowIso();
  const attempt: GuestReceiptAttempt = {
    version: GUEST_RECEIPT_ATTEMPT_VERSION,
    state: "prepared",
    idempotencyKey: globalThis.crypto.randomUUID(),
    receiptKey,
    commercialFingerprint: await hmacFingerprint(receiptKey, commercialPayload),
    createdAt,
    updatedAt: createdAt,
  };
  writeEnvelope(storage, { ...envelope, pending: attempt });
  return attempt;
}

export function markGuestReceiptAttemptUncertain(attempt: AttemptIdentity): void {
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const pending = requirePendingAttempt(storage, attempt, ["prepared", "uncertain"]);
  writeEnvelope(storage, {
    ...envelope,
    pending: { ...pending, state: "uncertain", updatedAt: nowIso() },
  });
  verifyPendingAttempt(storage, attempt, "uncertain");
}

export function markGuestReceiptAttemptPrepared(attempt: AttemptIdentity): void {
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const pending = requirePendingAttempt(storage, attempt, ["prepared", "uncertain"]);
  writeEnvelope(storage, {
    ...envelope,
    pending: { ...pending, state: "prepared", updatedAt: nowIso() },
  });
  verifyPendingAttempt(storage, attempt, "prepared");
}

export function markGuestReceiptAttemptConfirmed(attempt: AttemptIdentity, orderId: string): void {
  if (!isUuid(orderId)) throw new Error("invalid-order-id");
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const pending = requirePendingAttempt(storage, attempt, ["uncertain"]);
  const confirmed: GuestReceiptAttempt = {
    ...pending,
    state: "confirmed",
    orderId,
    updatedAt: nowIso(),
  };
  writeEnvelope(storage, {
    ...envelope,
    pending: null,
    confirmed: [confirmed, ...envelope.confirmed],
  });
  const persisted = readEnvelope(storage);
  if (
    persisted.pending !== null ||
    !persisted.confirmed.some(
      (entry) =>
        entry.orderId === orderId &&
        sameAttemptIdentity(entry, attempt) &&
        entry.state === "confirmed",
    )
  ) {
    throw new Error("guest-receipt-confirmation-not-persisted");
  }
}

function sameConfirmedIdentity(
  entry: GuestReceiptAttempt,
  identity: ConfirmedGuestReceiptIdentity,
): boolean {
  return (
    entry.state === "confirmed" &&
    entry.orderId === identity.orderId &&
    sameAttemptIdentity(entry, identity)
  );
}

/** Lists confirmed entries without exposing any receipt key. */
export function listConfirmedGuestReceiptAttemptMetadata(): GuestReceiptAttemptMetadata[] {
  const storage = requireStorage();
  return readEnvelope(storage).confirmed.map(({ receiptKey: _receiptKey, ...metadata }) => metadata);
}

/**
 * Resolves one selected entry. Callers must supply the complete non-secret
 * metadata returned by listConfirmedGuestReceiptAttemptMetadata.
 */
export function revealConfirmedGuestReceiptAttempt(
  metadata: GuestReceiptAttemptMetadata,
): GuestReceiptAttempt | null {
  if (metadata.state !== "confirmed" || !metadata.orderId) {
    throw new Error("guest-receipt-confirmation-missing");
  }
  const storage = requireStorage();
  const entry = readEnvelope(storage).confirmed.find(
    (candidate) =>
      candidate.state === "confirmed" &&
      candidate.orderId === metadata.orderId &&
      candidate.version === metadata.version &&
      candidate.idempotencyKey === metadata.idempotencyKey &&
      candidate.commercialFingerprint === metadata.commercialFingerprint &&
      candidate.createdAt === metadata.createdAt,
  );
  return entry ? { ...entry } : null;
}

export function acknowledgeGuestReceiptAttempt(identity: ConfirmedGuestReceiptIdentity): void {
  if (!identity.orderId || !isUuid(identity.orderId)) throw new Error("invalid-order-id");
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const index = envelope.confirmed.findIndex((entry) => sameConfirmedIdentity(entry, identity));
  if (index < 0) throw new Error("guest-receipt-confirmation-missing");
  const acknowledgedAt = nowIso();
  const confirmed = envelope.confirmed.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, acknowledgedAt, updatedAt: acknowledgedAt } : entry,
  );
  writeEnvelope(storage, { ...envelope, confirmed });
  const persisted = readEnvelope(storage);
  const updated = persisted.confirmed.find((entry) => sameConfirmedIdentity(entry, identity));
  if (!updated || updated.acknowledgedAt !== acknowledgedAt) {
    throw new Error("guest-receipt-acknowledgement-not-persisted");
  }
}

/** Removes only one confirmed local copy after explicit user confirmation. */
export function removeConfirmedGuestReceiptAttempt(identity: ConfirmedGuestReceiptIdentity): void {
  if (!identity.orderId || !isUuid(identity.orderId)) throw new Error("invalid-order-id");
  const storage = requireStorage();
  const envelope = readEnvelope(storage);
  const index = envelope.confirmed.findIndex((entry) => sameConfirmedIdentity(entry, identity));
  if (index < 0) throw new Error("guest-receipt-confirmation-missing");
  const confirmed = envelope.confirmed.filter((_entry, entryIndex) => entryIndex !== index);
  writeEnvelope(storage, { ...envelope, confirmed });
  const persisted = readEnvelope(storage);
  if (persisted.confirmed.some((entry) => sameConfirmedIdentity(entry, identity))) {
    throw new Error("guest-receipt-removal-not-persisted");
  }
}

export function clearGuestReceiptAttemptStorageForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(GUEST_RECEIPT_ATTEMPT_STORAGE_KEY);
  } catch {
    // Los tests y el checkout tratan el almacenamiento no disponible como un bloqueo seguro.
  }
}
