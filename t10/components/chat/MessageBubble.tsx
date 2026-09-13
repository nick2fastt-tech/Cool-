"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { ImageGenerating, ImageResult } from "./ImageResult";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { IconAlert, IconCheck, IconCopy, IconRefresh } from "@/components/ui/icons";
import { Wordmark } from "@/components/brand/Wordmark";
import type { ChatMessage } from "@/lib/storage/types";
import { clsx } from "@/lib/utils";

interface Props {
  message: ChatMessage;
  streaming?: boolean;
  generatingImage?: boolean;
  onRegenerate?: () => void;
  onImageRegenerate?: () => void;
  onImageVariation?: () => void;
}

/**
 * Model output is rendered through react-markdown, which builds a React tree
 * rather than injecting HTML, so raw HTML in a response cannot execute.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  streaming,
  generatingImage,
  onRegenerate,
  onImageRegenerate,
  onImageVariation,
}: Props) {
  if (message.role === "user") return <UserMessage message={message} />;
  return (
    <AssistantMessage
      message={message}
      streaming={streaming}
      generatingImage={generatingImage}
      onRegenerate={onRegenerate}
      onImageRegenerate={onImageRegenerate}
      onImageVariation={onImageVariation}
    />
  );
});

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <article className="flex animate-fade-up justify-end" aria-label="Your message">
      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line bg-raised px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </article>
  );
}

function AssistantMessage({
  message,
  streaming,
  generatingImage,
  onRegenerate,
  onImageRegenerate,
  onImageVariation,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const hasBody = message.content.trim().length > 0;

  return (
    <article className="animate-fade-up" aria-label={`${message.modelName ?? "T10"} response`}>
      <header className="mb-2 flex items-center gap-2">
        <Wordmark className="text-[13px]" showDot={false} />
        {message.modelName && (
          <span className="text-[12px] font-medium text-ink-muted">{message.modelName}</span>
        )}
        {message.demo && (
          <span
            className="rounded-[5px] border border-warn/40 bg-warn/10 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-warn"
            title="Served by the local demo adapter, not a T10 model"
          >
            Demo mode
          </span>
        )}
      </header>

      {message.error ? (
        <ErrorCard error={message.error} onRetry={onRegenerate} />
      ) : (
        <>
          {streaming && !hasBody && !generatingImage && (
            <ThinkingIndicator label={message.reasoningMode === "thinking" ? undefined : "Responding"} trace={message.thinking} />
          )}

          {generatingImage && message.imagePrompt && <ImageGenerating prompt={message.imagePrompt} />}

          {message.image && (
            <ImageResult
              image={message.image}
              onRegenerate={onImageRegenerate}
              onVariation={onImageVariation}
              busy={generatingImage}
            />
          )}

          {hasBody && (
            <div className={clsx("t10-prose", streaming && "t10-caret")}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const raw = String(children ?? "");
                    const match = /language-(\w+)/.exec(className || "");
                    const isBlock = match || raw.includes("\n");
                    if (!isBlock) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                    return <CodeBlock code={raw.replace(/\n$/, "")} language={match?.[1]} />;
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  a({ href, children }) {
                    const external = href?.startsWith("http");
                    return (
                      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {!streaming && hasBody && (
            <div className="mt-2.5 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/thread:opacity-100 md:opacity-0 [article:hover>&]:opacity-100">
              <IconButton onClick={copy} label={copied ? "Copied" : "Copy response"}>
                {copied ? <IconCheck className="h-4 w-4 text-ok" /> : <IconCopy className="h-4 w-4" />}
              </IconButton>
              {onRegenerate && (
                <IconButton onClick={onRegenerate} label="Regenerate response">
                  <IconRefresh className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-ink-muted transition hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: NonNullable<ChatMessage["error"]>;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-danger/35 bg-danger/[0.07] p-4" role="alert">
      <div className="flex gap-3">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">{error.message}</p>
          {error.hint && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{error.hint}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-[13px] font-medium text-ink transition hover:border-accent/50"
              >
                <IconRefresh className="h-3.5 w-3.5" /> Try again
              </button>
            )}
            {error.docs && (
              <a
                href={error.docs}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-accent transition hover:bg-accent/10"
              >
                View setup guide
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
