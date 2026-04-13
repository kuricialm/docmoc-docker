import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, AlertCircle, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';
import * as api from '@/lib/api';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { hasArabicCharacters } from '@/lib/text';

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { appSettings } = useAuth();

  const loadDocument = async (password?: string, options?: { keepContentVisible?: boolean }) => {
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

      const blob = await api.getSharedDocumentBlob(token, password || undefined);
      if (blob) {
        if (shared.file_type === 'text/plain') {
          setTextContent(await blob.text());
          setPreviewUrl(null);
        } else if (shared.file_type === 'application/pdf' || isImageType(shared.file_type)) {
          setPreviewUrl(URL.createObjectURL(blob));
          setTextContent(null);
        }
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
  };

  useEffect(() => {
    loadDocument();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">Password protected link</h1>
          <p className="text-sm text-muted-foreground">Enter the share password to access this document.</p>
          <Input type="password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} placeholder="Share password" />
          {passwordError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme">
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </Button>
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
            <p className="text-xs text-muted-foreground">{typeInfo.label} — {formatFileSize(doc.file_size)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Shared by</span>
            <span className="text-right">{doc.shared_by_name || doc.uploaded_by_name || 'Unknown user'}</span>
          </div>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden min-h-[60vh] flex items-center justify-center">
          {doc.file_type === 'application/pdf' && previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF" />
          ) : doc.file_type === 'text/plain' && textContent !== null ? (
            <pre className={cn('w-full p-6 text-sm whitespace-pre-wrap', hasArabicCharacters(textContent) && 'font-arabic-text')}>
              {textContent}
            </pre>
          ) : isImageType(doc.file_type) && previewUrl ? (
            <img src={previewUrl} alt={doc.name} className="max-w-full max-h-[70vh] object-contain" />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3 py-20">
              <FileTypeIcon fileType={doc.file_type} size="lg" />
              <p className="text-sm text-muted-foreground">Preview not available</p>
              <Button variant="outline" size="sm" onClick={handleDownload}><Download className="w-3.5 h-3.5 mr-1.5" /> Download</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
