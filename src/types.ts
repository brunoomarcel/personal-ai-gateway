export type ChatMessage = { role: 'system'|'user'|'assistant'|'developer'; content: string };
export type InferenceRequest = { model: string; messages: ChatMessage[]; stream?: boolean; instructions?: string };
export type InferenceChunk = { delta: string; done?: boolean };
export interface InferenceProvider {
  readonly name: string;
  status(): Promise<{ authenticated: boolean; account?: string; models: string[] }>;
  models(): Promise<string[]>;
  complete(request: InferenceRequest): Promise<{ text: string; model: string; usage: { input_tokens: number; output_tokens: number } }>;
  stream(request: InferenceRequest): AsyncGenerator<InferenceChunk>;
}
