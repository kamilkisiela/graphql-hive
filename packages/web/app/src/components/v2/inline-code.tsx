import { useNotifications } from '@/lib/hooks';
import { CopyIcon } from './icon';

export const InlineCode = (props: { content: string }) => {
  const post = useNotifications();
  return (
    <span className="flex items-center gap-2 break-all rounded-md bg-gray-800 p-4 font-mono">
      <code>{props.content}</code>
      <button
        className="cursor-pointer p-2 hover:text-orange-600"
        onClick={async ev => {
          ev.preventDefault();
          await navigator.clipboard.writeText(props.content);
          post('Copied to clipboard', 'success');
        }}
        title="Copy to clipboard"
      >
        <CopyIcon size={16} />
      </button>
    </span>
  );
};
