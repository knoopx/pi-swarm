import { useMemo } from "react";
import { html, parse } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

interface DiffViewerProps {
  diff: string;
  className?: string;
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const diffHtml = useMemo(() => {
    if (!diff) return "";

    const parsed = parse(diff);
    return html(parsed, {
      drawFileList: false,
      matching: "lines",
      outputFormat: "side-by-side",
    });
  }, [diff]);

  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No changes
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className || ""}`}>
      <div
        className="diff2html-wrapper"
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
    </div>
  );
}
