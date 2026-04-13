export type ToastVariant = "success" | "destructive" | "default";

export type ToastPayload = {
  title: string;
  description?: string;
  /** Visual + semantic tone. Defaults to `default`. */
  variant?: ToastVariant;
};

const EVENT = "tindako-toast";

/** Dispatches a short global toast (listened to by `<Toaster />` in the root layout). */
export function toast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT, { detail: payload }));
}

export const TINDAKO_TOAST_EVENT = EVENT;

export type ToastModalOptions = {
  closeModal?: () => void;
  /** Prefer this name; closes the modal when true. */
  shouldCloseModal?: boolean;
  /** @deprecated Use `shouldCloseModal` */
  shouldCloseOnSuccess?: boolean;
  description?: string;
  /** Runs after optional `closeModal`, before the toast (e.g. scroll). */
  beforeToast?: () => void;
  /** Delay before showing toast (milliseconds). */
  toastDelayMs?: number;
};

export type HandleSuccessOptions = ToastModalOptions;
export type HandleErrorOptions = ToastModalOptions;

function shouldClose(options?: ToastModalOptions): boolean {
  return Boolean(options?.shouldCloseModal ?? options?.shouldCloseOnSuccess);
}

/**
 * Optional modal close + success-styled toast. Use `shouldCloseModal: false` when the dialog stays open (e.g. Add Product).
 */
export function handleSuccess(message: string, options?: ToastModalOptions) {
  if (typeof window === "undefined") return;

  const { closeModal, description, beforeToast, toastDelayMs } = options ?? {};

  if (shouldClose(options)) {
    closeModal?.();
  }

  beforeToast?.();

  const delay = toastDelayMs ?? 0;
  const showToast = () =>
    toast({
      title: message,
      description,
      variant: "success",
    });

  if (delay > 0) {
    window.setTimeout(showToast, delay);
  } else {
    showToast();
  }
}

/**
 * Optional modal close + destructive-styled toast (errors, deletes, etc.).
 */
export function handleError(message: string, options?: ToastModalOptions) {
  if (typeof window === "undefined") return;

  const { closeModal, description, beforeToast, toastDelayMs } = options ?? {};

  if (shouldClose(options)) {
    closeModal?.();
  }

  beforeToast?.();

  const delay = toastDelayMs ?? 0;
  const showToast = () =>
    toast({
      title: message,
      description,
      variant: "destructive",
    });

  if (delay > 0) {
    window.setTimeout(showToast, delay);
  } else {
    showToast();
  }
}
