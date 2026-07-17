import{useCallback,useEffect,useRef,useState}from'react';
import{edgeFunctionUrl,anonKey,type Project,type RepoFile}from'../lib/supabase';
import{Spinner}from'../lib/ui';
import{X,Folder,File as FileIcon,ChevronRight,ChevronDown,RefreshCw,AlertTriangle,Copy,Check,Search,GitBranch,Code2,FolderOpen,Maximize2,Minimize2,Save,RotateCcz as Undo,Eye,EyeOff,Sparkles,GitCommit,Terminal,Download,MessageSquare,CheckCircle2,Loader as Loader2}from'lucide-react';

type TreeNode={name:string;path:string;type:'file'|'dir';children:Map<string,TreeNode>;size?:number|null};
type Props={projectId:string;project:Project;initialFile?:string|null;initialLine?:number|null;onClose:()=>void;findingContext?:{title:string;recommendation:string;line?:number;file?:string}|null;};
type Comment={line:number;text:string;author:string;resolved:boolean;id:string;};

const headers=()=>({'Content-Type':'application/json','Authorization':'Bearer '+anonKey,'apikey':anonKey});
const call=async(body:Record<string,unknown>)=>{
  const r=await fetch(edgeFunctionUrl+'/repo-operation',{method:'POST',headers:headers(),body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||r.statusText);
  return r.json();
};

function buildTree(files:RepoFile[]):TreeNode{
  const root:TreeNode={name:'',path:'',type:'dir',children:new Map()};
  for(const f of files){
    const parts=f.path.split('/');let cur=root;
    parts.forEach((part,i)=>{
      const isLast=i===parts.length-1;const path=parts.slice(0,i+1).join('/');
      let node=cur.children.get(part);
      if(!node){node={name:part,path,type:isLast?f.type:'dir',children:new Map(),size:isLast?f.size:null};cur.children.set(part,node);}
      else if(isLast){node.type=f.type;node.size=f.size;}
      cur=node;
    });
  }
  return root;
}

function getLanguage(path:string){
  const ext=path.split('.').pop()?.toLowerCase();
  const map:Record<string,string>={ts:'typescript',tsx:'tsx',js:'javascript',jsx:'jsx',py:'python',rb:'ruby',go:'go',rs:'rust',java:'java',cs:'csharp',cpp:'cpp',c:'c',php:'php',swift:'swift',kt:'kotlin',md:'markdown',json:'json',yaml:'yaml',yml:'yaml',toml:'toml',env:'dotenv',sh:'bash',dockerfile:'dockerfile',css:'css',scss:'scss',html:'html',xml:'xml',sql:'sql'};
  return map[ext??'']||'text';
}

function getFileIcon(name:string,isSelected=false):React.ReactNode{
  const ext=name.split('.').pop()?.toLowerCase();
  const lower=name.toLowerCase();
  const s=14;

  // Special filenames
  if(lower==='.env'||lower.startsWith('.env'))return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ECD53F"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#1a1a1a">.E</text></svg>;
  if(lower==='.gitignore'||lower==='.gitattributes')return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#F05032"/><path d="M8 2L14 6v8H2V6z" fill="none" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="9" r="2" fill="#fff"/></svg>;
  if(lower==='dockerfile'||lower.startsWith('dockerfile'))return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#2496ED"/><text x="1" y="12" fontSize="8" fontWeight="bold" fill="#fff">🐳</text></svg>;
  if(lower==='readme.md')return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#083FA1"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#fff">MD</text></svg>;
  if(lower==='package.json'||lower==='package-lock.json')return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#CB3837"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#fff">npm</text></svg>;
  if(lower==='tsconfig.json'||lower.startsWith('tsconfig'))return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#3178C6"/><text x="1" y="12" fontSize="8" fontWeight="bold" fill="#fff">TSC</text></svg>;

  switch(ext){
    case'ts':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#3178C6"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#fff">TS</text></svg>;
    case'tsx':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#3178C6"/><path d="M8 5.5c-1.4 0-2.5.6-2.5 1.5S6.6 8 8 8.5c1.4.5 2.5 1 2.5 2s-1.1 1.5-2.5 1.5" stroke="#61DAFB" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="1.2" fill="#61DAFB"/></svg>;
    case'js':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#F7DF1E"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#222">JS</text></svg>;
    case'jsx':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#F7DF1E"/><path d="M8 5.5c-1.4 0-2.5.6-2.5 1.5S6.6 8 8 8.5c1.4.5 2.5 1 2.5 2s-1.1 1.5-2.5 1.5" stroke="#222" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="1.2" fill="#222"/></svg>;
    case'py':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#3572A5"/><path d="M5 4h3c1 0 2 .9 2 2v1H5V4z" fill="#FFD43B"/><path d="M11 8H8c-1 0-2 .9-2 2v2h5V8z" fill="#FFD43B"/><circle cx="6.5" cy="5.5" r=".7" fill="#3572A5"/><circle cx="9.5" cy="10.5" r=".7" fill="#3572A5"/></svg>;
    case'rb':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#CC342D"/><text x="3" y="12" fontSize="10" fontWeight="bold" fill="#fff">rb</text></svg>;
    case'go':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#00ADD8"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#fff">Go</text></svg>;
    case'rs':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#DEA584"/><text x="3" y="12" fontSize="9" fontWeight="bold" fill="#000">rs</text></svg>;
    case'java':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#ED8B00"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#fff">Java</text></svg>;
    case'cs':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#9B4F96"/><text x="3" y="12" fontSize="9" fontWeight="bold" fill="#fff">C#</text></svg>;
    case'cpp':case'cc':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#004488"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#fff">C++</text></svg>;
    case'c':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#555599"/><text x="4" y="12" fontSize="10" fontWeight="bold" fill="#fff">C</text></svg>;
    case'php':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#777BB4"/><text x="1" y="12" fontSize="8" fontWeight="bold" fill="#fff">PHP</text></svg>;
    case'swift':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#FA7343"/><path d="M12 5C10.5 3.5 7.5 3 5 5c2 1 3.5 2.5 4 4.5C10 8 11 6.5 12 5z" fill="#fff"/><path d="M4 11c1.5 1.5 5 2 7 0-2-.5-3.5-2-4-4C6 8.5 4.5 10 4 11z" fill="#fff"/></svg>;
    case'kt':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#7F52FF"/><path d="M3 3h5l-5 5V3zm0 5l5 5H3v-5zm5 0l5-5v10L8 8z" fill="#fff"/></svg>;
    case'md':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#083FA1"/><path d="M2 11V5h2l2 2.5L8 5h2v6h-2V8L8 10H6L4.5 8v3H2z" fill="#fff"/><path d="M11 5v6h2V9l1.5 2 1.5-2v3h2V5h-2l-1.5 2L13 5h-2z" fill="#fff"/></svg>;
    case'json':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#CBCB41"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#222">{"{}"}</text></svg>;
    case'yaml':case'yml':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#CB171E"/><text x="1" y="12" fontSize="7" fontWeight="bold" fill="#fff">YAML</text></svg>;
    case'toml':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#9C4121"/><text x="1" y="12" fontSize="7" fontWeight="bold" fill="#fff">TOML</text></svg>;
    case'sh':case'bash':case'zsh':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#89E051"/><text x="2" y="12" fontSize="9" fontWeight="bold" fill="#222">$_</text></svg>;
    case'css':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#1572B6"/><text x="1" y="12" fontSize="8" fontWeight="bold" fill="#fff">CSS</text></svg>;
    case'scss':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#CD6799"/><text x="1" y="12" fontSize="7" fontWeight="bold" fill="#fff">SCSS</text></svg>;
    case'html':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#E34C26"/><text x="1" y="12" fontSize="7" fontWeight="bold" fill="#fff">HTML</text></svg>;
    case'xml':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#F16529"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#fff">XML</text></svg>;
    case'sql':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#DA3434"/><text x="2" y="12" fontSize="8" fontWeight="bold" fill="#fff">SQL</text></svg>;
    case'svg':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#FFB13B"/><circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>;
    case'png':case'jpg':case'jpeg':case'gif':case'webp':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#A074C4"/><path d="M2 12l3-4 2 2.5 3-4 4 5.5H2z" fill="#fff"/><circle cx="11" cy="5" r="2" fill="#FFD700"/></svg>;
    case'lock':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#6e7681"/><rect x="4" y="7" width="8" height="6" rx="1" fill="#fff"/><path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>;
    case'pdf':return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#E34234"/><text x="1" y="12" fontSize="7" fontWeight="bold" fill="#fff">PDF</text></svg>;
    default:return<svg width={s} height={s} viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#6e7681"/><path d="M4 4h5l3 3v5H4V4z" fill="none" stroke="#ccc" strokeWidth="1"/><path d="M9 4v3h3" fill="none" stroke="#ccc" strokeWidth="1"/></svg>;
  }
}

function TreeItem({node,depth,expanded,selected,onToggle,onSelect}:{node:TreeNode;depth:number;expanded:Set<string>;selected:string|null;onToggle:(p:string)=>void;onSelect:(p:string)=>void;}){
  const isDir=node.type==='dir';const isOpen=expanded.has(node.path);const isSel=selected===node.path;
  const children=Array.from(node.children.values()).sort((a,b)=>a.type!==b.type?a.type==='dir'?-1:1:a.name.localeCompare(b.name));
  return<div>
    <div onClick={()=>isDir?onToggle(node.path):onSelect(node.path)} style={{paddingLeft:depth*14+6}} className={`flex items-center gap-1.5 py-[3px] cursor-pointer rounded-sm transition-all text-[12px] select-none ${isSel?'bg-[#2d4a3e] text-white':'hover:bg-white/8 text-[#cccccc]'}`}>
      {isDir?(isOpen?<ChevronDown size={10} className="shrink-0 text-gray-500"/>:<ChevronRight size={10} className="shrink-0 text-gray-500"/>):<span className="w-2.5"/>}
      {isDir?<FolderOpen size={13} className={`shrink-0 ${isOpen?'text-[#e8c27a]':'text-[#dcb67a]'}`}/>:<span className="shrink-0 flex items-center">{getFileIcon(node.name)}</span>}
      <span className="truncate">{node.name}</span>
      {!isDir&&node.size&&<span className="ml-auto text-[10px] text-gray-600 shrink-0 pr-2">{node.size<1024?node.size+'b':Math.round(node.size/1024)+'k'}</span>}
    </div>
    {isDir&&isOpen&&children.map(c=><TreeItem key={c.path} node={c} depth={depth+1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect}/>)}
  </div>;
}

export function CodeEditorPanel({projectId,project,initialFile,initialLine,onClose,findingContext}:Props){
  const[files,setFiles]=useState<RepoFile[]>([]);
  const[treeLoading,setTreeLoading]=useState(true);
  const[expanded,setExpanded]=useState<Set<string>>(new Set());
  const[selected,setSelected]=useState<string|null>(initialFile??null);
  const[fileContent,setFileContent]=useState<string>('');
  const[editedContent,setEditedContent]=useState<string>('');
  const[fileLoading,setFileLoading]=useState(false);
  const[fileError,setFileError]=useState<string|null>(null);
  const[isDirty,setIsDirty]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[copied,setCopied]=useState(false);
  const[search,setSearch]=useState('');
  const[fullscreen,setFullscreen]=useState(false);
  const[openTabs,setOpenTabs]=useState<string[]>(initialFile?[initialFile]:[]);
  const[showLineNumbers,setShowLineNumbers]=useState(true);
  const[wordWrap,setWordWrap]=useState(false);
  const[activePanel,setActivePanel]=useState<'none'|'ai'|'comments'|'terminal'>('none');
  const[aiPrompt,setAiPrompt]=useState('');
  const[aiLoading,setAiLoading]=useState(false);
  const[aiResponse,setAiResponse]=useState('');
  const[comments,setComments]=useState<Comment[]>([]);
  const[newComment,setNewComment]=useState('');
  const[commentLine,setCommentLine]=useState<number|null>(null);
  const[cursor,setCursor]=useState({line:1,col:1});
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const highlightLineRef=useRef<HTMLDivElement>(null);

  const toggle=(p:string)=>setExpanded(s=>{const n=new Set(s);n.has(p)?n.delete(p):n.add(p);return n;});

  const loadTree=useCallback(async()=>{
    setTreeLoading(true);
    try{const d=await call({operation:'list',projectId});setFiles(d.files??[]);}
    catch(e){console.error(e);}
    setTreeLoading(false);
  },[projectId]);

  const loadFile=useCallback(async(path:string)=>{
    setFileLoading(true);setFileError(null);setFileContent('');setEditedContent('');setIsDirty(false);
    try{
      const d=await call({operation:'read',projectId,path});
      const content=d.content??'';
      setFileContent(content);setEditedContent(content);
    }catch(e:any){setFileError(e.message||'Failed to load file');}
    setFileLoading(false);
  },[projectId]);

  const selectFile=(path:string)=>{
    if(isDirty&&!confirm('You have unsaved changes. Discard them?'))return;
    setSelected(path);setIsDirty(false);
    if(!openTabs.includes(path))setOpenTabs(prev=>[...prev.slice(-6),path]);
    loadFile(path);
  };

  const saveFile=async()=>{
    if(!selected||!isDirty)return;
    setSaving(true);
    try{
      await call({operation:'write',projectId,path:selected,content:editedContent,message:`Edit ${selected} via LytHouse`});
      setFileContent(editedContent);setIsDirty(false);setSaved(true);
      setTimeout(()=>setSaved(false),2000);
    }catch(e:any){alert('Save failed: '+e.message);}
    setSaving(false);
  };

  const handleEdit=(val:string)=>{
    setEditedContent(val);
    setIsDirty(val!==fileContent);
  };

  const handleKeyDown=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    // Tab key inserts spaces
    if(e.key==='Tab'){
      e.preventDefault();
      const ta=e.currentTarget;
      const start=ta.selectionStart;const end=ta.selectionEnd;
      const newVal=editedContent.substring(0,start)+'  '+editedContent.substring(end);
      handleEdit(newVal);
      setTimeout(()=>{ta.selectionStart=ta.selectionEnd=start+2;},0);
    }
    // Ctrl+S saves
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveFile();}
    // Ctrl+/ comments
    if((e.ctrlKey||e.metaKey)&&e.key=='/'){
      e.preventDefault();
      const ta=e.currentTarget;const start=ta.selectionStart;
      const lineStart=editedContent.lastIndexOf('\n',start-1)+1;
      const lang=selected?getLanguage(selected):'text';
      const commentChar=lang==='python'||lang==='bash'||lang==='yaml'?'# ':'// ';
      const line=editedContent.substring(lineStart,editedContent.indexOf('\n',start));
      const newLine=line.startsWith(commentChar)?line.slice(commentChar.length):commentChar+line;
      const newVal=editedContent.substring(0,lineStart)+newLine+editedContent.substring(lineStart+line.length);
      handleEdit(newVal);
    }
  };

  const updateCursor=(e:React.SyntheticEvent<HTMLTextAreaElement>)=>{
    const ta=e.currentTarget;
    const text=ta.value.substring(0,ta.selectionStart);
    const lines=text.split('\n');
    setCursor({line:lines.length,col:lines[lines.length-1].length+1});
  };

  const askAI=async()=>{
    if(!aiPrompt.trim())return;
    setAiLoading(true);setAiResponse('');
    try{
      const res=await fetch(`${edgeFunctionUrl}/ai-chat`,{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${anonKey}`,'apikey':anonKey},
        body:JSON.stringify({
          systemPrompt:`You are a senior software engineer reviewing code. Be concise and technical. The file being reviewed is: ${selected||'unknown'}. Language: ${selected?getLanguage(selected):'unknown'}.${findingContext?` There is a known security finding: "${findingContext.title}". Recommendation: "${findingContext.recommendation}".`:''}`,
          messages:[{role:'user',content:`${aiPrompt}\n\nCurrent file content:\n\`\`\`\n${editedContent.slice(0,3000)}\n\`\`\``}]
        })
      });
      if(res.ok){const d=await res.json();setAiResponse(d.content||'No response');}
      else setAiResponse('AI service unavailable. Deploy the ai-chat edge function.');
    }catch{setAiResponse('Failed to connect to AI service.');}
    setAiLoading(false);
  };

  const addComment=()=>{
    if(!newComment.trim()||!commentLine)return;
    setComments(prev=>[...prev,{id:Date.now().toString(),line:commentLine,text:newComment,author:'You',resolved:false}]);
    setNewComment('');setCommentLine(null);
  };

  const[downloading,setDownloading]=useState(false);
  const downloadRepo=async()=>{
    setDownloading(true);
    try{
      // Dynamically load JSZip
      const {default:JSZip}=await import('jszip');
      const zip=new JSZip();
      const d=await call({operation:'list',projectId});
      const allFiles:RepoFile[]=(d.files??[]).filter((f:RepoFile)=>f.type==='file');
      let done=0;
      for(const f of allFiles){
        try{
          const fd=await call({operation:'read',projectId,path:f.path});
          zip.file(f.path,fd.content||'');
        }catch{zip.file(f.path,'// Could not read file');}
        done++;
      }
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`${project.name}-${project.git_branch||'main'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }catch(e:any){alert('Download failed: '+e.message);}
    setDownloading(false);
  };

  useEffect(()=>{loadTree();},[loadTree]);
  useEffect(()=>{
    if(initialFile){
      setSelected(initialFile);
      if(!openTabs.includes(initialFile))setOpenTabs([initialFile]);
      loadFile(initialFile);
      const parts=initialFile.split('/');
      const dirs=parts.slice(0,-1).map((_,i)=>parts.slice(0,i+1).join('/'));
      setExpanded(new Set(dirs));
    }
  },[initialFile]);

  useEffect(()=>{
    if(initialLine&&highlightLineRef.current){
      setTimeout(()=>highlightLineRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),400);
    }
  },[initialLine,fileContent]);

  const filteredFiles=search?files.filter(f=>f.path.toLowerCase().includes(search.toLowerCase())):null;
  const lang=selected?getLanguage(selected):'text';
  const lines=editedContent.split('\n');
  const openComments=comments.filter(c=>!c.resolved);

  return(
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'rgba(0,0,0,0.7)'}}>
      <div className={`flex flex-col bg-[#1e1e2e] text-gray-300 ${fullscreen?'h-full':'m-4 rounded-xl overflow-hidden shadow-2xl'}`} style={{height:fullscreen?'100%':'calc(100vh - 32px)',fontFamily:"'SF Mono','Fira Code',Consolas,monospace"}}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#181825] border-b border-[#313244] shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57] cursor-pointer hover:brightness-90" onClick={onClose}/>
            <div className="w-3 h-3 rounded-full bg-[#febc2e]"/>
            <div className="w-3 h-3 rounded-full bg-[#28c840]"/>
          </div>
          <div className="flex items-center gap-2 ml-3 text-xs text-gray-400">
            <Code2 size={13} className="text-brand-400"/>
            <span className="font-medium text-gray-300">{project.name}</span>
            <span className="text-gray-600">/</span>
            <GitBranch size={11} className="text-gray-500"/>
            <span className="text-gray-500">{project.git_branch||'main'}</span>
            {isDirty&&<span className="ml-1 text-amber-400 text-[10px]">● unsaved</span>}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {/* Toolbar actions */}
            <button onClick={()=>setShowLineNumbers(l=>!l)} title="Toggle line numbers" className={`p-1.5 rounded text-xs transition-colors ${showLineNumbers?'text-brand-400':'text-gray-600'} hover:bg-white/10`}><Eye size={13}/></button>
            <button onClick={()=>setWordWrap(w=>!w)} title="Toggle word wrap" className={`p-1.5 rounded text-xs transition-colors ${wordWrap?'text-brand-400':'text-gray-600'} hover:bg-white/10`}><span className="text-[11px] font-bold">⏎</span></button>
            <div className="w-px h-4 bg-gray-700 mx-1"/>
            <button onClick={()=>setActivePanel(p=>p==='ai'?'none':'ai')} title="AI Code Review" className={`p-1.5 rounded transition-colors ${activePanel==='ai'?'bg-brand-600 text-white':'text-gray-500 hover:text-gray-300 hover:bg-white/10'}`}><Sparkles size={13}/></button>
            <button onClick={()=>setActivePanel(p=>p==='comments'?'none':'comments')} title="Comments" className={`p-1.5 rounded transition-colors relative ${activePanel==='comments'?'bg-brand-600 text-white':'text-gray-500 hover:text-gray-300 hover:bg-white/10'}`}>
              <MessageSquare size={13}/>
              {openComments.length>0&&<span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{openComments.length}</span>}
            </button>
            <div className="w-px h-4 bg-gray-700 mx-1"/>
            <button onClick={downloadRepo} disabled={downloading} title="Download entire repository" className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50">
              {downloading?<Loader2 size={13} className="animate-spin"/>:<Download size={13}/>}
            </button>
            <button onClick={async()=>{if(editedContent){await navigator.clipboard.writeText(editedContent);setCopied(true);setTimeout(()=>setCopied(false),2000);}}} title="Copy all" className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors">
              {copied?<Check size={13} className="text-green-400"/>:<Copy size={13}/>}
            </button>
            <button onClick={saveFile} disabled={!isDirty||saving} title="Save (Ctrl+S)" className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${isDirty?'bg-brand-600 text-white hover:bg-brand-700':'text-gray-600 cursor-not-allowed'}`}>
              {saving?<Loader2 size={12} className="animate-spin"/>:saved?<Check size={12}/>:<Save size={12}/>}
              {saved?'Saved':'Save'}
            </button>
            <button onClick={()=>setFullscreen(f=>!f)} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors ml-1">
              {fullscreen?<Minimize2 size={13}/>:<Maximize2 size={13}/>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 transition-colors"><X size={13}/></button>
          </div>
        </div>

        {/* Finding banner */}
        {findingContext&&(
          <div className="flex items-start gap-3 bg-[#2a1215] border-b border-red-900/40 px-4 py-2 shrink-0">
            <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-300">{findingContext.title}</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">{findingContext.recommendation}</p>
            </div>
            {findingContext.line&&<span className="text-[11px] text-red-400 font-mono shrink-0">Line {findingContext.line}</span>}
          </div>
        )}

        {/* Tabs */}
        {openTabs.length>0&&(
          <div className="flex items-center bg-[#181825] border-b border-[#313244] overflow-x-auto shrink-0" style={{minHeight:35}}>
            {openTabs.map(tab=>(
              <div key={tab} className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-r border-[#313244] cursor-pointer whitespace-nowrap group transition-colors ${selected===tab?'bg-[#1e1e2e] text-gray-200 border-t-2 border-t-brand-500':'text-gray-600 hover:text-gray-400'}`} onClick={()=>selectFile(tab)}>
                <span className="shrink-0 flex items-center">{getFileIcon(tab)}</span>
                <span>{tab.split('/').pop()}</span>
                {isDirty&&selected===tab&&<span className="text-amber-400 text-[10px]">●</span>}
                <button onClick={e=>{e.stopPropagation();if(isDirty&&selected===tab&&!confirm('Discard changes?'))return;setOpenTabs(p=>p.filter(t=>t!==tab));if(selected===tab){setSelected(null);setEditedContent('');setFileContent('');}}} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 ml-0.5 rounded hover:bg-white/20 p-0.5 transition-all"><X size={9}/></button>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* File tree */}
          <div className="w-52 shrink-0 border-r border-[#313244] bg-[#181825] flex flex-col">
            <div className="px-2 py-1.5 border-b border-[#313244]">
              <div className="flex items-center gap-1.5 bg-[#252535] rounded px-2 py-1">
                <Search size={11} className="text-gray-600 shrink-0"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" className="bg-transparent text-[12px] text-gray-300 placeholder-gray-700 outline-none flex-1 w-full"/>
                {search&&<button onClick={()=>setSearch('')} className="text-gray-600 hover:text-gray-400"><X size={10}/></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {treeLoading
                ?<div className="flex justify-center py-8"><Spinner size={14}/></div>
                :search&&filteredFiles
                  ?filteredFiles.length===0
                    ?<p className="text-[11px] text-gray-600 px-3 py-2">No matches</p>
                    :filteredFiles.map(f=>(
                      <div key={f.path} onClick={()=>selectFile(f.path)} className={`flex items-center gap-1.5 px-2 py-1 text-[12px] cursor-pointer rounded-sm mx-1 transition-colors ${selected===f.path?'bg-[#2d4a3e] text-white':'text-gray-400 hover:bg-white/8 hover:text-gray-300'}`}>
                        <span className="shrink-0 flex items-center">{getFileIcon(f.path)}</span>
                        <span className="truncate">{f.path}</span>
                      </div>
                    ))
                  :Array.from(buildTree(files).children.values())
                    .sort((a,b)=>a.type!==b.type?a.type==='dir'?-1:1:a.name.localeCompare(b.name))
                    .map(n=><TreeItem key={n.path} node={n} depth={0} expanded={expanded} selected={selected} onToggle={toggle} onSelect={selectFile}/>)
              }
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex min-w-0">
            {/* Code editor */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              {!selected
                ?<div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <Code2 size={48} className="text-gray-700"/>
                  <p className="text-sm text-gray-600">Select a file to start editing</p>
                  <p className="text-xs text-gray-700">Ctrl+S to save · Tab to indent · Ctrl+/ to comment</p>
                </div>
                :fileLoading
                  ?<div className="flex items-center justify-center py-20"><Spinner size={18}/></div>
                  :fileError
                    ?<div className="flex flex-col items-center justify-center h-full gap-3">
                      <AlertTriangle size={22} className="text-red-400"/>
                      <p className="text-sm text-red-400">{fileError}</p>
                      <button onClick={()=>selected&&loadFile(selected)} className="text-xs text-brand-400 hover:underline flex items-center gap-1"><RefreshCw size={12}/>Retry</button>
                    </div>
                    :<div className="flex flex-1 overflow-hidden">
                      {/* Line numbers */}
                      {showLineNumbers&&(
                        <div className="select-none text-right text-[12px] text-gray-600 bg-[#1e1e2e] border-r border-[#313244] overflow-hidden shrink-0" style={{minWidth:48,paddingTop:8,paddingBottom:8,lineHeight:'1.6',fontFamily:'inherit'}}>
                          {lines.map((_,i)=>{
                            const ln=i+1;
                            const hasComment=comments.some(c=>c.line===ln&&!c.resolved);
                            const isHighlight=initialLine===ln;
                            return<div key={i} ref={isHighlight?highlightLineRef:undefined} onClick={()=>{setCommentLine(ln);setActivePanel('comments');}} className={`px-3 cursor-pointer hover:text-gray-400 transition-colors ${isHighlight?'text-red-400 font-bold':hasComment?'text-amber-400':''}`} style={{lineHeight:'1.6'}}>
                              {hasComment?'●':ln}
                            </div>;
                          })}
                        </div>
                      )}
                      {/* Textarea */}
                      <div className="relative flex-1 overflow-auto">
                        {initialLine&&(
                          <div className="absolute left-0 right-0 pointer-events-none" style={{top:`${(initialLine-1)*19.2}px`,height:19.2,background:'rgba(220,53,53,0.15)',borderLeft:'2px solid #dc3535'}}/>
                        )}
                        <textarea
                          ref={textareaRef}
                          value={editedContent}
                          onChange={e=>handleEdit(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onSelect={updateCursor}
                          onClick={updateCursor}
                          spellCheck={false}
                          className="w-full h-full bg-transparent text-[#cdd6f4] text-[12.5px] outline-none resize-none"
                          style={{
                            lineHeight:1.6,
                            padding:'8px 16px',
                            fontFamily:"'SF Mono','Fira Code',Consolas,monospace",
                            whiteSpace:wordWrap?'pre-wrap':'pre',
                            overflowX:wordWrap?'hidden':'auto',
                            minHeight:'100%',
                            caretColor:'#a6e3a1',
                          }}
                        />
                      </div>
                    </div>
              }
            </div>

            {/* Right panel — AI or Comments */}
            {activePanel!=='none'&&(
              <div className="w-72 shrink-0 border-l border-[#313244] bg-[#181825] flex flex-col">
                <div className="flex items-center border-b border-[#313244] shrink-0">
                  {[{id:'ai',label:'AI Review',icon:Sparkles},{id:'comments',label:`Comments (${openComments.length})`,icon:MessageSquare}].map(p=>(
                    <button key={p.id} onClick={()=>setActivePanel(p.id as any)} className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${activePanel===p.id?'border-brand-500 text-brand-400':'border-transparent text-gray-600 hover:text-gray-400'}`}>
                      <p.icon size={12}/>{p.label}
                    </button>
                  ))}
                  <button onClick={()=>setActivePanel('none')} className="ml-auto p-2 text-gray-600 hover:text-gray-400"><X size={12}/></button>
                </div>

                {activePanel==='ai'&&(
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3">
                      {!aiResponse&&!aiLoading&&(
                        <div className="space-y-2">
                          <p className="text-[11px] text-gray-600 mb-3">Ask AI to review, explain, or improve this file:</p>
                          {['Explain what this file does','Find security vulnerabilities','Suggest performance improvements','Review for best practices','Generate unit tests for this code','Fix the security finding on line '+(initialLine||1)].map(q=>(
                            <button key={q} onClick={()=>{setAiPrompt(q);}} className="w-full text-left text-[11px] text-gray-400 hover:text-gray-200 px-2.5 py-1.5 rounded bg-[#252535] hover:bg-[#2d2d3f] transition-colors border border-transparent hover:border-[#313244]">{q}</button>
                          ))}
                        </div>
                      )}
                      {aiLoading&&<div className="flex items-center gap-2 py-4"><Loader2 size={14} className="animate-spin text-brand-400"/><span className="text-xs text-gray-500">Analyzing code…</span></div>}
                      {aiResponse&&(
                        <div className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap">{aiResponse}</div>
                      )}
                    </div>
                    <div className="p-2 border-t border-[#313244] shrink-0">
                      <div className="flex gap-1.5">
                        <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Ask about this code…" className="flex-1 bg-[#252535] text-[12px] text-gray-300 placeholder-gray-700 rounded px-2.5 py-1.5 outline-none border border-[#313244] focus:border-brand-600"/>
                        <button onClick={askAI} disabled={aiLoading||!aiPrompt.trim()} className="px-2.5 py-1.5 bg-brand-600 text-white rounded text-[11px] disabled:opacity-50 hover:bg-brand-700 transition-colors"><Sparkles size={12}/></button>
                      </div>
                      {aiResponse&&<button onClick={()=>{setAiResponse('');setAiPrompt('');}} className="mt-1.5 text-[10px] text-gray-600 hover:text-gray-400">Clear</button>}
                    </div>
                  </div>
                )}

                {activePanel==='comments'&&(
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {commentLine&&(
                        <div className="bg-[#252535] rounded p-2 border border-brand-700">
                          <p className="text-[11px] text-brand-400 mb-1.5">Comment on line {commentLine}</p>
                          <textarea value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Add a comment…" className="w-full bg-[#1e1e2e] text-[12px] text-gray-300 rounded px-2 py-1.5 outline-none border border-[#313244] focus:border-brand-600 resize-none" rows={3}/>
                          <div className="flex gap-1.5 mt-1.5">
                            <button onClick={addComment} disabled={!newComment.trim()} className="text-[11px] px-2.5 py-1 bg-brand-600 text-white rounded disabled:opacity-50">Add</button>
                            <button onClick={()=>{setCommentLine(null);setNewComment('');}} className="text-[11px] px-2 py-1 text-gray-600 hover:text-gray-400">Cancel</button>
                          </div>
                        </div>
                      )}
                      {comments.length===0&&!commentLine&&(
                        <div className="text-center py-8">
                          <MessageSquare size={24} className="mx-auto text-gray-700 mb-2"/>
                          <p className="text-[11px] text-gray-600">No comments yet</p>
                          <p className="text-[10px] text-gray-700 mt-1">Click a line number to add a comment</p>
                        </div>
                      )}
                      {comments.map(c=>(
                        <div key={c.id} className={`rounded p-2.5 border ${c.resolved?'border-[#313244] opacity-50':'border-[#313244] bg-[#252535]'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-brand-400 font-medium">Line {c.line}</span>
                            <button onClick={()=>setComments(prev=>prev.map(x=>x.id===c.id?{...x,resolved:!x.resolved}:x))} className={`text-[10px] flex items-center gap-1 ${c.resolved?'text-gray-600':'text-green-400 hover:text-green-300'}`}>
                              <CheckCircle2 size={10}/>{c.resolved?'Resolved':'Resolve'}
                            </button>
                          </div>
                          <p className="text-[12px] text-gray-300">{c.text}</p>
                          <p className="text-[10px] text-gray-600 mt-1">{c.author}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-4 py-1 bg-[#2d8a2d] text-white text-[11px] shrink-0">
          <GitBranch size={11}/><span>{project.git_branch||'main'}</span>
          {selected&&<><span className="text-green-300 opacity-60">·</span><span className="text-green-100 opacity-90">{selected}</span></>}
          <span className="text-green-300 opacity-60">·</span>
          <span>{lines.length} lines</span>
          <span className="text-green-300 opacity-60">·</span>
          <span>Ln {cursor.line}, Col {cursor.col}</span>
          {isDirty&&<><span className="text-green-300 opacity-60">·</span><span className="text-amber-300">Unsaved changes</span></>}
          {initialLine&&<><span className="text-green-300 opacity-60">·</span><span className="text-red-300">⚠ Issue on line {initialLine}</span></>}
          <span className="ml-auto uppercase opacity-70">{lang}</span>
          <span className="opacity-70">UTF-8</span>
        </div>
      </div>
    </div>
  );
}
