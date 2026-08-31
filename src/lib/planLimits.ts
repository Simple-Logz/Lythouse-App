// @ts-nocheck
import { supabase, resolveActiveWorkspace, type PlanId } from './supabase'

export const PLAN_LIMITS: Record<PlanId,{projects:number|null;validationsPerMonth:number|null}>={free:{projects:1,validationsPerMonth:5},developer:{projects:null,validationsPerMonth:null},enterprise:{projects:null,validationsPerMonth:null}}
export type PlanFeature='github_sync'|'core_validation'|'ai_analysis'|'analytics'|'validation_history'|'api_testing'|'load_testing'|'environment_drift'|'deployment_simulation'|'change_management'|'approvals'|'audit_log'|'advanced_integrations'|'team_roles'|'priority_support'
export const PLAN_FEATURES:Record<PlanId,ReadonlySet<PlanFeature>>={
 free:new Set(['github_sync','core_validation','ai_analysis','validation_history']),
 developer:new Set(['github_sync','core_validation','ai_analysis','analytics','validation_history','api_testing','load_testing','environment_drift','deployment_simulation']),
 enterprise:new Set(['github_sync','core_validation','ai_analysis','analytics','validation_history','api_testing','load_testing','environment_drift','deployment_simulation','change_management','approvals','audit_log','advanced_integrations','team_roles','priority_support'])
}
export function hasPlanFeature(planId:PlanId|null|undefined,feature:PlanFeature){return PLAN_FEATURES[planId||'free']?.has(feature)??false}
export function requiredPlanFor(feature:PlanFeature):PlanId{if(PLAN_FEATURES.free.has(feature))return'free';if(PLAN_FEATURES.developer.has(feature))return'developer';return'enterprise'}
export type FeatureCheck={ok:boolean;feature:PlanFeature;requiredPlan:PlanId;workspaceId:string}
/** Canonical UI/action entitlement check. The database RPC is authoritative; the local map is display/fallback metadata only. */
export async function checkWorkspaceFeature(feature:PlanFeature,workspaceId?:string):Promise<FeatureCheck>{const wid=workspaceId||(await resolveActiveWorkspace()).id;const{data,error}=await supabase.rpc('workspace_has_feature',{p_workspace:wid,p_feature:feature});if(error)throw error;return{ok:data===true,feature,requiredPlan:requiredPlanFor(feature),workspaceId:wid}}
export async function requireWorkspaceFeature(feature:PlanFeature,workspaceId?:string){const check=await checkWorkspaceFeature(feature,workspaceId);if(!check.ok){const e:any=new Error(`${feature.replaceAll('_',' ')} requires the ${check.requiredPlan} plan or higher.`);e.code='PLAN_FEATURE_REQUIRED';e.feature=feature;e.requiredPlan=check.requiredPlan;throw e}return check}
export type LimitCheck={ok:boolean;count:number;limit:number|null}
export async function checkProjectLimit(planId:PlanId,workspaceId:string):Promise<LimitCheck>{const limit=PLAN_LIMITS[planId]?.projects??null;if(limit==null)return{ok:true,count:0,limit:null};const{count,error}=await supabase.from('projects').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId);if(error)throw error;return{ok:(count??0)<limit,count:count??0,limit}}
export async function checkValidationLimit(planId:PlanId,workspaceId:string):Promise<LimitCheck>{const limit=PLAN_LIMITS[planId]?.validationsPerMonth??null;if(limit==null)return{ok:true,count:0,limit:null};const monthStart=new Date();monthStart.setDate(1);monthStart.setHours(0,0,0,0);const{count,error}=await supabase.from('validations').select('id',{count:'exact',head:true}).eq('workspace_id',workspaceId).gte('created_at',monthStart.toISOString());if(error)throw error;return{ok:(count??0)<limit,count:count??0,limit}}
