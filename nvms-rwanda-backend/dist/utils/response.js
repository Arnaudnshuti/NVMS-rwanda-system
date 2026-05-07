export function asError(error, fallback = "Internal server error") {
    return { error: error instanceof Error ? error.message : fallback };
}
