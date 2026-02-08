"use client";

import type { HTMLAttributes } from "react";
import { cn } from "src/lib/utils";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
};

export const CodeBlock = ({
  code,
  language = "plaintext",
  showLineNumbers = false,
  className,
  ...props
}: CodeBlockProps) => {
  const [highlighted, setHighlighted] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const highlight = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language === "shellscript" ? "bash" : language,
          theme: "github-dark",
        });
        if (!cancelled) {
          setHighlighted(html);
        }
      } catch {
        if (!cancelled) {
          const escaped = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          setHighlighted(`<pre><code>${escaped}</code></pre>`);
        }
      }
    };

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-base01 text-base05 [&_pre]:!bg-transparent [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:text-xs [&_code]:font-mono",
        showLineNumbers && "[&_code]:pl-8",
        className,
      )}
      {...props}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

export const CodeBlockContainer = CodeBlock;
export const CodeBlockContent = ({
  code,
  language,
}: {
  code: string;
  language: string;
}) => <CodeBlock code={code} language={language} />;
