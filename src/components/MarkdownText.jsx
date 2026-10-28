import MathFormula from './MathFormula.jsx';
import MarkdownInline from './markdown/MarkdownInline.jsx';
import MarkdownCodeBlock from './markdown/MarkdownCodeBlock.jsx';
import { parseMarkdownBlocks } from './markdown/parseBlocks.js';
import './markdown/markdown-blocks.css';

export default function MarkdownText({ source = '', colorRanges = [] }) {
  const offsets = [0];
  for (const match of String(source).matchAll(/\r\n|\r|\n/g)) offsets.push(match.index + match[0].length);
  const blocks = [];
  let listType = null;
  let listItems = [];
  const flushList = () => {
    if (!listType) return;
    const List = listType === 'ordered' ? 'ol' : 'ul';
    blocks.push(<List key={`list-${blocks.length}`}>{listItems.map((item, index) => <li key={index}><MarkdownInline value={item.value} offset={item.offset} colorRanges={colorRanges} /></li>)}</List>);
    listType = null;
    listItems = [];
  };
  for (const block of parseMarkdownBlocks(source)) {
    const { type, value: line, index } = block;
    if (type !== 'line') {
      flushList();
      if (type === 'code') blocks.push(<MarkdownCodeBlock key={`code-${index}`} language={block.language} code={line} />);
      else blocks.push(<div className="markdown-math-block" key={`math-${index}`}><MathFormula formula={line} display /></div>);
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? 'unordered' : 'ordered';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      const value = (unordered || ordered)[1];
      listItems.push({ value, offset: offsets[index] + line.length - value.length });
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = `h${Number(heading[1].length) + 1}`;
      blocks.push(<Heading key={`heading-${index}`}><MarkdownInline value={heading[2]} offset={offsets[index] + line.length - heading[2].length} colorRanges={colorRanges} /></Heading>);
    } else if (/^>\s?/.test(line)) {
      const value = line.replace(/^>\s?/, '');
      blocks.push(<blockquote key={`quote-${index}`}><MarkdownInline value={value} offset={offsets[index] + line.length - value.length} colorRanges={colorRanges} /></blockquote>);
    } else blocks.push(<p key={`paragraph-${index}`}><MarkdownInline value={line} offset={offsets[index]} colorRanges={colorRanges} /></p>);
  }
  flushList();
  return <div className="simple-markdown">{blocks}</div>;
}
