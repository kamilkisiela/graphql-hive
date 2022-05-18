import { Provider } from 'graphql-modules';
import { SingleOrchestrator } from './single';
import { FederationOrchestrator } from './federation';
import { StitchingOrchestrator } from './stitching';
import { CustomOrchestrator } from './custom';

export const orchestrators: Provider[] = [
  SingleOrchestrator,
  FederationOrchestrator,
  StitchingOrchestrator,
  CustomOrchestrator,
];
