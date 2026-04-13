export function getSharedDocumentUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text || !text.trim()) {
    throw new Error('Nothing to copy');
  }

  const trimmed = text.trim();

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(trimmed);
      return;
    } catch {
      // Fall back to execCommand when Clipboard API is unavailable in the current context
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = trimmed;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.top = '0';
  textarea.style.left = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Copy failed');
  }
}
