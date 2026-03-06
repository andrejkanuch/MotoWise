export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

export const radii = {
  card: 12,
  button: 8,
  input: 8,
  pill: 9999,
} as const

export type Spacing = typeof spacing
export type Radii = typeof radii
