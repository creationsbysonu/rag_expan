const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const EMBEDDING_MODEL = Deno.env.get("GEMINI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
export const CHAT_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-2.5-flash";
export const EMBEDDING_DIMS = 768;

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured for this project");
  return key;
}

async function assertOk(response: Response, label: string) {
  if (response.ok) return;
  const detail = await response.text();
  throw new Error(`${label} failed (${response.status}): ${detail.slice(0, 400)}`);
}

/** Query embedding — asymmetric RETRIEVAL_QUERY task type. */
export async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(
    `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMS,
      }),
    },
  );
  await assertOk(response, "Embedding");
  const payload = (await response.json()) as { embedding?: { values?: number[] } };
  const values = payload.embedding?.values;
  if (!values?.length) throw new Error("Embedding response was empty");
  return values;
}

/** Document embeddings — RETRIEVAL_DOCUMENT task type, batched. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const batchSize = 16;
  const vectors: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += batchSize) {
    const batch = texts.slice(offset, offset + batchSize);
    const response = await fetch(
      `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: EMBEDDING_DIMS,
          })),
        }),
      },
    );
    await assertOk(response, "Batch embedding");
    const payload = (await response.json()) as { embeddings?: { values: number[] }[] };
    const batchVectors = payload.embeddings?.map((item) => item.values) ?? [];
    if (batchVectors.length !== batch.length) {
      throw new Error("Batch embedding returned a mismatched number of vectors");
    }
    vectors.push(...batchVectors);
  }

  return vectors;
}

interface GenerateArgs {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

/** Streams plain text deltas from Gemini's SSE endpoint. */
export async function* generateStream({
  system,
  prompt,
  temperature = 0.25,
  maxOutputTokens = 1400,
  signal,
}: GenerateArgs): AsyncGenerator<string> {
  const response = await fetch(
    `${API_BASE}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          topP: 0.9,
        },
        safetySettings: [],
      }),
    },
  );
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
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        for (const part of parsed.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) yield part.text;
        }
      } catch {
        // Ignore partial frames; the next read completes them.
      }
    }
  }
}
