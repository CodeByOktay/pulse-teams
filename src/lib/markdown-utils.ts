export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // images ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // links [text](url) -> text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // headers
  text = text.replace(/^#{1,6}\s+/gm, "");
  // bold/italic (*** / ___ / ** / __ / * / _)
  text = text.replace(/(\*\*\*|___)(.*?)\1/g, "$2");
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  // inline code
  text = text.replace(/`([^`]*)`/g, "$1");
  // blockquote markers
  text = text.replace(/^>\s?/gm, "");
  // unordered/ordered list markers
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  // horizontal rules
  text = text.replace(/^-{3,}\s*$/gm, "");

  return text;
}

export function truncateMarkdown(markdown: string, maxLength: number): string {
  if (markdown.length <= maxLength) {
    return markdown;
  }

  let truncated = markdown.slice(0, maxLength);

  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }

  const boldCount = (truncated.match(/\*\*/g) ?? []).length;
  if (boldCount % 2 !== 0) {
    const lastBold = truncated.lastIndexOf("**");
    if (lastBold >= 0) {
      truncated = truncated.slice(0, lastBold).trimEnd();
    }
  }

  const codeCount = (truncated.match(/`/g) ?? []).length;
  if (codeCount % 2 !== 0) {
    const lastCode = truncated.lastIndexOf("`");
    if (lastCode >= 0) {
      truncated = truncated.slice(0, lastCode).trimEnd();
    }
  }

  return `${truncated.trimEnd()}...`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
