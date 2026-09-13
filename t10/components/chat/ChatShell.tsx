"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatComposer, type ComposerHandle } from "./ChatComposer";
import { ChatSidebar } from "./ChatSidebar";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";
import { ModelSelector } from "./ModelSelector";
import { SettingsPanel } from "./SettingsPanel";
import { IconMenu, IconPlus } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { extractImagePrompt, isImageRequest } from "@/lib/chat/intent";
import { generateImage, streamChat } from "@/lib/chat/client";
import type { PublicModel } from "@/lib/models/types";
import { conversationStore } from "@/lib/storage/local";
import type { ChatMessage, Conversation } from "@/lib/storage/types";
import { titleFromMessage, uid } from "@/lib/utils";

const ACTIVE_KEY = "t10:active-conversation";
const MODEL_KEY = "t10:model";

export function ChatShell({ models, defaultModelId }: { models: PublicModel[]; defaultModelId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modelId, setModelId] = useState(defaultModelId);
  const [reasoningMode, setReasoningMode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottom = useRef(true);
  const { notify } = useToast();

  const model = models.find((m) => m.id === modelId) ?? models[0];

  /* ---------------------------------------------------------------- boot */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await conversationStore.list();
      if (cancelled) return;
      setConversations(all);

      try {
        const storedModel = localStorage.getItem(MODEL_KEY);
        if (storedModel && models.some((m) => m.id === storedModel)) setModelId(storedModel);

        const storedActive = localStorage.getItem(ACTIVE_KEY);
        const found = storedActive ? all.find((c) => c.id === storedActive) : null;
        if (found) {
          setActiveId(found.id);
          setMessages(found.messages);
        }
      } catch {
        /* storage unavailable - run without persistence */
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [models]);

  // Keep reasoning mode coherent with the selected model.
  useEffect(() => {
    if (!model) return;
    setReasoningMode((current) => {
      const stillValid = model.reasoningModes.some((r) => r.id === current && r.status === "available");
      return stillValid ? current : model.defaultReasoningMode;
    });
  }, [model]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MODEL_KEY, modelId);
    } catch {
      /* ignore */
    }
  }, [modelId, hydrated]);

  /* ------------------------------------------------------------ scrolling */
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom(messages.length > 1);
  }, [messages, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  /* --------------------------------------------------------- persistence */
  const persist = useCallback(
    async (msgs: ChatMessage[], id: string | null, titleSeed?: string) => {
      const convoId = id ?? uid();
      const existing = conversations.find((c) => c.id === convoId);
      const conversation: Conversation = {
        id: convoId,
        title: existing?.title ?? titleFromMessage(titleSeed ?? msgs.find((m) => m.role === "user")?.content ?? ""),
        modelId,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        messages: msgs,
      };

      await conversationStore.save(conversation);
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== convoId);
        return [conversation, ...next].sort((a, b) => b.updatedAt - a.updatedAt);
      });

      if (!id) {
        setActiveId(convoId);
        try {
          localStorage.setItem(ACTIVE_KEY, convoId);
        } catch {
          /* ignore */
        }
      }
      return convoId;
    },
    [conversations, modelId],
  );

  /* -------------------------------------------------------------- sending */
  const runTurn = useCallback(
    async (history: ChatMessage[], convoId: string | null, seed: string) => {
      const assistantId = uid();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        modelId: model.id,
        modelName: model.name,
        reasoningMode,
      };

      setMessages([...history, placeholder]);
      setBusy(true);
      stickToBottom.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      const wantsImage = model.capabilities.images && isImageRequest(lastUser);

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        if (wantsImage) {
          const prompt = extractImagePrompt(lastUser);
          patch((m) => ({ ...m, imagePrompt: prompt }));
          setGeneratingImage(true);

          const { image, error } = await generateImage({ modelId: model.id, prompt }, controller.signal);
          setGeneratingImage(false);

          if (error) {
            patch((m) => ({ ...m, error, imagePrompt: undefined }));
          } else if (image) {
            patch((m) => ({ ...m, image, content: `Here is the image you asked for.` }));
          }
        } else {
          let acc = "";
          let think = "";

          await streamChat(
            {
              modelId: model.id,
              reasoningMode,
              messages: history.map((m) => ({ role: m.role, content: m.content })),
            },
            {
              onMeta: (meta) => patch((m) => ({ ...m, demo: meta.demo, modelName: meta.modelName })),
              onThinking: (t) => {
                think = `${think} ${t}`.trim().slice(-400);
                patch((m) => ({ ...m, thinking: think }));
              },
              onDelta: (t) => {
                acc += t;
                patch((m) => ({ ...m, content: acc }));
              },
              onError: (err) => patch((m) => ({ ...m, error: err })),
            },
            controller.signal,
          );
        }
      } finally {
        setBusy(false);
        setGeneratingImage(false);
        abortRef.current = null;

        setMessages((current) => {
          void persist(current, convoId, seed);
          return current;
        });
      }
    },
    [model, reasoningMode, persist],
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;

      const userMessage: ChatMessage = { id: uid(), role: "user", content: clean, createdAt: Date.now() };
      const history = [...messages, userMessage];

      setMessages(history);
      setInput("");

      const convoId = await persist(history, activeId, clean);
      await runTurn(history, convoId, clean);
    },
    [busy, messages, activeId, persist, runTurn],
  );

  const regenerate = useCallback(async () => {
    if (busy) return;
    // Drop trailing assistant turns, then re-run the last user turn.
    const trimmed = [...messages];
    while (trimmed.length && trimmed[trimmed.length - 1].role === "assistant") trimmed.pop();
    if (!trimmed.length) return;
    setMessages(trimmed);
    await runTurn(trimmed, activeId, trimmed[trimmed.length - 1].content);
  }, [busy, messages, activeId, runTurn]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setGeneratingImage(false);
  }, []);

  /* --------------------------------------------------------- conversations */
  const newChat = useCallback(() => {
    stop();
    setMessages([]);
    setActiveId(null);
    setInput("");
    setSidebarOpen(false);
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    composerRef.current?.focus();
  }, [stop]);

  const openConversation = useCallback(
    async (id: string) => {
      stop();
      const convo = await conversationStore.get(id);
      if (!convo) return;
      setActiveId(id);
      setMessages(convo.messages);
      if (models.some((m) => m.id === convo.modelId)) setModelId(convo.modelId);
      setSidebarOpen(false);
      try {
        localStorage.setItem(ACTIVE_KEY, id);
      } catch {
        /* ignore */
      }
    },
    [models, stop],
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    const convo = await conversationStore.get(id);
    if (!convo) return;
    const updated = { ...convo, title, updatedAt: Date.now() };
    await conversationStore.save(updated);
    setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await conversationStore.remove(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) newChat();
      notify("Conversation deleted.");
    },
    [activeId, newChat, notify],
  );

  const clearAll = useCallback(async () => {
    await conversationStore.clear();
    setConversations([]);
    newChat();
  }, [newChat]);

  /* ------------------------------------------------------------- rendering */
  if (!model) return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onSelect={openConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onOpenSettings={() => {
          setSettingsOpen(true);
          setSidebarOpen(false);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-1.5 border-b border-line px-2 py-2 sm:px-3"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat history"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted transition hover:bg-raised hover:text-ink lg:hidden"
          >
            <IconMenu className="h-5 w-5" />
          </button>

          <ModelSelector
            models={models}
            activeModelId={modelId}
            reasoningMode={reasoningMode}
            onSelectModel={setModelId}
            onSelectReasoning={setReasoningMode}
          />

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/models"
              className="hidden rounded-xl px-3 py-2 text-[13.5px] font-medium text-ink-muted transition hover:bg-raised hover:text-ink sm:block"
            >
              Models
            </Link>
            <button
              type="button"
              onClick={newChat}
              aria-label="New chat"
              title="New chat"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted transition hover:bg-raised hover:text-ink"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main id="main" ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto min-h-full w-full max-w-thread px-4 sm:px-6">
            {messages.length === 0 ? (
              <EmptyState model={model} onPick={(prompt) => void send(prompt)} />
            ) : (
              <div className="group/thread space-y-7 py-6">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      streaming={busy && isLast && m.role === "assistant"}
                      generatingImage={generatingImage && isLast && m.role === "assistant"}
                      onRegenerate={isLast && m.role === "assistant" && !busy ? regenerate : undefined}
                      onImageRegenerate={
                        m.image && !busy ? () => void send(`Create an image of ${m.image!.prompt}`) : undefined
                      }
                      onImageVariation={
                        m.image && !busy
                          ? () => void send(`Create another variation of an image of ${m.image!.prompt}`)
                          : undefined
                      }
                    />
                  );
                })}
                <div ref={bottomRef} className="h-px" />
              </div>
            )}
          </div>
        </main>

        <div
          className="shrink-0 px-3 pb-3 sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto w-full max-w-thread">
            <ChatComposer
              ref={composerRef}
              value={input}
              onChange={setInput}
              onSubmit={() => void send(input)}
              onStop={stop}
              busy={busy}
              model={model}
              reasoningMode={reasoningMode}
            />
          </div>
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        model={model}
        onClearAll={clearAll}
        conversationCount={conversations.length}
      />
    </div>
  );
}
