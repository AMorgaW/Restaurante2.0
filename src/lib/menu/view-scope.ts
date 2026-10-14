export type MenuViewScope = "catalog" | "search";

const VIEW_STORAGE_KEYS: Record<MenuViewScope, string> = {
  catalog: "rb-menu-view",
  search: "rb-search-view",
};

const SCROLL_STORAGE_KEYS: Record<MenuViewScope, string> = {
  catalog: "rb-menu-scroll-y",
  search: "rb-search-scroll-y",
};

export function getMenuViewStorageKey(scope: MenuViewScope): string {
  return VIEW_STORAGE_KEYS[scope];
}

export function getMenuScrollStorageKey(scope: MenuViewScope): string {
  return SCROLL_STORAGE_KEYS[scope];
}

/** Search is the only public catalog surface with an isolated view session. */
export function menuViewScopeForPathname(pathname: string): MenuViewScope {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/buscar" ? "search" : "catalog";
}
