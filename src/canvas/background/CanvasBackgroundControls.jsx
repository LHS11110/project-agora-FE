import CanvasColorPicker from '../CanvasColorPicker.jsx';

export default function CanvasBackgroundControls({ backgroundColor, setBackgroundColor, favoriteColors, saveFavoriteColor, theme }) {
  return <section className="inspector-section"><strong className="inspector-label">캔버스 배경색</strong>
    <CanvasColorPicker color={backgroundColor || (theme === 'dark' ? '#18231e' : '#ffffff')} onChange={setBackgroundColor} favoriteColors={favoriteColors} onSaveFavorite={saveFavoriteColor} label="배경색" />
    <button className="button button-outline" disabled={!backgroundColor} onClick={() => setBackgroundColor('')}>테마 기본색으로 복원</button>
    <small className="inspector-hint">이 브라우저에서 캔버스별로 저장됩니다.</small>
  </section>;
}
