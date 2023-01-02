import { Provider } from 'graphql-modules';
import { CompositeModel } from './composite';
import { FederationLegacyModel } from './federation-legacy';
import { SingleModel } from './single';
import { SingleLegacyModel } from './single-legacy';
import { StitchingLegacyModel } from './stitching-legacy';

export const models: Provider[] = [
  SingleModel,
  CompositeModel,
  SingleLegacyModel,
  FederationLegacyModel,
  StitchingLegacyModel,
];
