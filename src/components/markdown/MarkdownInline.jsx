import { Fragment } from 'react';
import MathFormula from '../MathFormula.jsx';

// Inline code wins over math; escaped dollars and currency stay ordinary text.
const tokens = /(`[^`]+`|\\\([^\n]*?\\\)|(?<![\\$])\$(?!\s)(?:[^$\n]*?\S)(?<!\\)\$(?![\d$])|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
export default function MarkdownInline({ value = '' }) {
  return String(value).split(tokens).map((part, index) => {
    if (!part) return null;
    if (index % 2 === 0) return <Fragment key={index}>{part.replace(/\\([\\`*_~$])/g, '$1')}</Fragment>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('\\(') && part.endsWith('\\)')) return <MathFormula key={index} formula={part.slice(2, -2)} />;
    if (part.startsWith('$') && part.endsWith('$')) return <MathFormula key={index} formula={part.slice(1, -1)} />;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={index}><MarkdownInline value={part.slice(2, -2)} /></strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={index}><MarkdownInline value={part.slice(2, -2)} /></del>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={index}><MarkdownInline value={part.slice(1, -1)} /></em>;
    return <Fragment key={index}>{part.replace(/\\([\\`*_~$])/g, '$1')}</Fragment>;
  });
}
