import { Toaster as Sonner, toast } from "sonner";

export function Toaster({ theme = "system" }: { theme?: "light" | "dark" | "system" }) {
  // Plain toasts: sonner's rich colors put green and red text on pale tints below 4.5:1 contrast.
  return <Sonner theme={theme} position="bottom-right" closeButton />;
}

export { toast };
