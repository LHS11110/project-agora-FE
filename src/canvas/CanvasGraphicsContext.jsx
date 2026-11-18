import {createContext,useContext} from 'react';
export const CanvasGraphicsContext=createContext('high');
export const useCanvasGraphics=()=>useContext(CanvasGraphicsContext);
