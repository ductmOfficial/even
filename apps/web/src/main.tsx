import "./index.css";

import { Toaster } from "@even/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useEffect, useReducer } from "react";
import { createRoot } from "react-dom/client";

import { queryClient } from "./db/invalidate";
import { applyPreferences, resolveTheme, usePreferences } from "./lib/store";
import { router } from "./routes";

function App() {
  const theme = usePreferences((s) => s.theme);
  const privacy = usePreferences((s) => s.privacy);
  // Re-render when the system theme changes, so "system" follows it.
  const [, systemChanged] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    applyPreferences(theme, privacy);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyPreferences(theme, privacy);
      systemChanged();
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [theme, privacy]);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme={resolveTheme(theme)} />
    </QueryClientProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
