import MathFormula from '../../MathFormula.jsx';
import KnowledgeDiagram from './KnowledgeDiagram.jsx';
import './knowledge-tile.css';

export default function KnowledgeTile({ scene }) {
  return <span className={`knowledge-tile knowledge-tile-${scene.kind}`}>
    <span className="knowledge-tile-heading">{scene.title}</span>
    <KnowledgeDiagram kind={scene.kind} title={scene.title} />
    <span className="knowledge-formula"><MathFormula formula={scene.formula} /></span>
  </span>;
}
