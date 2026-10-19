import { ui } from '../../../i18n/locale.js';
import { useUiLocale } from '../../../i18n/useUiLocale.js';
import { KNOWLEDGE_SCENES } from '../../../home/knowledgeScenes.js';
import KnowledgeTile from './KnowledgeTile.jsx';

export default function KnowledgeStrip({ variant }) {
  useUiLocale();
  return <div className="knowledge-strip" role="group" aria-label={ui("수식과 설계 예시")}>
    {KNOWLEDGE_SCENES[variant].map(scene => <KnowledgeTile key={scene.title} scene={scene} />)}
  </div>;
}
