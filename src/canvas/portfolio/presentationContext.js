import {createContext} from 'react';
// True while a frame presentation is shown: objects stay read-only, but
// code execution, media playback and value input remain available.
export const PresentationContext=createContext(false);
