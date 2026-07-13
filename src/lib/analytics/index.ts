import { features } from "@/config/features";

/**
 * Capa de analítica desacoplada y desactivable. En modo local no se
 * envía NINGÚN dato a ningún servicio; el adaptador "debug" imprime en
 * consola solo durante el desarrollo. Nunca se envía PII (nombres,
 * correos, teléfonos, direcciones ni notas).
 */

export type AnalyticsEventName =
  | "view_home"
  | "view_menu"
  | "select_category"
  | "search_menu"
  | "view_item"
  | "favorite_item"
  | "select_modifier"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "add_payment_info"
  | "purchase"
  | "reservation_start"
  | "reservation_complete"
  | "click_phone"
  | "click_whatsapp"
  | "click_directions"
  | "select_branch"
  | "install_pwa";

export type AnalyticsProps = Record<string, string | number | boolean>;

interface AnalyticsAdapter {
  track(event: AnalyticsEventName, props?: AnalyticsProps): void;
}

const noopAdapter: AnalyticsAdapter = {
  track() {
    // Sin analítica activa no se registra nada.
  },
};

const debugAdapter: AnalyticsAdapter = {
  track(event, props) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[analytics] ${event}`, props ?? {});
    }
  },
};

function getAdapter(): AnalyticsAdapter {
  return features.analytics === "debug" ? debugAdapter : noopAdapter;
}

export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  try {
    getAdapter().track(event, props);
  } catch {
    // La analítica jamás debe romper la experiencia.
  }
}
