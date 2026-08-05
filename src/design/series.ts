/** Revenue-stream series colours, shared by the Dashboard and the Executive
 *  Overview so a stream keeps one identity wherever it is charted.
 *
 *  Validated as a categorical set against the white chart surface (all pairs):
 *  worst colour-vision separation ΔE 8.3, worst normal-vision ΔE 27.4, every
 *  slot at or above 3:1 contrast.
 *
 *  The set this replaces did not pass. F&B was drawn in the danger-red token
 *  (#DC2626) — a status colour carrying a revenue series, which reads as "loss"
 *  on a chart about income — and it sat only ΔE 14.4 from the amber banquets
 *  line, below the floor of 15 at which readers with full colour vision can
 *  still tell two series apart. Rooms keeps the brand blue.
 */
export const SERIES = {
  rooms: "#2563EB",
  fnb: "#EB6834",
  banquets: "#0E9F6E",
} as const;

/** Rooms, F&B, Banquets in the fixed order charts assign them. Never cycled:
 *  a stream's colour follows the stream, not its position in a filtered list. */
export const STREAM_COLORS = [SERIES.rooms, SERIES.fnb, SERIES.banquets];
