import { CopyIcon } from 'lucide-react';
import { useToast } from '@/components/ui/primitives/toast/toast';
import * as styles from './inline-code.css';

export const InlineCode = (props: { content: string }) => {
  const { toast } = useToast();
  return (
    <span className={styles.inlineCodeSpan}>
      <code className={styles.inlineCodeCode}>{props.content}</code>
      <button
        className={styles.inlineCodeButton}
        onClick={async ev => {
          ev.preventDefault();
          await navigator.clipboard.writeText(props.content);
          toast({ title: 'Copied to clipboard' });
        }}
        title="Copy to clipboard"
      >
        <CopyIcon size={16} />
      </button>
    </span>
  );
};
