type HistoryDetails = Record<string, unknown> | null;

const HISTORY_LABELS: Record<string, (details: HistoryDetails) => string> = {
  uploaded: () => 'Uploaded file',
  renamed: (details) => `Renamed${typeof details?.to === 'string' ? ` to "${details.to}"` : ''}`,
  starred: () => 'Starred',
  unstarred: () => 'Unstarred',
  deleted: () => 'Moved to trash',
  restored: () => 'Restored from trash',
  share_enabled: () => 'Sharing enabled',
  share_updated: () => 'Share settings updated',
  share_disabled: () => 'Sharing disabled',
  share_expiry_changed: () => 'Share expiry changed',
  share_password_added: () => 'Share password added',
  share_password_changed: () => 'Share password changed',
  share_password_removed: () => 'Share password removed',
  tag_added: (details) => `Added tag${typeof details?.tagName === 'string' ? ` "${details.tagName}"` : ''}`,
  tag_removed: (details) => `Removed tag${typeof details?.tagName === 'string' ? ` "${details.tagName}"` : ''}`,
  permanently_deleted: () => 'Permanently deleted',
  note_added: () => 'Added comment',
  note_updated: () => 'Edited comment',
  comment_added: () => 'Added comment',
  comment_edited: () => 'Edited comment',
  summary_generated: () => 'Generated summary',
  summary_regenerated: () => 'Regenerated summary',
  summary_failed: () => 'Summary generation failed',
  summary_unsupported: () => 'Summary unsupported',
};

export function getDocumentHistoryLabel(action: string, details: HistoryDetails): string {
  return HISTORY_LABELS[action]?.(details) || action.split('_').join(' ');
}
