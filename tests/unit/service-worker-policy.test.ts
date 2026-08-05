import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerRequest = { url: string; mode: string; method: string };
type WorkerHandler = (event: {
  request: WorkerRequest;
  respondWith: (promise: Promise<Response>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
}) => void;

function loadWorker() {
  const handlers = new Map<string, WorkerHandler>();
  const self = {
    location: { origin: "https://brisas.test" },
    clients: { claim: vi.fn(() => Promise.resolve()) },
    skipWaiting: vi.fn(() => Promise.resolve()),
    addEventListener: (name: string, handler: WorkerHandler) => handlers.set(name, handler),
  };
  const context = vm.createContext({
    URL, Request, Response, Headers, Promise, self,
    fetch: vi.fn(),
    caches: { keys: vi.fn(), open: vi.fn(), delete: vi.fn(), match: vi.fn() },
  });
  new vm.Script(readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8")).runInContext(context);
  return {
    handlers,
    fetch: context.fetch as ReturnType<typeof vi.fn>,
    caches: context.caches as Record<string, ReturnType<typeof vi.fn>>,
  };
}

function workerResponse(body: string, headers: Record<string, string> = {}) {
  const normalized = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return {
    body,
    ok: true,
    type: "basic",
    url: "https://brisas.test/menu",
    redirected: false,
    headers: {
      get: (name: string) => normalized.get(name.toLowerCase()) ?? null,
      has: (name: string) => normalized.has(name.toLowerCase()),
    },
    clone() { return this; },
  } as unknown as Response;
}

describe("politica de cache del service worker", () => {
  it.each(["/auth", "/cuenta", "/login", "/registro", "/recuperar-contrasena", "/actualizar-contrasena", "/admin", "/api/health", "/checkout", "/pedido"])(
    "no intercepta rutas privadas: %s",
    (path) => {
      const { handlers, fetch } = loadWorker();
      const respondWith = vi.fn();
      handlers.get("fetch")?.({ request: { url: `https://brisas.test${path}`, mode: "navigate", method: "GET" }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["Cache-Control", "private, no-store"],
    ["Set-Cookie", "session=secret"],
  ])("no cachea respuestas con %s", async (header, value) => {
    const cache = { put: vi.fn(() => Promise.resolve()) };
    const { handlers, fetch, caches } = loadWorker();
    caches.open!.mockResolvedValue(cache);
    fetch.mockResolvedValue(workerResponse("private", { [header]: value }));
    let result: Promise<Response> | undefined;
    handlers.get("fetch")?.({
      request: { url: "https://brisas.test/menu", mode: "navigate", method: "GET" },
      respondWith: (promise) => { result = promise; },
    });
    await result;
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("mantiene respondWith pendiente hasta que cache.put termina", async () => {
    let finishPut: (() => void) | undefined;
    const putFinished = new Promise<void>((resolve) => { finishPut = resolve; });
    const cache = { put: vi.fn(() => putFinished) };
    const { handlers, fetch, caches } = loadWorker();
    caches.open!.mockResolvedValue(cache);
    fetch.mockResolvedValue(workerResponse("menu"));
    let result: Promise<Response> | undefined;
    handlers.get("fetch")?.({
      request: { url: "https://brisas.test/menu", mode: "navigate", method: "GET" },
      respondWith: (promise) => { result = promise; },
    });

    let settled = false;
    result?.then(() => { settled = true; });
    await vi.waitFor(() => expect(cache.put).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    finishPut?.();
    await result;
    expect(settled).toBe(true);
  });

  it("elimina caches antiguos y entradas sensibles durante activate", async () => {
    const sensitiveRequest = new Request("https://brisas.test/cuenta");
    const cache = {
      keys: vi.fn(async () => [sensitiveRequest]),
      match: vi.fn(async () => new Response("account", { status: 200 })),
      delete: vi.fn(async () => true),
    };
    const { handlers, caches } = loadWorker();
    caches.keys!.mockResolvedValue(["shell-v2", "runtime-v3", "runtime-v4"]);
    caches.open!.mockResolvedValue(cache);
    caches.delete!.mockResolvedValue(true);
    let activation: Promise<unknown> | undefined;
    handlers.get("activate")?.({
      request: { url: "https://brisas.test/", mode: "navigate", method: "GET" },
      respondWith: vi.fn(),
      waitUntil: (promise) => { activation = promise; },
    });
    await activation;
    expect(caches.delete!).toHaveBeenCalledWith("shell-v2");
    expect(caches.delete!).toHaveBeenCalledWith("runtime-v3");
    expect(cache.delete).toHaveBeenCalledWith(sensitiveRequest);
  });
});
