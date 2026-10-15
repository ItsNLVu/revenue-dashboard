export type SeriesKey = "pos" | "eatclub" | "labour";

export interface SeriesConfig {
  key: SeriesKey;
  label: string;
  /** Legend label of the same series for the previous period (naming follows the design) */
  previousLabel: string;
  color: string;
  previousColor: string;
}

export const SERIES: SeriesConfig[] = [
  {
    key: "pos",
    label: "POS Revenue",
    previousLabel: "Direct Revenue (Previous)",
    color: "var(--color-pos)",
    previousColor: "var(--color-prev-direct)",
  },
  {
    key: "eatclub",
    label: "Eatclub Revenue",
    previousLabel: "Total Revenue (Previous)",
    color: "var(--color-eatclub)",
    previousColor: "var(--color-prev-total)",
  },
  {
    key: "labour",
    label: "Labour Costs",
    previousLabel: "Labour Costs (Previous)",
    color: "var(--color-labour)",
    previousColor: "var(--color-prev-labour)",
  },
];

export type VisibleSeries = Record<SeriesKey, boolean>;
