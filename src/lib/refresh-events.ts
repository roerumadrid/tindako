export const TINDAKO_DATA_EVENT = "tindako:data";

export function emitTindakoDataRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TINDAKO_DATA_EVENT));
  }
}
