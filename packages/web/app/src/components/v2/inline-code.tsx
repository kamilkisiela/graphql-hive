import { useNotifications } from '@/lib/hooks/use-notifications';
import { CopyIcon } from './icon';

export const InlineCode = (props: { content: string }) => {
  const post = useNotifications();
  return (
    <span className="rounded-md bg-gray-800 p-1 pl-2 font-mono">
      <code>{props.content}</code>
      <button
        className="hover:text-orange-600 cursor-pointer p-2 pr-1 pl-2"
        onClick={ev => {
          ev.preventDefault();
          window.navigator.clipboard.writeText(props.content);
          post('Copied to clipboard', 'success');
        }}
        title="Copy to clipboard"
      >
        <CopyIcon size={12} />
      </button>
    </span>
  );
};
