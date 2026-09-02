/** Paint coverage in square feet per gallon, per coat. Used to suggest gallon counts. */
export const COVERAGE_SQFT_PER_GALLON = {
  interior: 350,
  exterior: 300,
  primer: 300,
} as const

/** Common room presets so dimension entry is two taps, not a measuring tape. */
export interface RoomPreset {
  name: string
  /** Paintable wall area in sq ft at an 8 ft ceiling, less a typical door and window. */
  wallSqft: number
  ceilingSqft: number
  trimLinft: number
}

export const ROOM_PRESETS: RoomPreset[] = [
  { name: 'Bathroom (5x8)', wallSqft: 190, ceilingSqft: 40, trimLinft: 26 },
  { name: 'Bedroom (10x12)', wallSqft: 330, ceilingSqft: 120, trimLinft: 44 },
  { name: 'Bedroom (12x12)', wallSqft: 360, ceilingSqft: 144, trimLinft: 48 },
  { name: 'Living room (14x18)', wallSqft: 480, ceilingSqft: 252, trimLinft: 64 },
  { name: 'Kitchen (10x14)', wallSqft: 350, ceilingSqft: 140, trimLinft: 48 },
  { name: 'Hallway (4x20)', wallSqft: 370, ceilingSqft: 80, trimLinft: 48 },
  { name: 'Stairwell', wallSqft: 300, ceilingSqft: 0, trimLinft: 40 },
]
