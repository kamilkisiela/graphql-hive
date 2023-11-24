import type { CompositionErrorSource } from './orchestrators';

export type SchemaType = 'single' | 'federation' | 'stitching';

export type ComposeAndValidateInput = Array<{
  raw: string;
  source: string;
  url?: string | null;
}>;

export type ComposeAndValidateOutput = {
  errors: Array<{
    message: string;
    source: CompositionErrorSource;
  }>;
  sdl: string | null;
  supergraph: string | null;
  contracts: Array<{
    id: string;
    errors: Array<{
      message: string;
      source: CompositionErrorSource;
    }>;
    sdl: string | null;
    supergraph: string | null;
  }> | null;
};

export type ExternalComposition = {
  endpoint: string;
  encryptedSecret: string;
  broker: {
    endpoint: string;
    signature: string;
  } | null;
} | null;
