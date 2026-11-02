export interface SampleInput {
  title: string;
  domain: string;
  version: string;
  rawText: string;
}
export interface BlindDocument {
  label: 'A' | 'B';
  markdown: string;
}
export interface ExampleRepository {
  listSamples(): Promise<SampleInput[]>;
  getBlindDocuments(): Promise<BlindDocument[]>;
  getBlindMapping(): Promise<Record<'A' | 'B', string>>;
}
