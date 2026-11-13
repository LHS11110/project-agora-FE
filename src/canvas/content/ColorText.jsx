import { colorPieces } from './textColors.js';
import {mentionRanges} from '../comments/mentions.js';
import './mention-text.css';
export default function ColorText({ value, ranges = [], offset = 0, mentions = true }) {
 const text=String(value??''),matches=mentions?mentionRanges(text):[],segments=[];let cursor=0;
 const plain=(start,end)=>colorPieces(text.slice(start,end),ranges,offset+start).map((part,index)=>part.color?<span key={`${start}-${index}`} style={{color:part.color}}>{part.text}</span>:part.text);
 for(const match of matches){segments.push(...plain(cursor,match.start));segments.push(<mark className="canvas-mention-text" key={`mention-${match.start}`}>{text.slice(match.start,match.end)}</mark>);cursor=match.end;}
 segments.push(...plain(cursor,text.length));return segments;
}
