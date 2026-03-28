/**
 * Ambient module declarations for optional AI SDK dependencies.
 *
 * These packages are dynamically imported at runtime and may not be installed.
 * The stubs satisfy the TypeScript DTS builder without requiring the actual packages.
 */

declare module 'ai' {
  export function generateText(opts: Record<string, unknown>): Promise<{
    text: string;
    usage?: { promptTokens?: number; completionTokens?: number };
  }>;
}

declare module '@ai-sdk/anthropic' {
  export function anthropic(model: string): unknown;
}
