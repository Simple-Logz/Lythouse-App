import{createContext,useContext}from'react';
import{createClient}from'@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL;
export const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const edgeFunctionUrl=(import.meta.env.VITE_SUPABASE_URL as string)+'/functions/v1';
export const supabase=createClient(url,anonKey,{auth:{persistSession:true}});

export type PlanId='free'|'developer'|'enterprise';
export type Organization={id:string;name:string;slug:string|null;description:string|null;owner_id:string|null;created_at:string};
export type Workspace={id:string;name:string;slug:string;owner_id:string|null;description:string|null;organization_id?:string|null;created_at:string};
export type WorkspaceMember={id:string;workspace_id:string;user_id:string;role:'owner'|'admin'|'developer'|'approver'|'viewer';created_at:string};
export type WorkspaceInvitation={id:string;workspace_id:string;email:string;role:'admin'|'developer'|'approver'|'viewer';token:string;status:'pending'|'accepted'|'declined'|'revoked'|'expired';invited_by:string|null;created_at:string;expires_at:string;accepted_at:string|null};
export type WorkspacePlan={id:string;workspace_id:string;plan_id:PlanId;status:'active'|'cancelled'|'trialing';trial_ends_at:string|null;current_period_end:string|null;stripe_subscription_id:string|null;cancel_at_period_end:boolean;created_at:string;updated_at:string};
export type Project={id:string;workspace_id:string;name:string;description:string|null;git_url:string;git_branch:string;repo_folder:string;github_token:string|null;language:string|null;framework:string|null;status:string;created_by:string|null;created_at:string};
export type ValidationStatus='pending'|'running'|'completed'|'failed';
export type Severity='none'|'low'|'medium'|'high'|'critical';
export type StepStatus='pending'|'running'|'completed'|'failed'|'skipped';
export type FindingStatus='open'|'resolved'|'ignored';
export type Validation={id:string;project_id:string;workspace_id:string;status:ValidationStatus;trigger:string;commit_sha:string|null;risk_score:number|null;severity:Severity|null;summary:string|null;total_findings:number;critical_count:number;high_count:number;medium_count:number;low_count:number;duration_ms:number|null;created_by:string|null;created_at:string;completed_at:string|null};
export type ValidationStep={id:string;validation_id:string;step_index:number;key:string;name:string;status:StepStatus;detail:string|null;duration_ms:number|null;created_at:string;started_at:string|null;completed_at:string|null};
export type Finding={id:string;validation_id:string;project_id:string;category:string;severity:'low'|'medium'|'high'|'critical';title:string;description:string;file_path:string|null;line:number|null;recommendation:string|null;confidence:number|null;status:FindingStatus;resolution_note:string|null;resolved_at:string|null;created_at:string};
export type Deployment={id:string;project_id:string;workspace_id:string;validation_id:string|null;environment:'production'|'staging'|'preview';status:string;config_overrides:Record<string,unknown>;created_by:string|null;created_at:string;completed_at:string|null};
export type DeploymentSimulation={id:string;project_id:string;workspace_id:string;validation_id:string|null;environment:'production'|'staging'|'preview';config_overrides:Record<string,unknown>;predicted_risk_score:number|null;predicted_severity:Severity|null;blast_radius:'small'|'medium'|'large'|'critical'|null;affected_services:string[];impact_summary:string|null;rollback_plan:string|null;confidence:number|null;simulation_metadata:Record<string,unknown>;status:'pending'|'running'|'completed'|'failed';duration_ms:number|null;created_by:string|null;created_at:string;completed_at:string|null};
export type DeploymentPolicy={id:string;workspace_id:string;max_risk_score:number;block_critical:boolean;block_high:boolean;require_approval:boolean;auto_deploy_on_pass:boolean;cooldown_minutes:number;updated_by:string|null;updated_at:string};
export type AuditLog={id:string;workspace_id:string;user_id:string|null;action:string;entity_type:string|null;entity_id:string|null;metadata:Record<string,unknown>;ip_address:string|null;user_agent:string|null;created_at:string};
export type RepoFile={path:string;type:'file'|'dir';size:number|null};
export type ComplianceFramework='SOC2'|'HIPAA'|'PCI-DSS'|'GDPR'|'ISO27001';
export type ComplianceScan={id:string;workspace_id:string;project_id:string;framework:ComplianceFramework;status:'pending'|'scanning'|'completed'|'failed';overall_score:number;total_controls:number;passed_controls:number;failed_controls:number;warnings:number;controls:ComplianceControl[];evidence:EvidenceItem[];recommendations:string[];created_at:string;completed_at:string|null};
export type ComplianceControl={id:string;name:string;description:string;status:'pass'|'fail'|'warning'|'not_applicable';category:string;evidence:string[];recommendation:string|null};
export type EvidenceItem={id:string;type:string;source:string;description:string;collected_at:string};
export type Incident={id:string;workspace_id:string;project_id:string|null;title:string;description:string;severity:'low'|'medium'|'high'|'critical';status:'open'|'investigating'|'resolved'|'closed';created_at:string;resolved_at:string|null};
export type Integration={id:string;workspace_id:string;type:string;name:string;status:string;config:Record<string,unknown>;events:unknown[];last_sync_at:string|null;created_at:string;updated_at:string};
export type DoraMetric={id:string;workspace_id:string;metric_date:string;deployment_frequency:number;lead_time_hours:number;change_failure_rate:number;mttr_hours:number;created_at:string};
export type EnvironmentDrift={id:string;workspace_id:string;project_id:string;environment:string;drift_score:number;differences:Record<string,unknown>;detected_at:string};
export type AiInsight={id:string;workspace_id:string;type:string;title:string;description:string;severity:string;actionable:boolean;action_url:string|null;created_at:string};

// ── Unified Environment / Asset / Dependency / Change Event model ──
// See supabase/migrations/20260802010000_unified_environment_asset_model.sql.
// Additive layer over projects/server_environments/discovered_components —
// nothing above this line changes shape or meaning.
export type EnvironmentKind='production'|'staging'|'development'|'multi_cloud'|'on_prem'|'kubernetes_cluster'|'business_unit'|'other';
export type EnvironmentStatus='provisioning'|'active'|'degraded'|'maintenance'|'suspended'|'decommissioned';
export type AssetSource='git'|'server_collector'|'aws'|'azure'|'gcp'|'kubernetes'|'manual';
export type LhEnvironment={id:string;workspace_id:string;name:string;kind:EnvironmentKind;status:EnvironmentStatus;source:AssetSource;owner:string|null;tags:Record<string,unknown>;server_environment_id:string|null;created_at:string;updated_at:string};
export type AssetKind='repository'|'microservice'|'container_image'|'k8s_deployment'|'database'|'vm'|'api_gateway'|'terraform_module'|'saas_integration'|'load_balancer'|'storage_bucket'|'function'|'server'|'other';
export type AssetStatus='discovered'|'registered'|'active'|'modified'|'deprecated'|'failed'|'retired';
export type Asset={id:string;workspace_id:string;environment_id:string;kind:AssetKind;name:string;status:AssetStatus;source:AssetSource;external_id:string|null;metadata:Record<string,unknown>;project_id:string|null;server_target_id:string|null;discovered_component_id:string|null;first_seen_at:string;last_seen_at:string;created_at:string;updated_at:string};
export type DependencyRelationship='depends_on'|'contains'|'communicates_with'|'deployed_to'|'configured_by'|'references';
export type DependencyStatus='detected'|'verified'|'suspected'|'broken'|'degraded'|'resolved';
export type AssetDependency={id:string;workspace_id:string;environment_id:string|null;source_asset_id:string;target_asset_id:string;relationship_type:DependencyRelationship;status:DependencyStatus;evidence:Record<string,unknown>;confidence:number|null;human_confirmed:boolean;dependency_edge_id:string|null;created_at:string;resolved_at:string|null};
export type ChangeEventSource='git_commit'|'git_pr_merge'|'deployment'|'config_change'|'scaling_event'|'security_policy_update'|'infra_change'|'manual';
export type ChangeEventStatus='detected'|'ingested'|'analyzing'|'evaluated'|'approved'|'rejected'|'deployed'|'rolled_back';
export type ChangeEvent={id:string;workspace_id:string;environment_id:string|null;asset_id:string|null;source:ChangeEventSource;title:string;description:string|null;external_ref:string|null;status:ChangeEventStatus;validation_id:string|null;deployment_id:string|null;triggered_by:string|null;metadata:Record<string,unknown>;created_at:string;evaluated_at:string|null};
// asset_impact(start_asset_id, max_depth?) RPC — real recursive dependency
// traversal ("what breaks if this asset changes?"). Usage:
//   const { data } = await supabase.rpc('asset_impact', { start_asset_id, max_depth: 5 });
export type AssetImpactRow={asset_id:string;depth:number;path:string[]};

export type ServerEnvironment={id:string;workspace_id:string;project_id:string|null;name:string;business_unit:string|null;owner:string|null;environment_type:string;location:string|null;expected_server_count:number;primary_purpose:string|null;status:string;created_at:string;updated_at:string};
export type ServerTarget={id:string;environment_id:string;workspace_id:string;hostname:string;ip:string|null;os_platform:string;server_role:string|null;port_override:number|null;status:string;created_at:string};
export type ConnectionMethod='agent'|'ssh'|'winrm'|'collector'|'offline';
export type ConnectionProfile={id:string;environment_id:string;server_target_id:string|null;workspace_id:string;method:ConnectionMethod;credential_ref_id:string|null;bastion_host:string|null;bastion_port:number|null;auth_type:string|null;last_tested_at:string|null;test_result:string|null;test_details:Record<string,unknown>;created_at:string};
export type CollectorRegistration={id:string;environment_id:string;workspace_id:string;collector_id:string;enrollment_token_hash:string|null;machine_identity_jwt:string|null;agent_version:string|null;os:string|null;hostname:string|null;last_checkin_at:string|null;status:string;created_at:string};
export type CollectionPolicy={id:string;environment_id:string;workspace_id:string;default_categories:string[];optional_categories:string[];never_categories:string[];approved_at:string|null;created_at:string};
export type DiscoveryJob={id:string;environment_id:string;workspace_id:string;status:string;component_count:number;group_suggestion_count:number;started_at:string|null;completed_at:string|null;created_at:string};
export type DiscoveredComponent={id:string;job_id:string;environment_id:string;workspace_id:string;server_target_id:string|null;component_type:string;name:string;evidence:Record<string,unknown>;confidence:number;created_at:string};
export type DependencyEdge={id:string;environment_id:string;workspace_id:string;source_component_id:string;target_component_id:string;relationship_type:string;evidence:Record<string,unknown>;human_confirmed:boolean;created_at:string};
export type EnvironmentBlueprint={id:string;environment_id:string;workspace_id:string;version:string;capture_method:string;capture_timestamp:string;is_stale:boolean;component_count:number;app_group_count:number;dependency_count:number;known_gaps:unknown[];status:string;created_at:string};
export type ApplicationGroup={id:string;blueprint_id:string|null;environment_id:string;workspace_id:string;name:string;component_ids:string[];human_confirmed:boolean;business_context:string|null;ai_confidence:number;created_at:string};
export type ProposedChange={id:string;environment_id:string;workspace_id:string;change_type:string;change_description:string;artifact_name:string|null;artifact_type:string|null;artifact_ref:string|null;created_at:string};
export type ValidationRunStatus='queued'|'preparing_connection'|'testing_access'|'collecting_metadata'|'redacting_sensitive'|'classifying_components'|'generating_blueprint'|'preparing_workspace'|'applying_change'|'running_technical_tests'|'running_business_tests'|'testing_rollback'|'generating_verdict'|'completed'|'failed'|'cancelled';
export type Verdict='approved'|'conditionally_approved'|'rejected'|'inconclusive';
export type ValidationRun={id:string;blueprint_id:string;proposed_change_id:string;environment_id:string;workspace_id:string;run_type:string;status:string;confidence_score:number|null;verdict:Verdict|null;ai_summary:string|null;ai_root_cause:string|null;ai_remediation_steps:string[];ai_affected_components:string[];passport_summary:string|null;current_step:number;total_steps:number;started_at:string|null;completed_at:string|null;created_at:string};
export type ValidationEvidence={id:string;run_id:string;workspace_id:string;evidence_type:string;source:string;content:Record<string,unknown>;cited_in_verdict:boolean;created_at:string};
export type ValidationFinding={id:string;run_id:string;workspace_id:string;severity:'low'|'medium'|'high'|'critical';component_id:string|null;title:string;description:string;evidence_ids:string[];remediation_steps:string[];created_at:string};
export type RollbackResult={id:string;run_id:string;workspace_id:string;rollback_method:string;status:string;baseline_tests_after_rollback:Record<string,unknown>;evidence:Record<string,unknown>;created_at:string};
export type DeploymentPassport={id:string;run_id:string;workspace_id:string;verdict:Verdict|null;confidence_score:number|null;blueprint_version:string|null;human_readable_summary:string|null;expires_at:string|null;signature:string|null;created_at:string};

export const VALIDATION_STEPS=['Queued','Preparing connection','Testing access','Collecting approved metadata','Redacting sensitive values','Classifying components','Generating blueprint','Preparing validation workspace','Applying change','Running technical tests','Running business tests','Testing rollback','Generating verdict','Completed']as const;
export const CONNECTION_METHODS=[
{id:'agent'as ConnectionMethod,label:'Per-Server Agent',description:'Install a lightweight agent on each server. Outbound HTTPS only.',plans:['developer'as PlanId,'enterprise'as PlanId]},
{id:'ssh'as ConnectionMethod,label:'Agentless SSH',description:'Connect to Linux/Unix servers via SSH with a read-only account.',plans:['developer'as PlanId,'enterprise'as PlanId]},
{id:'winrm'as ConnectionMethod,label:'Agentless WinRM',description:'Connect to Windows servers via PowerShell Remoting over HTTPS.',plans:['developer'as PlanId,'enterprise'as PlanId]},
{id:'collector'as ConnectionMethod,label:'Enterprise Collector',description:'Deploy a collector inside your network. For regulated environments.',plans:['enterprise'as PlanId]},
{id:'offline'as ConnectionMethod,label:'Offline Snapshot Import',description:'Air-gapped environments. Collect, redact, and upload a signed snapshot bundle.',plans:['free'as PlanId,'developer'as PlanId,'enterprise'as PlanId]},
]as const;
export const COLLECTION_DEFAULT_CATEGORIES=['OS info','Installed runtimes & packages','Service definitions','Startup dependencies','Ports & bindings','Web server config','Scheduled tasks','File path structure','Certificate metadata','Env variable names (redacted values)','DB & service connection targets','Container runtime metadata'];
export const COLLECTION_OPTIONAL_CATEGORIES=['Selected application binaries','Selected config files (redacted)','Deployment packages','Database schema metadata','Sanitized test data','Custom enterprise scripts','Specific logs for test generation'];
export const COLLECTION_NEVER_CATEGORIES=['Passwords & private keys','Reusable tokens','Raw secret values','Complete production databases','Personal documents','Home-directory content','Unapproved source code','Customer data unrelated to validation','Full logs (unless explicitly selected)'];

export type PLANS={free:{id:PlanId;name:string;price:number;color:string;badge:string};developer:{id:PlanId;name:string;price:number;color:string;badge:string};enterprise:{id:PlanId;name:string;price:number;color:string;badge:string};[key:string]:{id:PlanId;name:string;price:number;color:string;badge:string};};
export const PLANS:PLANS={
free:{id:'free',name:'Free',price:0,color:'bg-gray-100 text-gray-700',badge:'bg-gray-100 text-gray-600 border-[#d4d4d8]'},
developer:{id:'developer',name:'Developer',price:29,color:'bg-brand-50 text-brand-700',badge:'bg-brand-50 text-brand-700 border-brand-200'},
enterprise:{id:'enterprise',name:'Enterprise',price:199,color:'bg-navy-800 text-white',badge:'bg-navy-800 text-white border-navy-700'},
};
