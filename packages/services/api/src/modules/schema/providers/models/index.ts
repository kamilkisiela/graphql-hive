import { Provider } from 'graphql-modules';
import { CompositeModel } from './composite';
import { CompositeLegacyModel } from './composite-legacy';
import { SingleModel } from './single';
import { SingleLegacyModel } from './single-legacy';

export const models: Provider[] = [
  SingleModel,
  CompositeModel,
  SingleLegacyModel,
  CompositeLegacyModel,
];
