import { loadEncodedDocument } from './documentCache.js';
import * as Automerge from '@automerge/automerge/slim';
import { itemSnapshot, changeItems } from '../itemSnapshots.js';
import { loadItemDoc } from './hostOperations.js';
import { collaborativeField, createActorId, decodeBase64, isCollaborativeItem } from '../collaborativeSync.js';

// Rebase only changed/previously pending objects. Unrelated collaborative
// documents retain their parsed state instead of being loaded on every input.
export class HostCanvasView {
  constructor() {
    this.items=itemSnapshot({});this.approvedDocs=new Map();this.approvedBases=new Map();
    this.docs=new Map();this.bases=new Map();this.actors=new Map();this.pendingIds=new Set();
    this.stats={rebases:0,itemsVisited:0,documentsLoaded:0};
  }
  rebase(committed,touched,operations) {
    const grouped=new Map();for(const operation of operations){if(!grouped.has(operation.id))grouped.set(operation.id,[]);grouped.get(operation.id).push(operation);}
    const approved=new Set(touched),ids=new Set([...approved,...this.pendingIds,...grouped.keys()]),changes=new Map();
    for(const id of ids){
      this.stats.itemsVisited++;
      let item=committed[id],doc,base;
      if(approved.has(id)){
        this.approvedDocs.delete(id);this.approvedBases.delete(id);
        if(isCollaborativeItem(item))try{
          this.stats.documentsLoaded++;this.approvedDocs.set(id,loadItemDoc(item));
          if(item.automerge_snapshot)this.approvedBases.set(id,loadEncodedDocument(item.automerge_snapshot));
        }catch{ /* Retain the plain-text fallback for malformed server state. */ }
      }
      doc=this.approvedDocs.has(id)?Automerge.clone(this.approvedDocs.get(id)):null;base=this.approvedBases.get(id);
      for(const operation of grouped.get(id)||[]){
        if(operation.action==='delete'){item=null;doc=null;base=null;continue;}
        // A queued patch must not resurrect an authoritative deletion/eviction.
        if(operation.action==='patch' && !item)continue;
        item={...item,...operation.patch};for(const field of operation.unset||[])delete item[field];
        if(operation.doc)try{
          const incoming=loadEncodedDocument(operation.doc);
          doc=doc?Automerge.merge(doc,incoming):incoming;item[collaborativeField(item)]=doc.content;
          if(!base)base=loadEncodedDocument(operation.base||operation.doc);
        }catch{ /* The coordinator rejects malformed proposals. */ }
      }
      // Published documents are editable branches, not the cached approved base.
      if(doc){if(!this.actors.has(id))this.actors.set(id,createActorId());this.docs.set(id,Automerge.clone(doc,{actor:this.actors.get(id)}));}else{this.docs.delete(id);if(!item)this.actors.delete(id);}
      if(base)this.bases.set(id,base);else this.bases.delete(id);
      changes.set(id,item || null);
    }
    this.items=changeItems(this.items,changes);this.pendingIds=new Set(grouped.keys());this.stats.rebases++;
    return this.items;
  }
}
