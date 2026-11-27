import type { Metadata } from "next";
import { EmbedChat } from "@/components/embed/embed-chat";

export const metadata: Metadata = {
  title: "अभिलेख — embedded",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ accent?: string }>;
}) {
  const { accent } = await searchParams;
  const safe = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : undefined;

  return <EmbedChat accent={safe} />;
}
