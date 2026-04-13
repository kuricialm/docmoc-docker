import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
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
  created_at: string;
  updated_at: string;
  tags?: { id: string; name: string; color: string }[];
};

export function useDocuments(filter?: {
  trashed?: boolean;
  starred?: boolean;
  shared?: boolean;
  tagId?: string;
  recent?: boolean;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['documents', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];
      return (await api.getDocuments(user.id, filter)) as unknown as Document[];
    },
    enabled: !!user,
  });
}

export function useDocumentMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['documents'] });

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
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      return await api.toggleShare(id, shared);
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
