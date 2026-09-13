import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_MODEL_ID, listPublicModels } from "@/lib/models/registry";

export const metadata: Metadata = {
  title: "Chat",
  // The application surface is private: never index it, never follow from it.
  robots: { index: false, follow: false, nocache: true },
};

export default function ChatPage() {
  // Model catalogue is resolved on the server; no provider detail crosses over.
  const models = listPublicModels().filter((m) => m.status === "available");

  return (
    <ToastProvider>
      <ChatShell models={models} defaultModelId={DEFAULT_MODEL_ID} />
    </ToastProvider>
  );
}
