import { KNOWLEDGE_SCENES } from '../../../home/knowledgeScenes.js';
import KnowledgeTile from './KnowledgeTile.jsx';

export default function KnowledgeStrip({ variant }) {
  return <div className="knowledge-strip" role="group" aria-label="수식과 설계 예시">
    {KNOWLEDGE_SCENES[variant].map(scene => <KnowledgeTile key={scene.title} scene={scene} />)}
  </div>;
}
