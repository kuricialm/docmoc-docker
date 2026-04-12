import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileTypeInfo, formatFileSize, isPreviewable, isImageType } from '@/lib/fileTypes';
import FileTypeIcon from '@/components/FileTypeIcon';

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('share_token', token)
        .eq('shared', true)
        .eq('trashed', false)
        .maybeSingle();

      if (data) {
        setDoc(data);
        if (data.file_type === 'text/plain') {
          const { data: fileData } = await supabase.storage.from('documents').download(data.storage_path);
          if (fileData) setTextContent(await fileData.text());
        } else if (data.file_type === 'application/pdf' || isImageType(data.file_type)) {
          const { data: urlData } = await supabase.storage.from('documents').createSignedUrl(data.storage_path, 3600);
          if (urlData) setPreviewUrl(urlData.signedUrl);
        }
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;
  if (!doc) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Document not found or no longer shared</p></div>;

  const typeInfo = getFileTypeInfo(doc.file_type);

  const handleDownload = async () => {
    const { data } = await supabase.storage.from('documents').download(doc.storage_path);
    if (!data) return;
    const url = URL.createObjectURL(data);
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
        <div className="bg-card border rounded-lg overflow-hidden min-h-[60vh] flex items-center justify-center">
          {doc.file_type === 'application/pdf' && previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[70vh]" title="PDF" />
          ) : doc.file_type === 'text/plain' && textContent !== null ? (
            <pre className="w-full p-6 text-sm font-mono whitespace-pre-wrap">{textContent}</pre>
          ) : isImageType(doc.file_type) && previewUrl ? (
            <img src={previewUrl} alt={doc.name} className="max-w-full max-h-[70vh] object-contain" />
          ) : (
            <div className="text-center space-y-3 py-20">
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
