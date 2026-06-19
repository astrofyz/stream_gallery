/** Bar pattern speeds (folder suffix omega_b). */
export const OMEGA_B_VALUES = [20, 25, 30, 35, 39, 45, 50, 55] as const;

/** Solar circle overlay radius (kpc) in orbit / bar-frame views. */
export const SOLAR_CIRCLE_RADIUS_KPC = 8.34;

export const SNAPSHOT_FILE = "last_snapshot.npz";
export const ORBIT_FILE = "backward_orbit.npz";

export const NOBAR_DIR = "M5e3_R0.0035_nobar_massloss";

export function barRunDir(omegaB: number): string {
  return `M5e3_R0.0035_bar_omega_${omegaB}_massloss`;
}

export type PosAxis = "x" | "y" | "z";

const POS: ReadonlySet<string> = new Set(["x", "y", "z"]);

export function isPositionAxis(field: string): boolean {
  return POS.has(field);
}

/** NPZ `isescaper` value meaning the star is still bound (not used for colormap min). */
export const ISESCAPER_BOUND_SENTINEL = -9990.0;

/** Multiply escaped-time values (> sentinel) by this to show Myr in the viewer (NPZ stored in Gyr). */
export const ISESCAPER_GYR_TO_MYR = 1000;

/** Color value (Myr) used for bound stars (NPZ sentinel). */
export const ISESCAPER_BOUND_DISPLAY_MYR = 0;

/** Map raw NPZ isescaper to Myr for plotting / colorbar (bound → {@link ISESCAPER_BOUND_DISPLAY_MYR}). */
export function isescaperToMyrForColor(v: number): number {
  if (v <= ISESCAPER_BOUND_SENTINEL) return ISESCAPER_BOUND_DISPLAY_MYR;
  return v * ISESCAPER_GYR_TO_MYR;
}
