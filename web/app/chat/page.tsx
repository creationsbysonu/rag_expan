import type { Metadata } from "next";
import { ChatWorkbench } from "@/components/chat/chat-workbench";

export const metadata: Metadata = {
  title: "Ask the record",
  description:
    "Ask questions across Nepal's government notices, directives and constitutional text. Every answer arrives with its source passages.",
};

export default function ChatPage() {
  return <ChatWorkbench />;
}
