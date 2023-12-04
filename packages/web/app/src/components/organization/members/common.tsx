import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Role<T> = {
  id: string;
  name: string;
  description: string;
} & T;

export function RoleSelector<T>(props: {
  roles: readonly Role<T>[];
  defaultRole?: Role<T>;
  isRoleActive(role: Role<T>):
    | boolean
    | {
        active: boolean;
        reason?: string;
      };
  disabled?: boolean;
  onSelect(role: Role<T>): void | Promise<void>;
  /**
   * It's only needed for the migration flow, where we need to be able to select no role.
   * This is going to be removed once we migrate all the users.
   */
  onNoRole?(): void;
  onBlur?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'busy'>('idle');
  const isBusy = phase === 'busy';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="ml-auto"
          disabled={props.disabled === true || isBusy}
          onClick={() => {
            props.onBlur?.();
          }}
        >
          {props.defaultRole?.name ?? 'Select role'}
          <ChevronDownIcon className="text-muted-foreground ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Select new role..." />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {props.onNoRole ? (
                <CommandItem
                  className={cn('flex cursor-pointer flex-col items-start space-y-1 px-4 py-2')}
                  onSelect={() => {
                    if (props.onNoRole) {
                      props.onNoRole();
                      setOpen(false);
                    }
                  }}
                >
                  <p>None</p>
                  <p className="text-muted-foreground text-sm">Do not assign a role</p>
                </CommandItem>
              ) : null}
              {props.roles.map(role => {
                const isRoleActiveResult = props.isRoleActive(role);
                const isActive =
                  typeof isRoleActiveResult === 'boolean'
                    ? isRoleActiveResult
                    : isRoleActiveResult.active;
                const reason =
                  typeof isRoleActiveResult === 'boolean' ? undefined : isRoleActiveResult.reason;

                return (
                  <TooltipProvider key={role.id}>
                    <Tooltip delayDuration={200} {...(isActive ? { open: false } : {})}>
                      <TooltipTrigger className="w-full text-left">
                        <CommandItem
                          onSelect={() => {
                            setPhase('busy');
                            setOpen(false);
                            void Promise.resolve(props.onSelect(role)).finally(() => {
                              setPhase('idle');
                            });
                          }}
                          className={cn(
                            'flex cursor-pointer flex-col items-start space-y-1 px-4 py-2',
                            isActive ? '' : 'cursor-not-allowed opacity-50',
                          )}
                          disabled={!isActive}
                        >
                          <p>{role.name}</p>
                          <p className="text-muted-foreground text-sm">{role.description}</p>
                        </CommandItem>
                      </TooltipTrigger>
                      <TooltipContent>{reason}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
