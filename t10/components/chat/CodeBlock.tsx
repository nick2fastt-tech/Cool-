"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconDownload } from "@/components/ui/icons";
import { clsx } from "@/lib/utils";

const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX",
  py: "Python", python: "Python", rb: "Ruby", sh: "Shell", bash: "Bash", zsh: "Shell",
  html: "HTML", css: "CSS", scss: "SCSS", json: "JSON", yaml: "YAML", yml: "YAML",
  sql: "SQL", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", swift: "Swift",
  c: "C", cpp: "C++", cs: "C#", php: "PHP", lua: "Lua", md: "Markdown", diff: "Diff",
};

const EXTENSIONS: Record<string, string> = {
  javascript: "js", typescript: "ts", python: "py", bash: "sh", shell: "sh",
  markdown: "md", rust: "rs", golang: "go",
};

/**
 * Syntax-highlighted code block.
 *
 * highlight.js is imported dynamically so it is code-split out of the initial
 * bundle, and highlighting is applied to a DOM node we control rather than
 * through dangerouslySetInnerHTML on model output.
 */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = (language || "").toLowerCase();
  const label = LANGUAGE_LABELS[lang] || (lang ? lang.toUpperCase() : "Code");

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    if (!node) return;

    // Always render the plain text first; highlighting is a progressive
    // enhancement that must never be able to inject markup.
    node.textContent = code;

    (async () => {
      try {
        const { default: hljs } = await import("highlight.js/lib/common");
        if (cancelled || !ref.current) return;
        const result = lang && hljs.getLanguage(lang)
          ? hljs.highlight(code, { language: lang, ignoreIllegals: true })
          : hljs.highlightAuto(code);
        ref.current.innerHTML = result.value;
      } catch {
        /* Highlighting unavailable - plain text is already rendered. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    try {
      const ext = EXTENSIONS[lang] || lang || "txt";
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `t10-snippet.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download unsupported in this context */
    }
  };

  const lineCount = code.split("\n").length;

  return (
    <figure className="group my-4 overflow-hidden rounded-xl border border-line bg-surface">
      <figcaption className="flex items-center gap-2 border-b border-line bg-raised px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</span>
        <span className="text-[11px] text-ink-muted/70">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={download}
            className="rounded-md p-1.5 text-ink-muted transition hover:bg-line/60 hover:text-ink"
            aria-label={`Download ${label} snippet`}
            title="Download snippet"
          >
            <IconDownload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={copy}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium transition",
              copied ? "text-ok" : "text-ink-muted hover:bg-line/60 hover:text-ink",
            )}
            aria-label={copied ? "Copied to clipboard" : `Copy ${label} code`}
          >
            {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </figcaption>
      <pre className="max-h-[32rem] overflow-auto p-4 text-[13px] leading-[1.65]">
        <code ref={ref} className={clsx("font-mono", lang && `language-${lang}`)} />
      </pre>
    </figure>
  );
}
