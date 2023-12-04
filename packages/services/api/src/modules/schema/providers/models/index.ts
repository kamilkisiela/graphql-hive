import { Provider } from 'graphql-modules';
import { CompositeModel } from './composite';
import { SingleModel } from './single';

export const models: Provider[] = [SingleModel, CompositeModel];
