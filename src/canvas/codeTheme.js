export const CODE_THEME = 'frelog-night';
export function registerCodeTheme(monaco) {
  monaco.editor.defineTheme(CODE_THEME, {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: '8596B0', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C99BFF' },
      { token: 'string', foreground: 'A8D99B' },
      { token: 'number', foreground: 'F2BD88' },
      { token: 'type', foreground: '73D5D0' },
      { token: 'identifier', foreground: 'DCE6F5' },
      { token: 'delimiter', foreground: '9DAEC7' },
      { token: 'operator', foreground: 'F19DC1' },
      { token: 'tag', foreground: '7EBBFA' },
      { token: 'attribute.name', foreground: 'E5CD86' },
    ],
    colors: { 'editor.background': '#192233', 'editor.foreground': '#DCE6F5', 'editorLineNumber.foreground': '#667996', 'editorCursor.foreground': '#91C9FF', 'editor.selectionBackground': '#405F89', 'editor.lineHighlightBackground': '#243147', 'editorWidget.background': '#202D42',
      'editorSuggestWidget.background':'#202B3D','editorSuggestWidget.border':'#40506A',
      'editorSuggestWidget.foreground':'#DCE6F5','editorSuggestWidget.selectedBackground':'#344463',
      'editorSuggestWidget.selectedForeground':'#FFFFFF','editorSuggestWidget.highlightForeground':'#C8AEFF',
      'editorSuggestWidget.focusHighlightForeground':'#E3D3FF','editorSuggestWidgetStatus.foreground':'#AABBD1',
      'editorHoverWidget.background':'#202B3D','editorHoverWidget.border':'#40506A',
      'editorGhostText.foreground':'#8291A8','focusBorder':'#AD94DF',
      'textLink.foreground':'#ADC9FF','textCodeBlock.background':'#192233',
      'widget.shadow':'#070E1B66','list.hoverBackground':'#2A3850',
      'editorSymbolIcon.snippetForeground':'#C8AEFF','editorSymbolIcon.keywordForeground':'#D0ACF9',
      'editorSymbolIcon.functionForeground':'#8CC9FC','editorSymbolIcon.methodForeground':'#8CC9FC',
      'editorSymbolIcon.variableForeground':'#8BD5C6','editorSymbolIcon.classForeground':'#E9CA8B',
      'editorSymbolIcon.textForeground':'#A4B4CD' },
  });
}
