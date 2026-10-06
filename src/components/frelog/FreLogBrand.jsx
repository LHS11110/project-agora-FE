import { Link } from '../../routing.jsx';
import '../../frelog-brand.css';

export default function FreLogBrand({ className = '', ...linkProps }) {
  return <Link className={`brand-lockup frelog-brand-lockup ${className}`.trim()} to="/" aria-label="FreLog 홈" {...linkProps}>
    <span className="frelog-brand-mark" aria-hidden="true"><i>F</i><b /></span>
    <span className="frelog-wordmark">FreLog</span>
  </Link>;
}
