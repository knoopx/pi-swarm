"use client";

import type { HTMLAttributes } from "react";
import { cn } from "src/lib/utils";
import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import rust from "highlight.js/lib/languages/rust";

// Register languages
hljs.registerLanguage("json", json);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shellscript", bash);
hljs.registerLanguage("rust", rust);

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
  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [code, language]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-[#0d1117] text-[#e6edf3]",
        className,
      )}
      {...props}
    >
      <pre className="overflow-auto p-3 text-xs">
        <code
          className={cn("font-mono", showLineNumbers && "pl-8")}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
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
