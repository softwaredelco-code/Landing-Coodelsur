import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coodel: {
          primary: "#002446",
          "primary-light": "#0c447c",
          "primary-mid": "#013B72",
          accent: "#135A28",
          "accent-light": "#2DB742",
          gold: "#FFBC7D",
          muted: "#989393",
          dark: "#122246",
          body: "#33373D",
          surface: "#F5F7F9",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "Poppins", "sans-serif"],
      },
      borderRadius: {
        pill: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
