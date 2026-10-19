import { useSyncExternalStore } from 'react';
import { subscribeLocale, getLocale } from './locale.js';
export function useUiLocale() { return useSyncExternalStore(subscribeLocale, getLocale, () => 'ko'); }
