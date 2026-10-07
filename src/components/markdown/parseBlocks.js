/** Recognize fenced blocks before inline Markdown, preserving code whitespace. */
export function parseMarkdownBlocks(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], start = i;
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const code = [];
      for (i++; i < lines.length && !closing.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: 'code', index: start, language: fence[2].trim().split(/\s+/)[0] || 'text', value: code.join('\n') });
      continue;
    }
    const trimmed = line.trim();
    const delimiter = trimmed.startsWith('$$') ? ['$$', '$$'] : trimmed.startsWith('\\[') ? ['\\[', '\\]'] : null;
    if (delimiter) {
      const [open, close] = delimiter;
      if (trimmed.length > open.length + close.length && trimmed.endsWith(close)) {
        blocks.push({ type: 'math', index: start, value: trimmed.slice(open.length, -close.length).trim() });
        continue;
      }
      if (trimmed === open) {
        let end = i + 1;
        while (end < lines.length && lines[end].trim() !== close) end++;
        if (end < lines.length) {
          blocks.push({ type: 'math', index: start, value: lines.slice(i + 1, end).join('\n') });
          i = end;
          continue;
        }
      }
    }
    blocks.push({ type: 'line', index: start, value: line });
  }
  return blocks;
}
