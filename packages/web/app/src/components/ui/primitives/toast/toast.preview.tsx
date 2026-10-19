import { createPreview, type NavPath } from 'react-foundry';
import { Button } from '../button/button';
import { useToast, type ToastVariant } from './toast';
import * as styles from './toast.preview.css';

export const nav: NavPath = 'Primitives/Feedback/Toast';

/**
 * One call shape, `toast({ title, description, variant })`, drawn on the neutral-3 surface with a
 * status icon. Up to three stack in the corner, collapsed to the front one until hovered or
 * focused; default and success toasts leave after 5s, destructive ones stay until closed. Swipe
 * right or down to dismiss.
 *
 * The provider is mounted by foundry's providers, as the router mounts it in the app.
 */

export const Variants = createPreview(() => {
  const { toast } = useToast();
  return (
    <div className={styles.div}>
      <Button
        variant="outline"
        onClick={() =>
          toast({ title: 'Token created', description: 'The token has been successfully created.' })
        }
      >
        Default
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            variant: 'success',
            title: 'Filter updated',
            description: 'The saved filter has been updated.',
          })
        }
      >
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            variant: 'destructive',
            title: 'Failed to update the member role',
            description: 'You do not have permission to perform this action.',
          })
        }
      >
        Destructive
      </Button>
      <Button variant="outline" onClick={() => toast({ title: 'Copied to clipboard' })}>
        Title only
      </Button>
    </div>
  );
});

/** Fire several: they stack, collapsed behind the newest, and expand on hover. */
export const Stack = createPreview(() => {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      onClick={() => {
        toast({ title: 'Schema published', description: 'Version 3f9a is live on the CDN.' });
        toast({
          variant: 'destructive',
          title: 'Failed to update the alert',
          description: 'Channel "Slack #alerts" no longer exists.',
        });
        toast({ variant: 'success', title: 'Member role updated' });
        toast({ title: 'Invitation sent', description: 'user@the-guild.dev will get an email.' });
      }}
    >
      Fire four (the limit is three)
    </Button>
  );
});

/** A server error as most descriptions are: long, and sticky until read. */
export const LongError = createPreview(() => {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast({
          variant: 'destructive',
          title: 'Schema composition failed',
          description:
            'Field "User.email" is defined in subgraph "accounts" but is not resolvable from subgraph "reviews". Check that the field is marked @shareable or resolvable via @key.',
        })
      }
    >
      Fire a long error
    </Button>
  );
});

/** `duration` overrides the variant's timeout; the join page keeps its welcome up for 10s. */
export const Duration = createPreview(() => {
  const { toast } = useToast();
  return (
    <div className={styles.div2}>
      <Button
        variant="outline"
        onClick={() =>
          toast({
            title: 'Welcome to the-guild',
            description: 'You can switch organizations from the avatar menu.',
            duration: 10_000,
          })
        }
      >
        10s
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const { dismiss } = toast({ title: 'Dismissed by code in 1.5s', duration: 0 });
          setTimeout(dismiss, 1500);
        }}
      >
        Sticky, then dismiss()
      </Button>
    </div>
  );
});

export const Playground = createPreview({
  controls: {
    variant: { type: 'radio', options: ['default', 'success', 'destructive'], default: 'default' },
    title: { type: 'text', default: 'Schema published' },
    description: { type: 'text', default: 'Version 3f9a is live on the CDN.' },
    duration: {
      type: 'select',
      options: ['variant default', '2s', '10s', 'sticky'],
      default: 'variant default',
      derive: d => ({ '2s': 2000, '10s': 10_000, sticky: 0 })[d],
    },
  },
  render: v => {
    const { toast } = useToast();
    return (
      <Button
        variant="outline"
        onClick={() =>
          toast({
            variant: v.variant as ToastVariant,
            title: v.title || undefined,
            description: v.description || undefined,
            duration: v.duration as number | undefined,
          })
        }
      >
        Fire toast
      </Button>
    );
  },
});
