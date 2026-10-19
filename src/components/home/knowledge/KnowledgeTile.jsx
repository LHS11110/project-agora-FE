import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { ui } from '../../../i18n/locale.js';
import MathFormula from '../../MathFormula.jsx';
import KnowledgeDiagram from './KnowledgeDiagram.jsx';
import './knowledge-tile.css';

export default function KnowledgeTile({ scene }) {
  useUiLocale();
  return <span className={`knowledge-tile knowledge-tile-${scene.kind}`}>
    <span className="knowledge-tile-heading">{ui(scene.title)}</span>
    <KnowledgeDiagram kind={scene.kind} title={ui(scene.title)} />
    <span className="knowledge-formula"><MathFormula formula={scene.formula} /></span>
  </span>;
}
