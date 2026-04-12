import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export function useTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return (await api.getTags(user.id)) as Tag[];
    },
    enabled: !!user,
  });
}

export function useTagMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tags'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!user) throw new Error('Not authenticated');
      await api.createTag(user.id, name, color);
    },
    onSuccess: () => { invalidate(); toast.success('Tag created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTag = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      await api.updateTag(id, name, color);
    },
    onSuccess: () => { invalidate(); toast.success('Tag updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => { await api.deleteTag(id); },
    onSuccess: () => { invalidate(); toast.success('Tag deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTagToDocument = useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      await api.addTagToDocument(documentId, tagId);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTagFromDocument = useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      await api.removeTagFromDocument(documentId, tagId);
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  return { createTag, updateTag, deleteTag, addTagToDocument, removeTagFromDocument };
}
