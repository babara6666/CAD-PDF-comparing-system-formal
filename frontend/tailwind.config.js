/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#137fec",
        "background-light": "#f6f7f8",
        "background-dark": "#0f0518",
        "primary-dark": "#7c3aed",
        "accent-dark": "#2dd4bf",
        "surface-light": "#ffffff",
        "surface-dark": "#1a0b2e",
        "surface-hover-dark": "#2d1b4e",
        "border-light": "#e7edf3",
        "border-dark": "#2a3b4d",
        "diff-a": "#ef4444",      // Red for A Only (missing)
        "diff-b": "#22c55e",      // Green for B Only (added)
        "diff-mod": "#3b82f6",    // Blue for Modified
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"],
        "body": ["Noto Sans", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      boxShadow: {
        "glow": "0 0 20px rgba(124, 58, 237, 0.5)",
        "glow-sm": "0 0 10px rgba(124, 58, 237, 0.3)",
      },
    },
  },
  plugins: [],
}
