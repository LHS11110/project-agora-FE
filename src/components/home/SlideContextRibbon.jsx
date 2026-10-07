import { Link } from '../../routing.jsx';
import Icon from '../Icon.jsx';
import { SLIDE_CONTEXTS } from '../../home/slideContexts.js';
import '../../home/slide-contexts.css';
import KnowledgeTile from './knowledge/KnowledgeTile.jsx';
import { KNOWLEDGE_SCENES } from '../../home/knowledgeScenes.js';

export default function SlideContextRibbon({ variant, target }) {
  return <nav className={`slide-context-ribbon context-${variant}`} aria-label="이 장면에서 더 살펴보기">
    {SLIDE_CONTEXTS[variant].map((item, index) => <Link key={item.tag} to={variant === 'start' && index === 2 ? target : item.to} className="slide-context-card">
      <KnowledgeTile scene={KNOWLEDGE_SCENES[variant][index]} />
      <span className="context-card-copy"><small>{item.tag}</small><strong>{item.title}</strong><span>{item.detail}</span></span>
      <Icon name="arrow" size={16} className="context-card-arrow" />
    </Link>)}
  </nav>;
}
