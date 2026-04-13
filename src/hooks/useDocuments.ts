import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { ShareConfig } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type Document = {
  id: string;
  user_id: string;
  name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  starred: boolean;
  trashed: boolean;
  trashed_at: string | null;
  shared: boolean;
  share_token: string | null;
  share_expires_at?: string | null;
  share_has_password?: boolean;
  created_at: string;
  updated_at: string;
  tags?: { id: string; name: string; color: string }[];
};

export function useDocumentHistory(documentId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['document-history', user?.id, documentId],
    queryFn: async () => {
      if (!user || !documentId) return [];
      return api.getDocumentHistory(documentId);
    },
    enabled: !!user && !!documentId,
    refetchInterval: 1000,
  });
}

export function useDocuments(filter?: {
  trashed?: boolean;
  starred?: boolean;
  shared?: boolean;
  tagId?: string;
  recent?: boolean;
  recentLimit?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['documents', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];
      return (await api.getDocuments(user.id, filter)) as unknown as Document[];
    },
    enabled: !!user,
    refetchInterval: 1000,
    refetchOnWindowFocus: true,
  });
}

export function useDocumentMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.invalidateQueries({ queryKey: ['document-history'] });
  };

  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');
      await api.uploadDocument(user.id, file);
    },
    onSuccess: () => { invalidate(); toast.success('Document uploaded'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameDocument = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.renameDocument(id, name);
    },
    onSuccess: () => { invalidate(); toast.success('Renamed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      await api.toggleStar(id, starred);
    },
    onSuccess: () => invalidate(),
  });

  const trashDocument = useMutation({
    mutationFn: async (id: string) => { await api.trashDocument(id); },
    onSuccess: () => { invalidate(); toast.success('Moved to trash'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreDocument = useMutation({
    mutationFn: async (id: string) => { await api.restoreDocument(id); },
    onSuccess: () => { invalidate(); toast.success('Restored'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const permanentDelete = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await api.permanentDelete(id, storagePath);
    },
    onSuccess: () => { invalidate(); toast.success('Permanently deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleShare = useMutation({
    mutationFn: async ({ id, shared, config }: { id: string; shared: boolean; config?: ShareConfig }) => {
      return await api.toggleShare(id, shared, config);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadDocument = async (storagePath: string, fileName: string) => {
    try {
      await api.downloadDocument(storagePath, fileName);
    } catch {
      toast.error('Download failed');
    }
  };

  return { uploadDocument, renameDocument, toggleStar, trashDocument, restoreDocument, permanentDelete, toggleShare, downloadDocument };
}
