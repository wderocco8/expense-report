export function deriveJobStatus(progress: {
  total: number;
  processed: number;
  failed: number;
}) {
  if (progress.total === 0) return "pending";
  if (progress.processed < progress.total) return "processing";
  if (progress.failed > 0) return "failed";
  return "complete";
}
