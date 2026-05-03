export const typography = {
  fontFamily: {
    sans: '"Geist", system-ui, -apple-system, sans-serif',
    mono: '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
  scale: {
    display: { size: '2.75rem', lineHeight: 1.05, letterSpacing: '-0.02em', weight: 600 },
    h1:      { size: '2rem',    lineHeight: 1.15, letterSpacing: '-0.015em', weight: 600 },
    h2:      { size: '1.5rem',  lineHeight: 1.2,  letterSpacing: '-0.01em',  weight: 600 },
    h3:      { size: '1.25rem', lineHeight: 1.25, weight: 600 },
    h4:      { size: '1rem',    lineHeight: 1.4,  weight: 600 },
    bodyLg:  { size: '1.0625rem', lineHeight: 1.55, weight: 400 },
    body:    { size: '1rem',    lineHeight: 1.55, weight: 400 },
    bodySm:  { size: '0.875rem', lineHeight: 1.5,  weight: 400 },
    caption: { size: '0.75rem', lineHeight: 1.4,  letterSpacing: '0.01em', weight: 500 },
  },
  features: {
    tabular: '"tnum" 1, "lnum" 1',
  },
} as const
