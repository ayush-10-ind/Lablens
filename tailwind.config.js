/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        error: "var(--error)",
        battery: "var(--battery)",
        resistor: "var(--resistor)",
        led: "var(--led)",
        switch: "var(--switch)",
        breadboard: "var(--breadboard)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
        chip: "999px",
      },
    },
  },
  plugins: [],
};
