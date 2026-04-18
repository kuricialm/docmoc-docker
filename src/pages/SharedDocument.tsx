import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { hasArabicCharacters } from '@/lib/text';
import { getUploadedByLabel } from '@/lib/documentMeta';
import DocumentPreview from '@/components/DocumentPreview';
import ThemeToggleButton from '@/components/ThemeToggleButton';


export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<(api.DocRecord & { tags: api.TagRecord[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const { appSettings } = useAuth();

  const loadDocument = useCallback(async (password?: string, options?: { keepContentVisible?: boolean }) => {
    if (!token) return;
    if (!options?.keepContentVisible) {
      setLoading(true);
    }
    try {
      const shared = await api.getSharedDocument(token, password || undefined);
      if (!shared) {
        setDoc(null);
        return;
      }
      setDoc(shared);

      if (shared.file_type === 'text/plain') {
        const blob = await api.getSharedDocumentBlob(token, password || undefined);
        if (blob) {
          setTextContent(await blob.text());
          setPreviewUrl(null);
        }
      } else if (shared.file_type === 'application/pdf' || isImageType(shared.file_type)) {
        setPreviewUrl(api.getSharedDocumentFileUrl(token, password || undefined));
        setTextContent(null);
      }

      setRequiresPassword(false);
      setPasswordError('');
    } catch (e) {
      if (e instanceof Error && e.message === 'PASSWORD_REQUIRED') {
        setRequiresPassword(true);
        setPasswordError(password ? 'The password you entered is incorrect. Please try again.' : '');
      }
    } finally {
      setLoading(false);
      setUnlocking(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">Password protected link</h1>
          <p className="text-sm text-muted-foreground">Enter the share password to access this document.</p>
          <Input type="password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} placeholder="Share password" />
          {passwordError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{passwordError}</p>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!sharePassword || unlocking}
            onClick={async () => {
              setSubmittedPassword(sharePassword);
              setUnlocking(true);
              await loadDocument(sharePassword, { keepContentVisible: true });
            }}
          >
            {unlocking ? 'Unlocking...' : 'Unlock document'}
          </Button>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Document not found or no longer shared</p></div>;

  const typeInfo = getFileTypeInfo(doc.file_type);
  const uploadedByLabel = getUploadedByLabel(doc.uploaded_by_name);
  const uploadedAtLabel = doc.created_at
    ? new Date(doc.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Unknown date';

  const handleDownload = async () => {
    try {
      const blob = await api.getSharedDocumentBlob(token!, submittedPassword || undefined);
      if (!blob) throw new Error('Download failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b bg-card flex items-center px-6 gap-3">
        {appSettings.workspace_logo_url ? (
          <img src={appSettings.workspace_logo_url} alt="Workspace Logo" className="w-7 h-7 rounded-md object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        <span className="text-sm font-semibold">Docmoc</span>
        <span className="text-xs text-muted-foreground ml-2">Shared Document</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton variant="outline" size="icon" className="h-8 w-8" />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </header>
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FileTypeIcon fileType={doc.file_type} size="md" />
          <div>
            <h1 className={cn('font-semibold', hasArabicCharacters(doc.name) && 'font-arabic-text')}>
              {doc.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {typeInfo.label} - {formatFileSize(doc.file_size)} - Uploaded by {uploadedByLabel} - {uploadedAtLabel}
            </p>
          </div>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden min-h-[60vh] flex items-center justify-center">
          <DocumentPreview
            fileType={doc.file_type}
            fileName={doc.name}
            previewUrl={previewUrl}
            textContent={textContent}
            textIsArabic={textContent ? hasArabicCharacters(textContent) : false}
            className="h-[70vh] w-full"
            imageClassName="max-h-[70vh] max-w-full object-contain"
            iframeClassName="h-[70vh] border-0 rounded-none"
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}
