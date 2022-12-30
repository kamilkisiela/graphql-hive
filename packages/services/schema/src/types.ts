export type SchemaType = 'single' | 'federation' | 'stitching';

export type BuildInput = Array<{
  raw: string;
  source: string;
}>;

export interface BuildOutput {
  source: string;
  raw: string;
}

export type ValidationInput = Array<{
  raw: string;
  source: string;
}>;

export interface ValidationOutput {
  errors: Array<{
    message: string;
    // If it has code, it's not coming from GraphQL-js validation
    code?: string | null;
  }>;
}

export type SupergraphInput = Array<{
  raw: string;
  source: string;
  url?: string | null;
}>;

export type SupergraphOutput = {
  supergraph: string | null;
};

export type ExternalComposition = {
  endpoint: string;
  encryptedSecret: string;
  broker: {
    endpoint: string;
    signature: string;
  } | null;
} | null;
