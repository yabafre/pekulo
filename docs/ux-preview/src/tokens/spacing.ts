/** 4pt-base spacing scale, exposed in rem (Tailwind-friendly) */
export const spacing = {
  0: "0",
  1: "0.25rem", // 4
  2: "0.5rem", // 8
  3: "0.75rem", // 12
  4: "1rem", // 16
  5: "1.25rem", // 20
  6: "1.5rem", // 24
  8: "2rem", // 32
  10: "2.5rem", // 40
  12: "3rem", // 48
  16: "4rem", // 64
  20: "5rem", // 80
  24: "6rem", // 96
} as const;

export const radius = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const breakpoints = {
  sm: "375px",
  md: "768px",
  lg: "1024px",
  xl: "1440px",
} as const;

export const motion = {
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
  },
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    in: "cubic-bezier(0.7, 0, 0.84, 0)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;
