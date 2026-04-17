import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';

export function useDocumentSummary(documentId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ['document-summary', user?.id, documentId],
    queryFn: async () => {
      if (!user || !documentId) return null;
      return api.getDocumentSummary(documentId);
    },
    enabled: !!user && !!documentId,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.data?.state === 'pending' ? 2000 : false),
  });

  const generateSummary = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean }) => {
      if (!documentId) throw new Error('Document is not available');
      return api.generateDocumentSummary(documentId, force);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['document-history'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    summaryQuery,
    generateSummary,
  };
}
