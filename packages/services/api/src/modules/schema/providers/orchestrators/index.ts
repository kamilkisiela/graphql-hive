import { Provider } from 'graphql-modules';
import { CustomOrchestrator } from './custom';
import { FederationOrchestrator } from './federation';
import { SingleOrchestrator } from './single';
import { StitchingOrchestrator } from './stitching';

export const orchestrators: Provider[] = [
  SingleOrchestrator,
  FederationOrchestrator,
  StitchingOrchestrator,
  CustomOrchestrator,
];
