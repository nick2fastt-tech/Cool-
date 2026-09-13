export interface ImageRequest {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  signal?: AbortSignal;
}

export interface GeneratedImage {
  /** Either a remote https URL or a data: URL, depending on the provider. */
  url: string;
  width: number;
  height: number;
  prompt: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  requiredEnvVar(): string;
  generate(req: ImageRequest): Promise<GeneratedImage>;
}
