import { supabase, resolveActiveWorkspace } from './supabase';

export type ProductEventName =
  | 'session.started'
  | 'repository.connected'
  | 'repository.synced'
  | 'validation.started'
  | 'validation.completed'
  | 'finding.resolved'
  | 'deployment.requested'
  | 'deployment.reviewed'
  | 'deployment.completed';

export function notifyProductChanged(name:ProductEventName, detail:Record<string,unknown>={}){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent('lythouse:activity',{detail:{name,...detail}}));
  window.dispatchEvent(new CustomEvent('lythouse:data-changed',{detail:{name,...detail}}));
}

export async function recordProductEvent(name:ProductEventName, detail:Record<string,unknown>={}, workspaceId?:string){
  try{
    const wid=workspaceId||(await resolveActiveWorkspace()).id;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const entityType=typeof detail.entityType==='string'?detail.entityType:'product';
    const entityId=typeof detail.entityId==='string'?detail.entityId:null;
    await supabase.from('audit_logs').insert({workspace_id:wid,user_id:user.id,action:name,entity_type:entityType,entity_id:entityId,metadata:detail});
    notifyProductChanged(name,{workspaceId:wid,...detail});
  }catch(error){
    console.warn('LytHouse activity event could not be recorded',name,error);
  }
}
