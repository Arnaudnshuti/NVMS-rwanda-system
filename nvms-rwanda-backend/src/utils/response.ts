export type ApiErrorBody = { error: string };

export function asError(error: unknown, fallback = "Internal server error"): ApiErrorBody {
  return { error: error instanceof Error ? error.message : fallback };
}
