import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileTypeInfo, formatFileSize, isImageType } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;

      // Fetch document info via edge function
      const infoRes = await fetch(`${FUNCTIONS_URL}/get-shared-file?token=${token}&mode=info`);
      if (!infoRes.ok) { setLoading(false); return; }
      const data = await infoRes.json();
      setDoc(data);

      const fileUrl = `${FUNCTIONS_URL}/get-shared-file?token=${token}`;

      if (data.file_type === 'text/plain') {
        const res = await fetch(fileUrl);
        if (res.ok) setTextContent(await res.text());
      } else if (data.file_type === 'application/pdf' || isImageType(data.file_type)) {
        setPreviewUrl(fileUrl);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;
  if (!doc) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Document not found or no longer shared</p></div>;

  const typeInfo = getFileTypeInfo(doc.file_type);

  const handleDownload = async () => {
    const res = await fetch(`${FUNCTIONS_URL}/get-shared-file?token=${token}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
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
