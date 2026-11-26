// Provider abstraction for embeddings + chat generation.
//
//   LLM_PROVIDER=gemini       Google AI Studio (1,000 embeddings/day free)
//   LLM_PROVIDER=cloudflare   Cloudflare Workers AI (10,000 neurons/day free)
//
// Both produce 1024-dimensional vectors, so the pgvector schema is shared.
// Cloudflare is OpenAI-compatible: one token covers embeddings and chat.
//
// Every call accepts optional per-request credentials so a visitor can supply
// their own key (sent as the x-llm-key header) when the deployment's key is
// exhausted. Keys are used for that request only and are never stored.

import {
  embedDocuments as geminiEmbedDocuments,
  embedQuery as geminiEmbedQuery,
  generateStream as geminiGenerateStream,
  type GenerateArgs,
} from "./gemini.ts";

/** bge-m3 / qwen3-embedding output 1024; bge-base-en would be 768. */
export const EMBEDDING_DIMS = 1024;

export type Provider = "gemini" | "cloudflare";

export interface Credentials {
  provider: Provider;
  apiKey: string;
}

function envProvider(): Provider {
  return (Deno.env.get("LLM_PROVIDER") ?? "gemini").toLowerCase() === "cloudflare"
    ? "cloudflare"
    : "gemini";
}

function cloudflare(apiKeyOverride?: string) {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = apiKeyOverride || Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !token) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set for LLM_PROVIDER=cloudflare",
    );
  }
  return {
    base: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    token,
    embedModel: Deno.env.get("CF_EMBED_MODEL") ?? "@cf/baai/bge-m3",
    chatModel: Deno.env.get("CF_CHAT_MODEL") ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  };
}

async function assertOk(response: Response, label: string) {
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(`${label} failed (${response.status}): ${detail.slice(0, 400)}`);
}

/** bge-m3 handles long inputs; keep requests bounded. */
const CF_MAX_CHARS = 8000;

async function cloudflareEmbed(texts: string[], apiKeyOverride?: string): Promise<number[][]> {
  const { base, token, embedModel } = cloudflare(apiKeyOverride);
  const response = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: embedModel,
      input: texts.map((text) => text.slice(0, CF_MAX_CHARS)),
    }),
  });
  await assertOk(response, "Cloudflare embedding");

  const payload = (await response.json()) as { data?: { embedding?: number[] }[] };
  const vectors = (payload.data ?? []).map((item) => item.embedding ?? []);
  if (vectors.length !== texts.length) {
    throw new Error("Cloudflare embedding returned a mismatched number of vectors");
  }
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMS) {
      throw new Error(
        `Embedding model ${embedModel} returned ${vector.length} dimensions, expected ${EMBEDDING_DIMS}`,
      );
    }
  }
  return vectors;
}

/** The deployment's own provider, used when a request brings no key. */
export function serverProvider(): Provider {
  return envProvider();
}

function useProvider(creds?: Credentials): Provider {
  return creds?.provider ?? envProvider();
}

export async function embedQuery(text: string, creds?: Credentials): Promise<number[]> {
  if (useProvider(creds) === "cloudflare") {
    const [vector] = await cloudflareEmbed([text], creds?.apiKey);
    return vector;
  }
  return geminiEmbedQuery(text, creds?.apiKey);
}

export async function embedDocuments(texts: string[], creds?: Credentials): Promise<number[][]> {
  if (useProvider(creds) === "cloudflare") {
    const vectors: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += 16) {
      vectors.push(
        ...(await cloudflareEmbed(texts.slice(offset, offset + 16), creds?.apiKey)),
      );
    }
    return vectors;
  }
  return geminiEmbedDocuments(texts, creds?.apiKey);
}

/** Streams plain text deltas, whichever provider is configured. */
export async function* generateStream(
  args: GenerateArgs,
  creds?: Credentials,
): AsyncGenerator<string> {
  if (useProvider(creds) !== "cloudflare") {
    yield* geminiGenerateStream({ ...args, apiKey: creds?.apiKey ?? args.apiKey });
    return;
  }

  const { base, token, chatModel } = cloudflare(creds?.apiKey);
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify({
      model: chatModel,
      stream: true,
      temperature: args.temperature ?? 0.25,
      max_tokens: args.maxOutputTokens ?? 1400,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
    }),
  });
  await assertOk(response, "Generation");

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Generation stream was empty");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Partial frame; the next read completes it.
      }
    }
  }
}

export type { GenerateArgs };
