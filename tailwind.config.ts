import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xsm: "500px",
        sm: "600px",
        md: "690px",
        lg: "988px",
        xl: "1078px",
        xxl: "1265px",
      },
      colors: {
        textGray: "#71767b",
        textGrayLight: "#e7e9ea", 
        borderYellow: "#ffe046",
        inputBlack: "#000000",
        iconBlue: "#ffe046",
        iconGreen: "#00ba7c",
        iconPink: "#f91880",
        periwinkleGrey: '#c7cede',
      },
    },
  },
  plugins: [],
} satisfies Config;
