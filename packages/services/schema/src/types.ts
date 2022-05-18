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
