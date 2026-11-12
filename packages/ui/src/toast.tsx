import { Toaster as Sonner, toast } from "sonner";

export function Toaster({ theme = "system" }: { theme?: "light" | "dark" | "system" }) {
  return <Sonner theme={theme} position="bottom-right" richColors closeButton />;
}

export { toast };
