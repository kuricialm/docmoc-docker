import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function useDocumentNote(documentId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['document-note', documentId, user?.id],
    queryFn: async () => {
      if (!user || !documentId) return null;
      return api.getNote(documentId, user.id);
    },
    enabled: !!user && !!documentId,
  });
}

export function useNoteMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const upsertNote = useMutation({
    mutationFn: async ({ documentId, content }: { documentId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');
      await api.upsertNote(documentId, user.id, content);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-note'] }),
  });

  return { upsertNote };
}
