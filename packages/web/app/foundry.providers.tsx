import { useEffect } from 'react';
import type { FoundryProvider } from 'react-foundry';
import { RouterProvider } from '@tanstack/react-router';
import { previewRouter, PreviewSlotProvider } from './foundry.router';
import { ThemeProvider, useTheme } from './src/components/theme/theme-provider';
import { TooltipProvider } from './src/components/ui/primitives/floating/tooltip/tooltip';
import { ToastProvider } from './src/components/ui/primitives/toast/toast';
import './src/styles';

/**
 * Foundry's toolbar owns the light/dark/system choice and hands down an already-resolved
 * mode, so we drive ThemeProvider to that explicit value rather than letting it follow
 * the OS itself. Both would otherwise be resolving 'system' independently.
 */
function ThemeSynchronizer({ theme }: { theme: 'light' | 'dark' }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  return null;
}

/**
 * Previews render inside a stand-in router so that app components using `Link` work here. See
 * `foundry.router.tsx` for why the preview content arrives through a context slot rather than as
 * children of the provider.
 */
export const Provider: FoundryProvider = ({ children, theme }) => (
  <ThemeProvider>
    <ThemeSynchronizer theme={theme} />
    <TooltipProvider>
      <ToastProvider>
        <PreviewSlotProvider value={children}>
          <RouterProvider router={previewRouter} />
        </PreviewSlotProvider>
      </ToastProvider>
    </TooltipProvider>
  </ThemeProvider>
);
