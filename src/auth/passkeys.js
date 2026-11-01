import {api} from '../api/client.js';

export const passkeysSupported = () => typeof window !== 'undefined' && window.isSecureContext && Boolean(window.PublicKeyCredential && navigator.credentials?.create && navigator.credentials?.get);
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const encode = value => {
  if (value == null) return null;
  let binary = ''; for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
function optionsFromJson(options, registration) {
  const key = options.publicKey;
  const parser = registration ? PublicKeyCredential.parseCreationOptionsFromJSON : PublicKeyCredential.parseRequestOptionsFromJSON;
  if (parser) return {publicKey: parser.call(PublicKeyCredential, key)};
  const publicKey = {...key, challenge: decode(key.challenge)};
  if (registration) publicKey.user = {...key.user, id: decode(key.user.id)};
  for (const field of ['excludeCredentials', 'allowCredentials']) {
    if (key[field]) publicKey[field] = key[field].map(item => ({...item, id: decode(item.id)}));
  }
  return {publicKey};
}
function credentialJson(credential) {
  if (!credential) throw new Error('패스키 인증이 취소되었습니다. 다시 시도해주세요.');
  const response = {clientDataJSON: encode(credential.response.clientDataJSON)};
  if (credential.response.attestationObject) {
    response.attestationObject = encode(credential.response.attestationObject);
    response.transports = credential.response.getTransports?.() || [];
  } else {
    response.authenticatorData = encode(credential.response.authenticatorData);
    response.signature = encode(credential.response.signature);
    response.userHandle = encode(credential.response.userHandle);
  }
  return {id: credential.id, rawId: encode(credential.rawId), type: credential.type, response, clientExtensionResults: credential.getClientExtensionResults()};
}
export function passkeyError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'AbortError') return '패스키 인증이 취소되었거나 시간이 만료되었습니다. 다시 시도해주세요.';
  if (error.name === 'InvalidStateError') return '이미 등록된 패스키입니다. 다른 기기나 보안 키를 사용해주세요.';
  if (error.name === 'SecurityError') return '등록된 HTTPS 주소에서 패스키를 사용해주세요.';
  return error.message || '패스키 인증에 실패했습니다. 다시 시도해주세요.';
}
export async function registerPasskey(token, name, signal) {
  if (!passkeysSupported()) throw new Error('이 브라우저에서는 패스키를 사용할 수 없습니다. 최신 브라우저와 HTTPS를 사용해주세요.');
  const start = await api('/api/auth/passkeys/registration/options', {method: 'POST', token});
  signal?.throwIfAborted();
  const credential = await navigator.credentials.create({...optionsFromJson(start.options, true), signal});
  signal?.throwIfAborted();
  await api('/api/auth/passkeys/registration/verify', {method: 'POST', token, body: {challengeToken: start.challengeToken, credential: credentialJson(credential), name}});
}
export async function authenticatePasskey(signal) {
  if (!passkeysSupported()) throw new Error('이 브라우저에서는 패스키를 사용할 수 없습니다. 최신 브라우저와 HTTPS를 사용해주세요.');
  const start = await api('/api/auth/passkeys/login/options', {method: 'POST'});
  signal?.throwIfAborted();
  const credential = await navigator.credentials.get({...optionsFromJson(start.options, false), signal});
  signal?.throwIfAborted();
  const result = await api('/api/auth/passkeys/login/verify', {method: 'POST', body: {challengeToken: start.challengeToken, credential: credentialJson(credential)}});
  signal?.throwIfAborted();
  return result;
}
