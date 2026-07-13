import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { vi } from "vitest";

// jsdom no implementa matchMedia; los hooks de reduced motion lo necesitan.
// Función PLANA (no vi.fn): `restoreMocks` limpiaría la implementación de un
// vi.fn tras cada test y dejaría matchMedia devolviendo undefined.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class MockObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockObserver,
});

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockObserver,
});

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// ---- Mocks de Next.js para pruebas de componentes -----------------

const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next-view-transitions", () => ({
  ViewTransitions: ({ children }: { children: React.ReactNode }) => children,
  useTransitionRouter: () => routerMock,
  Link: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const {
      fill: _fill,
      priority: _priority,
      placeholder: _placeholder,
      blurDataURL: _blur,
      sizes: _sizes,
      quality: _quality,
      unoptimized: _unoptimized,
      loader: _loader,
      ...imgProps
    } = props;
    return createElement("img", imgProps as React.ImgHTMLAttributes<HTMLImageElement>);
  },
}));
