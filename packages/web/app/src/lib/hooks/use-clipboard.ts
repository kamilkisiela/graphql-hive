import { useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export function useClipboard() {
  const { toast } = useToast();

  return useCallback(
    async (text: string): Promise<void> => {
      if (!navigator?.clipboard) {
        toast({
          title: 'Clipboard not supported',
          description: 'Your browser does not support clipboard operations.',
          variant: 'destructive',
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'Copied to clipboard',
        });
      } catch {
        toast({
          title: 'Failed to copy',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );
}
