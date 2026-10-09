import { Link } from '../../routing.jsx';
import '../../frelog-brand.css';

export default function FreLogBrand({ className = '', ...linkProps }) {
  return <Link className={`brand-lockup frelog-brand-lockup ${className}`.trim()} to="/" aria-label="FreLog 홈" {...linkProps}>
    <span className="frelog-brand-mark" aria-hidden="true"><img src="/favicon.svg" alt="" width="64" height="64" /></span>
    <span className="frelog-wordmark">FreLog</span>
  </Link>;
}
