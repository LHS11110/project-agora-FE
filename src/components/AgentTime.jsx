import React from 'react';
import { intlLocale } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
export default function AgentTime({value,clock=false,label}){
 const locale = useUiLocale();
 const date=new Date(Number(value));if(!Number(value)||!Number.isFinite(date.getTime()))return null;
 return <time dateTime={date.toISOString()} title={`${label?`${label} · `:''}${date.toLocaleString(intlLocale(locale))}`}>{date.toLocaleString(intlLocale(locale),clock?{hour:'2-digit',minute:'2-digit'}:{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>;
}
