import {createContext,useContext} from 'react';
export const CanvasGraphicsContext=createContext('low');
export const useCanvasGraphics=()=>useContext(CanvasGraphicsContext);
