import React from 'react';
export default function AgentTime({value,clock=false,label}){
 const date=new Date(Number(value));if(!Number(value)||!Number.isFinite(date.getTime()))return null;
 return <time dateTime={date.toISOString()} title={`${label?`${label} · `:''}${date.toLocaleString()}`}>{date.toLocaleString(undefined,clock?{hour:'2-digit',minute:'2-digit'}:{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>;
}
