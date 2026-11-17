/**
 * Log level type for console logging.
 *
 * Ordered by severity (lowest to highest):
 * - `debug` — Detailed diagnostic information (weight 10).
 * - `info` — General informational messages (weight 20).
 * - `warn` — Warning messages for potentially problematic situations (weight 30).
 * - `error` — Error messages for serious problems (weight 40).
 * - `silent` — Suppress all logging output (weight 100).
 *
 * Messages at the current level and above are logged; messages below are suppressed.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
