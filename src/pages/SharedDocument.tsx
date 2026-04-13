import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';
import * as api from '@/lib/api';

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const shared = await api.getSharedDocument(token, submittedPassword || undefined);
        if (!shared) { setLoading(false); return; }
        setDoc(shared);

        const blob = await api.getSharedDocumentBlob(token, submittedPassword || undefined);
        if (blob) {
          if (shared.file_type === 'text/plain') {
            setTextContent(await blob.text());
          } else if (shared.file_type === 'application/pdf' || isImageType(shared.file_type)) {
            setPreviewUrl(URL.createObjectURL(blob));
          }
        }
        setRequiresPassword(false);
      } catch (e) {
        if (e instanceof Error && e.message === 'PASSWORD_REQUIRED') {
          setRequiresPassword(true);
        }
      }
      setLoading(false);
  };
  load();
  }, [token, submittedPassword]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">Password protected link</h1>
          <p className="text-sm text-muted-foreground">Enter the share password to access this document.</p>
          <Input type="password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} placeholder="Share password" />
          <Button className="w-full" onClick={() => { setSubmittedPassword(sharePassword); setLoading(true); }}>Unlock document</Button>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Document not found or no longer shared</p></div>;

  const typeInfo = getFileTypeInfo(doc.file_type);

  const handleDownload = async () => {
    // For shared docs, download via the shared endpoint
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
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">Docmoc</span>
        <span className="text-xs text-muted-foreground ml-2">Shared Document</span>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
      </header>
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FileTypeIcon fileType={doc.file_type} size="md" />
          <div>
            <h1 className="font-semibold">{doc.name}</h1>
            <p className="text-xs text-muted-foreground">{typeInfo.label} -- {formatFileSize(doc.file_size)}</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden min-h-[60vh] flex items-center justify-center">
          {doc.file_type === 'application/pdf' && previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF" />
          ) : doc.file_type === 'text/plain' && textContent !== null ? (
            <pre className="w-full p-6 text-sm font-mono whitespace-pre-wrap">{textContent}</pre>
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
