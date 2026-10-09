import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function Probe({ seen }: { seen: boolean[] }) {
  seen.push(useHydratedReducedMotion());
  return null;
}

describe("useHydratedReducedMotion", () => {
  afterEach(() => {
    installMatchMedia(false);
  });

  it("empieza en false y aplica la preferencia real antes del paint", () => {
    installMatchMedia(true);
    const seen: boolean[] = [];
    render(<Probe seen={seen} />);
    expect(seen[0]).toBe(false);
    expect(seen.at(-1)).toBe(true);
  });

  it("no re-renderiza si el dispositivo no pide movimiento reducido", () => {
    installMatchMedia(false);
    const seen: boolean[] = [];
    render(<Probe seen={seen} />);
    expect(seen).toEqual([false]);
  });
});
