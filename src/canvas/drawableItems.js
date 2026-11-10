// Chat rooms and other document metadata have no visual or spatial footprint.
const drawableKinds=new Set(['image','link','code','note','table','chart','shape','text','math','stroke','connector','pdf','user-group','value','question','project','frame']);
export const isDrawableCanvasItem=item=>Boolean(item && item.type!=='chat_room' && drawableKinds.has(item.kind));
