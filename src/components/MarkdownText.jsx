import { Fragment } from 'react';

const inlineToken = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

function renderInline(value, keyPrefix) {
  return value.split(inlineToken).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) return <del key={key}>{part.slice(2, -2)}</del>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function MarkdownText({ source = '' }) {
  const lines = String(source).split('\n');
  const blocks = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    const List = listType === 'ordered' ? 'ol' : 'ul';
    blocks.push(<List key={`list-${blocks.length}`}>{listItems.map((item, index) => <li key={index}>{renderInline(item, `list-${blocks.length}-${index}`)}</li>)}</List>);
    listType = null;
    listItems = [];
  };

  lines.forEach((line, index) => {
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = unordered ? 'unordered' : 'ordered';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      return;
    }
    flushList();
    if (!line.trim()) return;

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = `h${Number(heading[1].length) + 1}`;
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(heading[2], `heading-${index}`)}</Heading>);
      return;
    }
    if (/^>\s?/.test(line)) {
      blocks.push(<blockquote key={`quote-${index}`}>{renderInline(line.replace(/^>\s?/, ''), `quote-${index}`)}</blockquote>);
      return;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(line, `paragraph-${index}`)}</p>);
  });
  flushList();

  return <div className="simple-markdown">{blocks}</div>;
}
