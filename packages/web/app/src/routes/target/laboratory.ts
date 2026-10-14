import { requireLayoutFlag } from '@/lib/route-utils';
import { TargetLaboratoryPage } from '@/pages/target-laboratory-new';
import { createRoute } from '@tanstack/react-router';
import { targetRoute } from './route';

export const targetLaboratoryRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'laboratory',
  validateSearch: () => ({}) as { operation?: string; operationString?: string },
  loader: loader => requireLayoutFlag.target(loader, 'viewerCanViewLaboratory'),
  component: TargetLaboratoryPage,
});
