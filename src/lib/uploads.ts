import { isAcceptedUploadFile } from '@/lib/fileTypes';

export function partitionAcceptedUploadFiles(files: File[]): {
  accepted: File[];
  rejectedCount: number;
} {
  const accepted = files.filter(isAcceptedUploadFile);
  return {
    accepted,
    rejectedCount: files.length - accepted.length,
  };
}

export function formatUnsupportedUploadMessage(rejectedCount: number): string {
  return `${rejectedCount} file${rejectedCount > 1 ? 's were' : ' was'} skipped (unsupported format).`;
}
