export interface FormatDurationOptions {
  fallback?: string;
}

/**
 * Formats seconds into clean, human-readable duration strings:
 * - Under 1 min: "45s", "0s"
 * - Under 1 hour: "2m 15s", "2m" (if 0s)
 * - 1 hour or more: "1h 57m 54s", "1h 57m" (if 0s), "1h" (if 0m 0s)
 */
export function formatDuration(
  seconds?: number | null,
  options?: FormatDurationOptions
): string {
  const fallback = options?.fallback ?? '0s';
  if (seconds == null || isNaN(seconds) || seconds < 0) {
    return fallback;
  }
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes === 0 && remainingSeconds === 0) {
      return `${hours}h`;
    }
    if (remainingSeconds === 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
