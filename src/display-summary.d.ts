export const DISPLAY_SUMMARY_FIELD: "displaySummary";
export const DEFAULT_DISPLAY_SUMMARY_MAX_LENGTH: 96;

export function normalizeDisplaySummary(value: unknown, maxLength?: number): string | undefined;
export function getDisplaySummary(args: unknown, maxLength?: number): string | undefined;
export function stripDisplaySummary<T>(args: T): T;
