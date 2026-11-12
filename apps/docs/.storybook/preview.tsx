import "../src/styles.css";

import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type ReactNode } from "react";

function Themed({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return children;
}

const withTheme: Decorator = (Story, context) => (
  <Themed theme={context.globals.theme === "dark" ? "dark" : "light"}>
    <Story />
  </Themed>
);

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    a11y: { test: "error" },
    layout: "padded",
  },
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
};

export default preview;
