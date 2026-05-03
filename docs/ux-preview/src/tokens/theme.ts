import { colors } from './colors'
import { typography } from './typography'
import { spacing, radius, breakpoints, motion } from './spacing'

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  breakpoints,
  motion,
} as const

export type Theme = typeof theme
export { colors, typography, spacing, radius, breakpoints, motion }
