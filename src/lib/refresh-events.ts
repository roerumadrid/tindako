export const TINDAKO_DATA_EVENT = "tindako:data";

export type TindakoDataRefreshDetail = {
  /**
   * When true, the Inventory product list was already updated in React state (e.g. optimistic delete).
   * Listeners that refetch products can skip replacing local state to avoid overwriting with stale data.
   */
  inventoryProductsAlreadyUpdated?: boolean;
};

export function emitTindakoDataRefresh(detail?: TindakoDataRefreshDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TINDAKO_DATA_EVENT, { detail: detail ?? {} }));
  }
}
