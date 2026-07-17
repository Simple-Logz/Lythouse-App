import{useEffect,useState,useCallback}from'react';
import{supabase,type WorkspaceMember}from'../lib/supabase';
import{PageHeader,Spinner,EmptyState}from'../lib/ui';
import{useAuth}from'../lib/auth';
import{Users,Plus,X,Loader as Loader2,Mail,Shield,UserPlus,Users2,ChevronDown,ChevronRight,Trash2,Edit2,Check,FolderGit2,ShieldCheck,Bell,ArrowLeft,Settings,Activity}from'lucide-react';

type Role='owner'|'admin'|'member'|'viewer';
type MemberRow=WorkspaceMember&{profiles?:{email?:string|null;full_name?:string|null}|null};
type Group={id:string;workspace_id:string;name:string;description:string|null;created_at:string;};
type GroupMember={id:string;group_id:string;user_id:string;created_at:string;};

const ROLE_CLS:Record<Role,string>={
  owner:'bg-brand-50 text-brand-700 border border-brand-200',
  admin:'bg-blue-50 text-blue-600 border border-blue-200',
  member:'bg-gray-100 text-gray-600 border border-gray-200',
  viewer:'bg-gray-50 text-gray-500 border border-gray-200',
};

const ROLE_DESC:Record<Role,string>={
  owner:'Full access — can delete workspace',
  admin:'Manage members and projects',
  member:'Run validations and view results',
  viewer:'Read-only access',
};

export function TeamPage(){
  const{user}=useAuth();
  const[loading,setLoading]=useState(true);
  const[members,setMembers]=useState<MemberRow[]>([]);
  const[groups,setGroups]=useState<Group[]>([]);
  const[groupMembers,setGroupMembers]=useState<GroupMember[]>([]);
  const[tab,setTab]=useState<'members'|'groups'>('members');

  // Invite modal
  const[inviting,setInviting]=useState(false);
  const[inviteEmail,setInviteEmail]=useState('');
  const[inviteRole,setInviteRole]=useState<Role>('member');
  const[inviting2,setInviting2]=useState(false);
  const[inviteError,setInviteError]=useState('');
  const[inviteDone,setInviteDone]=useState(false);

  // Group modal
  const[creatingGroup,setCreatingGroup]=useState(false);
  const[groupName,setGroupName]=useState('');
  const[groupDesc,setGroupDesc]=useState('');
  const[savingGroup,setSavingGroup]=useState(false);
  const[expandedGroup,setExpandedGroup]=useState<string|null>(null);
  const[editingGroup,setEditingGroup]=useState<string|null>(null);
  const[editGroupName,setEditGroupName]=useState('');

  // Add member to group
  const[addingToGroup,setAddingToGroup]=useState<string|null>(null);
  const[groupAddUserId,setGroupAddUserId]=useState('');
  const[selectedGroup,setSelectedGroup]=useState<Group|null>(null);

  const wsId=()=>localStorage.getItem('sandbox.activeWs');

  const load=useCallback(async()=>{
    setLoading(true);
    const wid=wsId();
    if(!wid){setLoading(false);return;}
    const[mRes,gRes]=await Promise.all([
      supabase.from('workspace_members').select('*').eq('workspace_id',wid).order('created_at',{ascending:true}),
      supabase.from('workspace_groups').select('*').eq('workspace_id',wid).order('created_at',{ascending:true}),
    ]);
    // Load profiles separately for each member
    const memberData=mRes.data??[];
    if(memberData.length>0){
      const userIds=memberData.map((m:any)=>m.user_id);
      const{data:profileData}=await supabase.from('profiles').select('id,email,full_name').in('id',userIds);
      const profileMap=Object.fromEntries((profileData??[]).map((p:any)=>[p.id,p]));
      setMembers(memberData.map((m:any)=>({...m,profiles:profileMap[m.user_id]??null})));
    } else {
      setMembers([]);
    }
    const grps=gRes.data??[];
    setGroups(grps);
    if(grps.length>0){
      const{data:gm}=await supabase.from('workspace_group_members').select('*').in('group_id',grps.map(g=>g.id));
      setGroupMembers(gm??[]);
    }
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load]);

  const invite=async()=>{
    const wid=wsId();
    if(!wid||!inviteEmail.trim())return;
    setInviting2(true);setInviteError('');
    const{data:profile,error:pErr}=await supabase.from('profiles').select('id,email,full_name').eq('email',inviteEmail.trim()).maybeSingle();
    if(pErr||!profile){
      setInviteError('No LytHouse account found for that email. They need to sign up first.');
      setInviting2(false);return;
    }
    const{data,error:iErr}=await supabase.from('workspace_members').insert({workspace_id:wid,user_id:profile.id,role:inviteRole}).select('*').single();
    if(iErr){setInviteError(iErr.message.includes('duplicate')?'This person is already a member.':iErr.message);setInviting2(false);return;}
    setMembers(prev=>[...prev,{...data,profiles:{email:profile.email,full_name:profile.full_name}}]);
    setInviteEmail('');setInviteRole('member');setInviting(false);setInviteDone(true);
    setTimeout(()=>setInviteDone(false),3000);
    setInviting2(false);
  };

  const removeMember=async(memberId:string,userId:string)=>{
    if(userId===user?.id){alert('You cannot remove yourself from the workspace.');return;}
    if(!confirm('Remove this member from the workspace?'))return;
    await supabase.from('workspace_members').delete().eq('id',memberId);
    setMembers(prev=>prev.filter(m=>m.id!==memberId));
  };

  const changeRole=async(memberId:string,newRole:Role)=>{
    await supabase.from('workspace_members').update({role:newRole}).eq('id',memberId);
    setMembers(prev=>prev.map(m=>m.id===memberId?{...m,role:newRole}:m));
  };

  const createGroup=async()=>{
    const wid=wsId();
    if(!wid||!groupName.trim())return;
    setSavingGroup(true);
    const{data,error}=await supabase.from('workspace_groups').insert({workspace_id:wid,name:groupName.trim(),description:groupDesc.trim()||null}).select().single();
    if(!error&&data){setGroups(prev=>[...prev,data]);setExpandedGroup(data.id);}
    setGroupName('');setGroupDesc('');setCreatingGroup(false);setSavingGroup(false);
  };

  const deleteGroup=async(groupId:string)=>{
    if(!confirm('Delete this group? Members will not be removed from the workspace.'))return;
    await supabase.from('workspace_groups').delete().eq('id',groupId);
    setGroups(prev=>prev.filter(g=>g.id!==groupId));
    setGroupMembers(prev=>prev.filter(gm=>gm.group_id!==groupId));
  };

  const saveGroupName=async(groupId:string)=>{
    if(!editGroupName.trim())return;
    await supabase.from('workspace_groups').update({name:editGroupName.trim()}).eq('id',groupId);
    setGroups(prev=>prev.map(g=>g.id===groupId?{...g,name:editGroupName.trim()}:g));
    setEditingGroup(null);
  };

  const addMemberToGroup=async(groupId:string)=>{
    if(!groupAddUserId)return;
    const{data,error}=await supabase.from('workspace_group_members').insert({group_id:groupId,user_id:groupAddUserId}).select().single();
    if(!error&&data){setGroupMembers(prev=>[...prev,data]);}
    setAddingToGroup(null);setGroupAddUserId('');
  };

  const removeMemberFromGroup=async(gmId:string)=>{
    await supabase.from('workspace_group_members').delete().eq('id',gmId);
    setGroupMembers(prev=>prev.filter(gm=>gm.id!==gmId));
  };

  const getMemberName=(userId:string)=>{
    const m=members.find(m=>m.user_id===userId);
    return m?.profiles?.full_name||m?.profiles?.email||userId.slice(0,8);
  };

  if(loading)return<div className="flex justify-center py-24"><Spinner size={28}/></div>;

  // Group detail view
  if(selectedGroup){
    const gms=groupMembers.filter(gm=>gm.group_id===selectedGroup.id);
    const grpMembers=members.filter(m=>gms.find(gm=>gm.user_id===m.user_id));
    const nonGroupMembers=members.filter(m=>!gms.find(gm=>gm.user_id===m.user_id));
    return(
      <div>
        <div className="mb-6">
          <button onClick={()=>setSelectedGroup(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-900 mb-4 transition-colors">
            <ArrowLeft size={15}/>Back to Team
          </button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Users2 size={22}/></div>
              <div>
                <h1 className="text-xl font-bold text-navy-900">{selectedGroup.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{selectedGroup.description||'No description'} · {gms.length} member{gms.length!==1?'s':''}</p>
              </div>
            </div>
            <button onClick={()=>deleteGroup(selectedGroup.id)} className="btn-secondary text-xs text-danger-600 border-red-200 hover:bg-red-50"><Trash2 size={13}/>Delete group</button>
          </div>
        </div>

        {/* Group stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6">
          {[
            {label:'Members',value:gms.length,icon:Users,color:'bg-brand-50 text-brand-600'},
            {label:'Projects access',value:'All workspace',icon:FolderGit2,color:'bg-blue-50 text-blue-600'},
            {label:'Permission level',value:'Member',icon:Shield,color:'bg-green-50 text-green-600'},
          ].map(s=>(
            <div key={s.label} className="card flex items-center gap-3 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.color}`}><s.icon size={16}/></div>
              <div>
                <p className="text-base font-bold text-navy-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Members section */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-navy-900">Members</h2>
            {nonGroupMembers.length>0&&(
              addingToGroup===selectedGroup.id?(
                <div className="flex items-center gap-2">
                  <select className="input text-sm py-1.5 h-auto" value={groupAddUserId} onChange={e=>setGroupAddUserId(e.target.value)}>
                    <option value="">Select member…</option>
                    {nonGroupMembers.map(m=>(
                      <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email||m.user_id.slice(0,8)}</option>
                    ))}
                  </select>
                  <button onClick={()=>addMemberToGroup(selectedGroup.id)} disabled={!groupAddUserId} className="btn-primary text-xs">Add</button>
                  <button onClick={()=>{setAddingToGroup(null);setGroupAddUserId('');}} className="btn-secondary text-xs">Cancel</button>
                </div>
              ):(
                <button onClick={()=>setAddingToGroup(selectedGroup.id)} className="btn-primary text-sm"><UserPlus size={14}/>Add member</button>
              )
            )}
          </div>
          {grpMembers.length===0
            ?<div className="text-center py-8 text-gray-400">
              <Users size={28} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm">No members yet</p>
              <p className="text-xs mt-1">Add workspace members to this group</p>
            </div>
            :<div className="divide-y divide-gray-100">
              {grpMembers.map(m=>{
                const gm=gms.find(gm=>gm.user_id===m.user_id)!;
                return(
                  <div key={m.user_id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-sm font-bold">
                      {(m.profiles?.full_name||m.profiles?.email||'?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900">{m.profiles?.full_name||m.profiles?.email||m.user_id.slice(0,8)}</p>
                      {m.profiles?.email&&<p className="text-xs text-gray-500">{m.profiles.email}</p>}
                    </div>
                    <span className="chip bg-gray-100 text-gray-600 border border-gray-200 capitalize text-xs">{m.role}</span>
                    <button onClick={()=>removeMemberFromGroup(gm.id)} className="btn-ghost p-1.5 text-gray-400 hover:text-danger-600"><X size={13}/></button>
                  </div>
                );
              })}
            </div>
          }
        </div>

        {/* Group activity */}
        <div className="card">
          <h2 className="text-base font-semibold text-navy-900 mb-4">Group Notifications</h2>
          <div className="space-y-3">
            {[
              {icon:ShieldCheck,label:'Validation completed',desc:'Notify group when a validation run completes',enabled:true},
              {icon:Activity,label:'Critical findings',desc:'Alert group immediately when critical issues are found',enabled:true},
              {icon:Bell,label:'Deployment ready',desc:'Notify group when a project is cleared for deployment',enabled:false},
              {icon:FolderGit2,label:'New project added',desc:'Notify group when a new project is created in this workspace',enabled:false},
            ].map(n=>(
              <div key={n.label} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 mt-0.5"><n.icon size={14}/></div>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{n.label}</p>
                    <p className="text-xs text-gray-500">{n.desc}</p>
                  </div>
                </div>
                <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${n.enabled?'bg-brand-600':'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${n.enabled?'translate-x-4':'translate-x-0'}`}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div>
      <PageHeader title="Team" description="Manage workspace members and groups."
        actions={
          <div className="flex gap-2">
            <button onClick={()=>setCreatingGroup(true)} className="btn-secondary"><Users2 size={15}/>New group</button>
            <button onClick={()=>setInviting(true)} className="btn-primary"><UserPlus size={15}/>Invite member</button>
          </div>
        }
      />

      {inviteDone&&(
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check size={15}/>Member added successfully.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {[{id:'members',label:`Members (${members.length})`,icon:Users},{id:'groups',label:`Groups (${groups.length})`,icon:Users2}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab===t.id?'tab-active':'tab-inactive'}`}>
            <t.icon size={15}/>{t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab==='members'&&(
        members.length===0
        ?<EmptyState icon={<Users size={22}/>} title="No members yet" description="Invite teammates to collaborate in this workspace." action={<button onClick={()=>setInviting(true)} className="btn-primary"><UserPlus size={15}/>Invite member</button>}/>
        :<div className="card divide-y divide-gray-100 p-0">
          {members.map(m=>(
            <div key={m.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-sm font-bold">
                  {(m.profiles?.full_name||m.profiles?.email||'?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{m.profiles?.full_name??m.profiles?.email??m.user_id.slice(0,8)}</p>
                  {m.profiles?.email&&<p className="text-xs text-gray-500">{m.profiles.email}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{ROLE_DESC[m.role as Role]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.user_id!==user?.id&&m.role!=='owner'?(
                  <select value={m.role} onChange={e=>changeRole(m.id,e.target.value as Role)} className="input text-xs py-1 h-auto">
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ):(
                  <span className={`chip capitalize ${ROLE_CLS[m.role as Role]}`}>{m.role}</span>
                )}
                {m.user_id!==user?.id&&m.role!=='owner'&&(
                  <button onClick={()=>removeMember(m.id,m.user_id)} className="btn-ghost p-1.5 text-gray-400 hover:text-danger-600"><Trash2 size={14}/></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups tab */}
      {tab==='groups'&&(
        groups.length===0
        ?<EmptyState icon={<Users2 size={22}/>} title="No groups yet" description="Create groups to organize your team — e.g. Frontend, Backend, DevOps, Security." action={<button onClick={()=>setCreatingGroup(true)} className="btn-primary"><Plus size={15}/>New group</button>}/>
        :<div className="space-y-3">
          {groups.map(g=>{
            const gms=groupMembers.filter(gm=>gm.group_id===g.id);
            const isOpen=expandedGroup===g.id;
            const nonGroupMembers=members.filter(m=>!gms.find(gm=>gm.user_id===m.user_id));
            return(
              <div key={g.id} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button onClick={()=>setSelectedGroup(g)} className="flex items-center gap-2 flex-1 text-left">
                    {isOpen?<ChevronDown size={16} className="text-gray-400"/>:<ChevronRight size={16} className="text-gray-400"/>}
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users2 size={16}/></div>
                    <div className="flex-1">
                      {editingGroup===g.id?(
                        <input autoFocus className="input text-sm py-1 h-auto" value={editGroupName} onChange={e=>setEditGroupName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveGroupName(g.id);if(e.key==='Escape')setEditingGroup(null);}} onClick={e=>e.stopPropagation()}/>
                      ):(
                        <p className="text-sm font-semibold text-navy-900">{g.name}</p>
                      )}
                      <p className="text-xs text-gray-500">{gms.length} member{gms.length!==1?'s':''}{g.description?` · ${g.description}`:''}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    {editingGroup===g.id?(
                      <button onClick={()=>saveGroupName(g.id)} className="btn-primary text-xs py-1.5"><Check size={13}/>Save</button>
                    ):(
                      <button onClick={()=>{setEditingGroup(g.id);setEditGroupName(g.name);}} className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"><Edit2 size={14}/></button>
                    )}
                    <button onClick={()=>deleteGroup(g.id)} className="btn-ghost p-1.5 text-gray-400 hover:text-danger-600"><Trash2 size={14}/></button>
                  </div>
                </div>

                {isOpen&&(
                  <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                    {gms.length===0
                      ?<p className="text-sm text-gray-400 py-2">No members in this group yet.</p>
                      :<div className="space-y-2 mb-3">
                        {gms.map(gm=>(
                          <div key={gm.id} className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-bold">
                                {getMemberName(gm.user_id).charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-navy-800">{getMemberName(gm.user_id)}</span>
                            </div>
                            <button onClick={()=>removeMemberFromGroup(gm.id)} className="btn-ghost p-1 text-gray-400 hover:text-danger-600"><X size={13}/></button>
                          </div>
                        ))}
                      </div>
                    }

                    {addingToGroup===g.id?(
                      <div className="flex items-center gap-2">
                        <select className="input text-sm py-1.5 h-auto flex-1" value={groupAddUserId} onChange={e=>setGroupAddUserId(e.target.value)}>
                          <option value="">Select a member…</option>
                          {nonGroupMembers.map(m=>(
                            <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name||m.profiles?.email||m.user_id.slice(0,8)}</option>
                          ))}
                        </select>
                        <button onClick={()=>addMemberToGroup(g.id)} disabled={!groupAddUserId} className="btn-primary text-xs py-1.5">Add</button>
                        <button onClick={()=>{setAddingToGroup(null);setGroupAddUserId('');}} className="btn-secondary text-xs py-1.5">Cancel</button>
                      </div>
                    ):(
                      nonGroupMembers.length>0&&(
                        <button onClick={()=>setAddingToGroup(g.id)} className="btn-secondary text-xs"><UserPlus size={13}/>Add member to group</button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite modal */}
      {inviting&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setInviting(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">Invite member</h2><p className="text-sm text-gray-500 mt-0.5">They must have a LytHouse account first.</p></div>
              <button onClick={()=>setInviting(false)} className="btn-ghost p-1"><X size={16}/></button>
            </div>
            {inviteError&&<div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger-600">{inviteError}</div>}
            <label className="label">Email address</label>
            <div className="relative mb-4">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-9" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&invite()} placeholder="teammate@company.com" autoFocus/>
            </div>
            <label className="label">Role</label>
            <div className="space-y-2 mb-5">
              {(['viewer','member','admin'] as Role[]).map(r=>(
                <label key={r} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${inviteRole===r?'border-brand-300 bg-brand-50':'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="role" value={r} checked={inviteRole===r} onChange={()=>setInviteRole(r)} className="mt-0.5"/>
                  <div>
                    <p className="text-sm font-medium text-navy-900 capitalize">{r}</p>
                    <p className="text-xs text-gray-500">{ROLE_DESC[r]}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setInviting(false)} className="btn-secondary">Cancel</button>
              <button onClick={invite} disabled={inviting2||!inviteEmail.trim()} className="btn-primary">
                {inviting2?<Loader2 size={15} className="animate-spin"/>:<UserPlus size={15}/>}Send invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create group modal */}
      {creatingGroup&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setCreatingGroup(false)}>
          <div className="w-full max-w-md animate-scale-in rounded-xl bg-white p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">New group</h2><p className="text-sm text-gray-500 mt-0.5">Group members by team, function, or project.</p></div>
              <button onClick={()=>setCreatingGroup(false)} className="btn-ghost p-1"><X size={16}/></button>
            </div>
            <label className="label">Group name</label>
            <input className="input mb-3" value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="e.g. Frontend, DevOps, Security" autoFocus/>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input mb-5" value={groupDesc} onChange={e=>setGroupDesc(e.target.value)} placeholder="What does this group do?"/>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setCreatingGroup(false)} className="btn-secondary">Cancel</button>
              <button onClick={createGroup} disabled={savingGroup||!groupName.trim()} className="btn-primary">
                {savingGroup?<Loader2 size={15} className="animate-spin"/>:<Plus size={15}/>}Create group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
