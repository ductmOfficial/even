import { Button, Dialog, DialogActions } from "@ductmofficial/sen-ui";
import { buttonClass, cn } from "@even/ui";
import { useId, type ReactNode } from "react";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** A wider dialog for long forms. */
  wide?: boolean;
  children: ReactNode;
}

/** Sen UI's modal Dialog, controlled, with an optional description linked to it. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  wide,
  children,
}: FormDialogProps) {
  const descriptionId = useId();
  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={title}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(wide && "even-dialog-wide")}
    >
      {description ? (
        <p id={descriptionId} className="-mt-1 mb-4 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </Dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** A confirmation that needs an answer: an alert dialog with Cancel and the action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const descriptionId = useId();
  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      title={title}
      role="alertdialog"
      aria-describedby={description ? descriptionId : undefined}
    >
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      <DialogActions>
        <Button
          variant="secondary"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Huỷ
        </Button>
        <Button
          className={buttonClass({ tone: destructive ? "danger-solid" : undefined })}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
