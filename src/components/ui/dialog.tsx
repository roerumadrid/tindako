"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, style, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      style={style}
      className={cn(
        "fixed inset-0 isolate duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

export type DialogDepth = 1 | 2;

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "default",
  depth = 1,
  dimmed = false,
  style: styleProp,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  variant?: "default" | "stacked";
  /** `1` = base stack index. `2` = nested above another (higher z). */
  depth?: DialogDepth;
  /** When a higher `depth` dialog is open on top, dim this surface and ignore pointer events. */
  dimmed?: boolean;
}) {
  const stackIndex = Math.max(0, depth - 1);
  /** Base overlay `100` / content `110`; step by 20 so nested dialogs stack above the parent. */
  const overlayZ = 100 + stackIndex * 20;
  const contentZ = 110 + stackIndex * 20;

  const overlayClassName = cn(
    "fixed inset-0 isolate duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
    dimmed && "pointer-events-none bg-transparent opacity-0 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none",
    !dimmed &&
      depth === 2 &&
      "bg-black/50 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm dark:bg-black/50",
    !dimmed &&
      depth === 1 &&
      "bg-black/50 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md dark:bg-black/50"
  );

  const outerPopupClassName =
    "group fixed inset-0 flex items-center justify-center p-4 sm:p-6 outline-none pointer-events-none";

  const innerSurfaceClassName = cn(
    "relative w-full max-w-[calc(100%-2rem)] rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
    "pointer-events-auto duration-100",
    "group-data-open:animate-in group-data-open:fade-in-0 group-data-open:zoom-in-95 group-data-closed:animate-out group-data-closed:fade-out-0 group-data-closed:zoom-out-95",
    variant === "stacked"
      ? "flex max-h-[90vh] min-h-0 flex-col gap-0 overflow-visible p-0"
      : "grid max-h-[90vh] gap-4 overflow-y-auto p-4 sm:max-w-sm",
    dimmed && "pointer-events-none opacity-50 transition-opacity duration-200 ease-out",
    !dimmed && depth === 1 && "shadow-xl",
    !dimmed && depth === 2 && "shadow-2xl sm:scale-[1.02]",
    className
  );

  const mergedPopupStyle = React.useMemo(() => {
    const base = { zIndex: contentZ } as React.CSSProperties;
    if (styleProp && typeof styleProp === "object" && !Array.isArray(styleProp)) {
      return { ...base, ...styleProp };
    }
    return base;
  }, [contentZ, styleProp]);

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} style={{ zIndex: overlayZ }} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        style={mergedPopupStyle}
        className={outerPopupClassName}
        {...props}
      >
        <div className={innerSurfaceClassName}>
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-2 right-2"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

/** Scrollable middle region for stacked modals (use inside `DialogContent variant="stacked"`). */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6",
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col gap-3 border-t border-border/60 bg-muted/80 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.06)] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-4 dark:shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.2)]",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
