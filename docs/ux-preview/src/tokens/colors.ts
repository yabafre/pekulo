export const colors = {
  dark: {
    surface: {
      bg: '#07090E',
      card: '#0E1117',
      elevated: '#161A22',
      muted: '#1A1F29',
      overlay: 'rgba(7, 9, 14, 0.72)',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#CBD5E1',
      tertiary: '#94A3B8',
      muted: '#64748B',
      onAccent: '#042818',
    },
    border: {
      default: '#1E2533',
      strong: '#2A3344',
      focus: '#34D399',
    },
    accent: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
      950: '#022C22',
    },
    semantic: {
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#60A5FA',
    },
    chart: {
      actual: '#34D399',
      plan: '#60A5FA',
      projection: '#A78BFA',
      milestone: '#FBBF24',
      grid: 'rgba(148, 163, 184, 0.10)',
    },
  },
  light: {
    surface: {
      bg: '#FAFAFA',
      card: '#FFFFFF',
      elevated: '#FFFFFF',
      muted: '#F1F5F9',
      overlay: 'rgba(255, 255, 255, 0.75)',
    },
    text: {
      primary: '#0F172A',
      secondary: '#334155',
      tertiary: '#475569',
      muted: '#64748B',
      onAccent: '#FFFFFF',
    },
    border: {
      default: '#E2E8F0',
      strong: '#CBD5E1',
      focus: '#059669',
    },
    accent: {
      500: '#059669',
      600: '#047857',
    },
    semantic: {
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#2563EB',
    },
    chart: {
      actual: '#059669',
      plan: '#2563EB',
      projection: '#7C3AED',
      milestone: '#D97706',
      grid: 'rgba(15, 23, 42, 0.08)',
    },
  },
} as const

export type ColorMode = keyof typeof colors
