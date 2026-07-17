import{useCallback,useEffect,useRef,useState}from'react';
import{edgeFunctionUrl,anonKey,type Project,type RepoFile}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{X,Folder,File as FileIcon,ChevronRight,ChevronDown,RefreshCw,AlertTriangle,Copy,Check,Download,Search,GitBranch,Code2,FolderOpen,Maximize2,Minimize2}from'lucide-react';

type TreeNode={name:string;path:string;type:'file'|'dir';children:Map<string,TreeNode>;size?:number|null};
type Props={projectId:string;project:Project;initialFile?:string|null;initialLine?:number|null;onClose:()=>void;findingContext?:{title:string;recommendation:string;line?:number;file?:string}|null;};

const headers=()=>({'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey});
const call=async(body:Record<string,unknown>)=>{
  const r=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:headers(),body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||r.statusText);
  return r.json();
};

function buildTree(files:RepoFile[]):TreeNode{
  const root:TreeNode={name:'',path:'',type:'dir',children:new Map()};
  for(const f of files){
    const parts=f.path.split('/');
    let cur=root;
    parts.forEach((part,i)=>{
      const isLast=i===parts.length-1;
      const path=parts.slice(0,i+1).join('/');
      let node=cur.children.get(part);
      if(!node){node={name:part,path,type:isLast?f.type:'dir',children:new Map(),size:isLast?f.size:null};cur.children.set(part,node);}
      else if(isLast){node.type=f.type;node.size=f.size;}
      cur=node;
    });
  }
  return root;
}

function getLanguage(path:string):string{
  const ext=path.split('.').pop()?.toLowerCase();
  const map:Record<string,string>={ts:'typescript',tsx:'typescript',js:'javascript',jsx:'javascript',py:'python',rb:'ruby',go:'go',rs:'rust',java:'java',cs:'csharp',cpp:'cpp',c:'c',php:'php',swift:'swift',kt:'kotlin',md:'markdown',json:'json',yaml:'yaml',yml:'yaml',toml:'toml',env:'bash',sh:'bash',dockerfile:'dockerfile',css:'css',scss:'scss',html:'html',xml:'xml',sql:'sql'};
  return map[ext??'']||'plaintext';
}

function getFileIcon(name:string):string{
  const ext=name.split('.').pop()?.toLowerCase();
  const icons:Record<string,string>={ts:'🔷',tsx:'⚛️',js:'🟨',jsx:'⚛️',py:'🐍',rb:'💎',go:'🔵',rs:'🦀',java:'☕',cs:'🔵',cpp:'⚙️',c:'⚙️',php:'🐘',swift:'🍎',kt:'🟣',md:'📝',json:'📋',yaml:'⚙️',yml:'⚙️',env:'🔐',sh:'💻',dockerfile:'🐳',css:'🎨',scss:'🎨',html:'🌐',sql:'🗄️',png:'🖼️',jpg:'🖼️',svg:'🖼️',gif:'🖼️'};
  return icons[ext??'']||'📄';
}

function syntaxHighlight(code:string,lang:string):string{
  if(lang==='plaintext'||lang==='markdown')return code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let c=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Keywords
  const keywords=['const','let','var','function','return','if','else','for','while','class','import','export','from','default','async','await','try','catch','throw','new','type','interface','extends','implements','public','private','protected','static','readonly','void','string','number','boolean','null','undefined','true','false','def','print','self','elif','and','or','not','in','is','None','True','False'];
  keywords.forEach(k=>{c=c.replace(new RegExp(`\\b${k}\\b`,'g'),`<span style="color:#569cd6">${k}</span>`);});
  // Strings
  c=c.replace(/(&quot;|&#039;|`)[^]*?\1/g,m=>`<span style="color:#ce9178">${m}</span>`);
  c=c.replace(/"([^"\\]|\\.)*"/g,m=>`<span style="color:#ce9178">${m}</span>`);
  c=c.replace(/'([^'\\]|\\.)*'/g,m=>`<span style="color:#ce9178">${m}</span>`);
  // Comments
  c=c.replace(/(\/\/[^\n]*|#[^\n]*)/g,m=>`<span style="color:#6a9955">${m}</span>`);
  c=c.replace(/(\/\*[\s\S]*?\*\/)/g,m=>`<span style="color:#6a9955">${m}</span>`);
  // Numbers
  c=c.replace(/\b(\d+\.?\d*)\b/g,m=>`<span style="color:#b5cea8">${m}</span>`);
  // Functions
  c=c.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,m=>`<span style="color:#dcdcaa">${m}</span>`);
  return c;
}

function TreeItem({node,depth,expanded,selected,onToggle,onSelect}:{node:TreeNode;depth:number;expanded:Set<string>;selected:string|null;onToggle:(p:string)=>void;onSelect:(p:string)=>void;}){
  const isDir=node.type==='dir';
  const isOpen=expanded.has(node.path);
  const isSel=selected===node.path;
  const children=Array.from(node.children.values()).sort((a,b)=>{
    if(a.type!==b.type)return a.type==='dir'?-1:1;
    return a.name.localeCompare(b.name);
  });
  return<div>
    <div onClick={()=>isDir?onToggle(node.path):onSelect(node.path)} style={{paddingLeft:depth*12+8}} className={`flex items-center gap-1.5 py-1 cursor-pointer rounded transition-colors text-xs ${isSel?'bg-brand-600 text-white':'hover:bg-white/10 text-gray-300'}`}>
      {isDir?(isOpen?<ChevronDown size={11} className="shrink-0 opacity-60"/>:<ChevronRight size={11} className="shrink-0 opacity-60"/>):<span className="w-3"/>}
      {isDir?<FolderOpen size={13} className={`shrink-0 ${isSel?'text-white':'text-yellow-400'}`}/>:<span className="text-[11px] shrink-0">{getFileIcon(node.name)}</span>}
      <span className="truncate">{node.name}</span>
      {!isDir&&node.size&&<span className="ml-auto text-[10px] opacity-40 shrink-0 pr-1">{node.size<1024?node.size+'b':Math.round(node.size/1024)+'k'}</span>}
    </div>
    {isDir&&isOpen&&children.map(c=><TreeItem key={c.path} node={c} depth={depth+1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect}/>)}
  </div>;
}

export function CodeEditorPanel({projectId,project,initialFile,initialLine,onClose,findingContext}:Props){
  const[files,setFiles]=useState<RepoFile[]>([]);
  const[treeLoading,setTreeLoading]=useState(true);
  const[expanded,setExpanded]=useState<Set<string>>(new Set());
  const[selected,setSelected]=useState<string|null>(initialFile??null);
  const[fileContent,setFileContent]=useState<string|null>(null);
  const[fileLoading,setFileLoading]=useState(false);
  const[fileError,setFileError]=useState<string|null>(null);
  const[copied,setCopied]=useState(false);
  const[search,setSearch]=useState('');
  const[fullscreen,setFullscreen]=useState(false);
  const[openTabs,setOpenTabs]=useState<string[]>(initialFile?[initialFile]:[]);
  const lineRef=useRef<HTMLDivElement>(null);

  const toggle=(p:string)=>setExpanded(s=>{const n=new Set(s);n.has(p)?n.delete(p):n.add(p);return n;});

  const loadTree=useCallback(async()=>{
    setTreeLoading(true);
    try{const d=await call({operation:'list',projectId});setFiles(d.files??[]);}
    catch(e){console.error(e);}
    setTreeLoading(false);
  },[projectId]);

  const loadFile=useCallback(async(path:string)=>{
    setFileLoading(true);setFileError(null);setFileContent(null);
    try{
      const d=await call({operation:'read',projectId,path});
      setFileContent(d.content??'');
    }catch(e:any){setFileError(e.message||'Failed to load file');}
    setFileLoading(false);
  },[projectId]);

  const selectFile=(path:string)=>{
    setSelected(path);
    if(!openTabs.includes(path))setOpenTabs(prev=>[...prev.slice(-4),path]);
    loadFile(path);
  };

  useEffect(()=>{loadTree();},[loadTree]);
  useEffect(()=>{
    if(initialFile){
      setSelected(initialFile);
      if(!openTabs.includes(initialFile))setOpenTabs([initialFile]);
      loadFile(initialFile);
      // Expand parent dirs
      const parts=initialFile.split('/');
      const dirs=parts.slice(0,-1).map((_,i)=>parts.slice(0,i+1).join('/'));
      setExpanded(new Set(dirs));
    }
  },[initialFile]);

  useEffect(()=>{
    if(initialLine&&lineRef.current){
      setTimeout(()=>lineRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),300);
    }
  },[initialLine,fileContent]);

  const copyFile=async()=>{
    if(fileContent){await navigator.clipboard.writeText(fileContent);setCopied(true);setTimeout(()=>setCopied(false),2000);}
  };

  const filteredFiles=search?files.filter(f=>f.path.toLowerCase().includes(search.toLowerCase())):null;
  const lang=selected?getLanguage(selected):'plaintext';
  const lines=fileContent?.split('\n')??[];

  return(
    <div className={`fixed inset-0 z-50 flex flex-col ${fullscreen?'':'md:inset-y-4 md:inset-x-4 md:rounded-xl overflow-hidden'}`} style={{background:'rgba(0,0,0,0.6)'}}>
      <div className={`flex flex-col bg-[#1e1e2e] text-gray-300 h-full ${fullscreen?'':'md:rounded-xl overflow-hidden'}`} style={{fontFamily:"'SF Mono','Fira Code','Cascadia Code',Consolas,monospace"}}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#181825] border-b border-[#313244] shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57] cursor-pointer" onClick={onClose}/>
            <div className="w-3 h-3 rounded-full bg-[#febc2e]"/>
            <div className="w-3 h-3 rounded-full bg-[#28c840]"/>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Code2 size={14} className="text-brand-400"/>
            <span className="text-xs font-medium text-gray-300">{project.name}</span>
            <span className="text-gray-600">/</span>
            <GitBranch size={12} className="text-gray-500"/>
            <span className="text-xs text-gray-500">{project.git_branch||'main'}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={()=>setFullscreen(f=>!f)} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
              {fullscreen?<Minimize2 size={13}/>:<Maximize2 size={13}/>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"><X size={13}/></button>
          </div>
        </div>

        {/* Finding context banner */}
        {findingContext&&(
          <div className="flex items-start gap-3 bg-[#2a1a1a] border-b border-red-900/50 px-4 py-2.5 shrink-0">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5"/>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-red-300">{findingContext.title}</p>
              <p className="text-xs text-red-400/80 mt-0.5">{findingContext.recommendation}</p>
            </div>
            {findingContext.line&&<span className="text-xs text-red-400 shrink-0 font-mono">Line {findingContext.line}</span>}
          </div>
        )}

        {/* Tabs bar */}
        {openTabs.length>0&&(
          <div className="flex items-center bg-[#181825] border-b border-[#313244] overflow-x-auto shrink-0">
            {openTabs.map(tab=>(
              <div key={tab} onClick={()=>selectFile(tab)} className={`flex items-center gap-2 px-4 py-2 text-xs border-r border-[#313244] cursor-pointer whitespace-nowrap transition-colors ${selected===tab?'bg-[#1e1e2e] text-gray-200 border-t border-t-brand-500':'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e2e]/50'}`}>
                <span>{getFileIcon(tab)}</span>
                <span>{tab.split('/').pop()}</span>
                <button onClick={e=>{e.stopPropagation();setOpenTabs(prev=>prev.filter(t=>t!==tab));if(selected===tab)setSelected(null);}} className="ml-1 opacity-0 hover:opacity-100 group-hover:opacity-60 rounded hover:bg-white/20 p-0.5 transition-all">
                  <X size={10}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main layout */}
        <div className="flex flex-1 min-h-0">
          {/* File tree sidebar */}
          <div className="w-56 shrink-0 border-r border-[#313244] bg-[#181825] flex flex-col">
            {/* Search */}
            <div className="px-2 py-2 border-b border-[#313244]">
              <div className="flex items-center gap-1.5 bg-[#313244] rounded px-2 py-1">
                <Search size={11} className="text-gray-500 shrink-0"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" className="bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none flex-1 w-full"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {treeLoading?<div className="flex justify-center py-8"><Spinner size={16}/></div>:
               search&&filteredFiles?(
                 filteredFiles.length===0?<p className="text-xs text-gray-600 px-3 py-2">No files match</p>:
                 filteredFiles.map(f=>(
                   <div key={f.path} onClick={()=>selectFile(f.path)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer rounded mx-1 transition-colors ${selected===f.path?'bg-brand-600 text-white':'text-gray-400 hover:bg-white/10 hover:text-gray-300'}`}>
                     <span>{getFileIcon(f.path)}</span>
                     <span className="truncate">{f.path}</span>
                   </div>
                 ))
               ):(
                 Array.from(buildTree(files).children.values()).sort((a,b)=>a.type!==b.type?a.type==='dir'?-1:1:a.name.localeCompare(b.name)).map(n=>(
                   <TreeItem key={n.path} node={n} depth={0} expanded={expanded} selected={selected} onToggle={toggle} onSelect={selectFile}/>
                 ))
               )
              }
            </div>
          </div>

          {/* Code view */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* File toolbar */}
            {selected&&(
              <div className="flex items-center gap-3 px-4 py-2 bg-[#1e1e2e] border-b border-[#313244] shrink-0">
                <span className="text-xs text-gray-500 font-mono truncate flex-1">{selected}</span>
                <span className="text-xs text-gray-600 uppercase">{lang}</span>
                <button onClick={copyFile} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  {copied?<><Check size={12} className="text-green-400"/>Copied</>:<><Copy size={12}/>Copy</>}
                </button>
              </div>
            )}

            {/* Code content */}
            <div className="flex-1 overflow-auto bg-[#1e1e2e]">
              {!selected?(
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Code2 size={40} className="text-gray-700 mb-4"/>
                  <p className="text-sm text-gray-600">Select a file from the explorer</p>
                  <p className="text-xs text-gray-700 mt-1">or search for a file above</p>
                </div>
              ):fileLoading?(
                <div className="flex items-center justify-center py-20"><Spinner size={20}/></div>
              ):fileError?(
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <AlertTriangle size={24} className="text-red-400"/>
                  <p className="text-sm text-red-400">{fileError}</p>
                  <button onClick={()=>loadFile(selected)} className="text-xs text-brand-400 hover:underline flex items-center gap-1"><RefreshCw size={12}/>Retry</button>
                </div>
              ):fileContent!==null?(
                <table className="w-full text-xs border-collapse" style={{fontSize:'12.5px',lineHeight:'1.6'}}>
                  <tbody>
                    {lines.map((line,i)=>{
                      const lineNum=i+1;
                      const isHighlight=initialLine===lineNum;
                      return(
                        <tr key={i} ref={isHighlight?lineRef:undefined} className={`group ${isHighlight?'bg-red-900/30':'hover:bg-white/5'}`}>
                          <td className="select-none text-right text-gray-600 px-3 py-0 w-12 shrink-0 border-r border-[#313244]" style={{minWidth:48,userSelect:'none'}}>
                            {isHighlight?<span className="text-red-400 font-bold">{lineNum}</span>:<span>{lineNum}</span>}
                          </td>
                          <td className="px-4 py-0 whitespace-pre font-mono" style={{color:'#cdd6f4'}}>
                            {isHighlight&&<span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-2 mb-0.5"/>}
                            <span dangerouslySetInnerHTML={{__html:syntaxHighlight(line,lang)}}/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ):null}
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 px-4 py-1.5 bg-brand-700 text-white text-[11px] shrink-0">
              <GitBranch size={11}/>
              <span>{project.git_branch||'main'}</span>
              {selected&&<><span className="text-brand-300">·</span><span className="text-brand-200">{selected}</span></>}
              {fileContent&&<><span className="text-brand-300">·</span><span>{lines.length} lines</span></>}
              {initialLine&&<><span className="text-brand-300">·</span><span className="text-red-300">⚠ Issue on line {initialLine}</span></>}
              <span className="ml-auto uppercase text-brand-300">{lang}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
