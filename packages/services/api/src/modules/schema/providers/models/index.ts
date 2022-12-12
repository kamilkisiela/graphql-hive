import { Provider } from 'graphql-modules';
import { FederationModel } from './federation';
import { FederationLegacyModel } from './federation-legacy';
import { SingleModel } from './single';
import { SingleLegacyModel } from './single-legacy';
import { StitchingModel } from './stitching';
import { StitchingLegacyModel } from './stitching-legacy';

export const models: Provider[] = [
  SingleModel,
  FederationModel,
  StitchingModel,
  SingleLegacyModel,
  FederationLegacyModel,
  StitchingLegacyModel,
];
