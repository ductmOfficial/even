import tailwindcss from "@tailwindcss/vite";
import { defineMain } from "@storybook/react-vite/node";

export default defineMain({
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  viteFinal: (config) => {
    config.plugins = [...(config.plugins ?? []), tailwindcss()];
    return config;
  },
});
