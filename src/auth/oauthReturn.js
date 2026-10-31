export function oauthReturnPath(value) {
  // The return location is a local path, never a URL or a login callback loop.
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value) || /^\/login(?:[/?#]|$)/.test(value)) return '/search';
  return value;
}
