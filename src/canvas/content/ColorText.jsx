import { colorPieces } from './textColors.js';

export default function ColorText({ value, ranges = [], offset = 0 }) {
  return colorPieces(value, ranges, offset).map((part, index) => part.color
    ? <span key={index} style={{ color: part.color }}>{part.text}</span>
    : part.text);
}
