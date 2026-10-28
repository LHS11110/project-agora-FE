import { Fragment } from 'react';
import MathFormula from '../MathFormula.jsx';
import ColorText from '../../canvas/content/ColorText.jsx';

// Inline code wins over math; escaped dollars and currency stay ordinary text.
const tokens = /(`[^`]+`|\\\([^\n]*?\\\)|(?<![\\$])\$(?!\s)(?:[^$\n]*?\S)(?<!\\)\$(?![\d$])|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
export default function MarkdownInline({ value = '', colorRanges = [], offset = 0 }) {
  let position = offset;
  return String(value).split(tokens).map((part, index) => {
    if (!part) return null;
    const start = position; position += part.length;
    if (index % 2 === 0) {
      if (!colorRanges.length) return <Fragment key={index}>{part.replace(/\\([\\`*_~$])/g, '$1')}</Fragment>;
      const pieces = []; let rangeIndex = 0;
      for (let i = 0; i < part.length; i++) {
        if (part[i] === '\\' && /[\\`*_~$]/.test(part[i + 1] || '')) i++;
        while (rangeIndex < colorRanges.length && colorRanges[rangeIndex].end <= start + i) rangeIndex++;
        const range = colorRanges[rangeIndex], color = range && range.start <= start + i && range.end > start + i ? range.color : undefined;
        const previous = pieces.at(-1);
        if (previous && previous.color === color) previous.text += part[i];
        else pieces.push({ color, text: part[i] });
      }
      return <Fragment key={index}>{pieces.map((piece, i) => piece.color ? <span key={i} style={{ color: piece.color }}>{piece.text}</span> : piece.text)}</Fragment>;
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}><ColorText value={part.slice(1, -1)} ranges={colorRanges} offset={start + 1} /></code>;
    if (part.startsWith('\\(') && part.endsWith('\\)')) return <MathFormula key={index} formula={part.slice(2, -2)} />;
    if (part.startsWith('$') && part.endsWith('$')) return <MathFormula key={index} formula={part.slice(1, -1)} />;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={index}><MarkdownInline value={part.slice(2, -2)} colorRanges={colorRanges} offset={start + 2} /></strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={index}><MarkdownInline value={part.slice(2, -2)} colorRanges={colorRanges} offset={start + 2} /></del>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={index}><MarkdownInline value={part.slice(1, -1)} colorRanges={colorRanges} offset={start + 1} /></em>;
    return <Fragment key={index}>{part.replace(/\\([\\`*_~$])/g, '$1')}</Fragment>;
  });
}
