import {create} from 'zustand';
import {workflows as seed} from '../../mock-data/workflows';
import {instances} from '../../mock-data/instances';
import {batches as seedBatches,ledger as seedLedger,audit as seedAudit} from '../../mock-data/batches';
import type {AuditEntry,AutomationAction,ExternalTransaction,FlowEdge,FlowNode,RetryBatch,ValidationIssue,Workflow} from '../types';
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const validate=(w:Workflow):ValidationIssue[]=>{const issues:ValidationIssue[]=[]; if(!w.nodes.some(n=>n.type==='end')) issues.push({nodeId:w.nodes[0]?.id||'flow',level:'error',message:'流程缺少结束节点'}); const linked=new Set(w.edges.flatMap(e=>[e.source,e.target])); w.nodes.filter(n=>n.type!=='start'&&n.type!=='end'&&!linked.has(n.id)).forEach(n=>issues.push({nodeId:n.id,level:'error',message:'必经节点不能孤立'})); w.nodes.forEach(n=>{if(n.type==='condition'&&!n.data.config.ruleType)issues.push({nodeId:n.id,level:'error',message:'条件分支规则未配置'}); if(n.type==='approval'&&!n.data.config.approverSource)issues.push({nodeId:n.id,level:'error',message:'审批人不能为空'});}); return issues};
/* ---- 可恢复重试批次引擎 ---- */
const actionTemplates:Record<string,{label:string;kind:string;deps:number[]}[]>={
 '金额判断':[{label:'重算分支规则',kind:'规则引擎',deps:[]},{label:'写入系统记录',kind:'系统记录',deps:[0]},{label:'发送 Webhook（模拟）',kind:'Webhook',deps:[1]},{label:'创建工单',kind:'工单',deps:[1]}],
 '直属主管审批':[{label:'重建审批任务',kind:'审批中心',deps:[]},{label:'同步待办中心',kind:'待办中心',deps:[0]},{label:'发送提醒通知',kind:'通知服务',deps:[1]}]};
let txSeq=6601,auditSeq=101;
const NOW='2026-07-11 17:30';
const nextBatchId=(bs:RetryBatch[])=>'RB-2026-'+String(Math.max(0,...bs.map(b=>Number(b.id.slice(-4))))+1).padStart(4,'0');
const pushAudit=(audit:AuditEntry[],batchId:string,event:string,detail:string,actor='系统')=>{audit.push({id:'AU-'+String(auditSeq++).padStart(4,'0'),batchId,time:NOW,actor,event,detail})};
const buildActions=(batchId:string,nodeLabel:string):AutomationAction[]=>{const tpl=actionTemplates[nodeLabel]||actionTemplates['直属主管审批'];const ids=tpl.map((_,i)=>`${batchId}-a${i+1}`);return tpl.map((t,i)=>({id:ids[i],label:t.label,kind:t.kind,dependsOn:t.deps.map(d=>ids[d]),state:'pending' as const,replayable:true}))};
/* 批次激活后先执行到故障点：前序动作成功并写入外部流水，故障点动作停留在执行中 */
const runInitial=(b:RetryBatch,ledger:ExternalTransaction[],audit:AuditEntry[])=>{
 const hookIdx=b.actions.findIndex(a=>a.kind==='Webhook');
 const stopAt=hookIdx>=0?hookIdx:b.actions.length-1;
 b.actions.forEach((a,i)=>{
  if(i<stopAt){a.state='success';a.externalTxId='EXT-2026-'+txSeq++;ledger.push({id:a.externalTxId,batchId:b.id,actionId:a.id,direction:'write',system:a.kind,status:'posted'});pushAudit(audit,b.id,'动作成功',`${a.label} → 外部流水 ${a.externalTxId}`)}
  else if(i===stopAt){a.state='running';pushAudit(audit,b.id,'动作执行中',`${a.label} 正在调用外部系统`)}})};
const sameKey=(a:RetryBatch,b:RetryBatch)=>a.instanceId===b.instanceId&&a.nodeLabel===b.nodeLabel;
const inFlight=(b:RetryBatch)=>b.status==='running'||b.status==='compensating';
/* 进行中的批次终结后，同例同节点最早排队的待处理批次自动接手 */
const activateNext=(batches:RetryBatch[],ledger:ExternalTransaction[],audit:AuditEntry[],done:RetryBatch)=>{
 if(batches.some(b=>b.id!==done.id&&sameKey(b,done)&&inFlight(b)))return;
 const next=batches.filter(b=>sameKey(b,done)&&b.status==='pending').sort((a,b)=>a.attempt-b.attempt)[0];
 if(!next)return;
 next.status='running';
 pushAudit(audit,next.id,'批次接手',`${next.window} 提交的待处理批次开始执行`);
 runInitial(next,ledger,audit)};
interface State{workflows:Workflow[];instances:typeof instances;batches:RetryBatch[];ledger:ExternalTransaction[];audit:AuditEntry[];currentId:string;selectedNodeId:string|null;issues:ValidationIssue[];toast:string;setCurrent:(id:string)=>void;selectNode:(id:string|null)=>void;updateNodes:(nodes:FlowNode[])=>void;updateEdges:(edges:FlowEdge[])=>void;updateConfig:(id:string,config:Record<string,any>)=>void;runValidation:()=>ValidationIssue[];save:()=>void;publish:()=>void;create:()=>string;copy:(id:string)=>void;archive:(id:string)=>void;restore:(v:number)=>void;clearToast:()=>void;startRetry:(instanceId:string,win:string)=>void;simulateFailure:(batchId:string)=>void;resumeBatch:(batchId:string)=>void;reconcileBatch:(batchId:string)=>void;repairLedger:(batchId:string)=>void}
export const useAppStore=create<State>((set,get)=>({workflows:clone(seed),instances,batches:clone(seedBatches),ledger:clone(seedLedger),audit:clone(seedAudit),currentId:'wf-1',selectedNodeId:null,issues:[],toast:'',setCurrent:id=>set({currentId:id,selectedNodeId:null,issues:[]}),selectNode:id=>set({selectedNodeId:id}),updateNodes:nodes=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes}:w)})),updateEdges:edges=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,edges}:w)})),updateConfig:(id,config)=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes:w.nodes.map(n=>n.id===id?{...n,data:{...n.data,config:{...n.data.config,...config},state:'configuring'}}:n)}:w)})),runValidation:()=>{const w=get().workflows.find(x=>x.id===get().currentId)!; const issues=validate(w); set(s=>({issues,workflows:s.workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id)?'invalid':'valid'}}))}:x),toast:issues.length?`发现 ${issues.length} 个问题`:'校验通过'}));return issues},save:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'draft',updatedAt:'2026-07-11 16:30'}:w),toast:'草稿已保存'})),publish:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'published',version:w.version+1,publishedAt:'2026-07-11 16:35',updatedAt:'2026-07-11 16:35',versions:[...w.versions,{version:w.version+1,createdAt:'2026-07-11 16:35',note:'发布最新审批配置',nodes:clone(w.nodes),edges:clone(w.edges)}]}:w),toast:'流程发布成功'})),create:()=>{const id='wf-'+Date.now();set(s=>({workflows:[{id,name:'未命名流程',domain:'财务',status:'draft',version:0,editor:'林秋',updatedAt:'2026-07-11 16:40',abnormalCount:0,nodes:[],edges:[],versions:[]},...s.workflows],currentId:id}));return id},copy:id=>set(s=>{const w=s.workflows.find(x=>x.id===id)!;return{workflows:[{...clone(w),id:'wf-'+Date.now(),name:w.name+'（副本）',status:'draft'},...s.workflows]}}),archive:id=>set(s=>({workflows:s.workflows.map(w=>w.id===id?{...w,status:'archived'}:w)})),restore:v=>set(s=>({workflows:s.workflows.map(w=>{if(w.id!==s.currentId)return w;const old=w.versions.find(x=>x.version===v)!;return{...w,status:'draft',nodes:clone(old.nodes),edges:clone(old.edges)}}),toast:`已恢复 v${v} 为草稿`})),clearToast:()=>set({toast:''}),
 /* 发起重试：尝试绑定流程版本与输入快照；同例同节点已有进行中重试时，后到者待处理 */
 startRetry:(instanceId,win)=>set(s=>{
  const ins=s.instances.find(i=>i.id===instanceId);if(!ins)return{};
  if(ins.status!=='abnormal'&&ins.status!=='timeout')return{toast:'仅异常或超时实例可以发起重试'};
  const w=s.workflows.find(x=>x.id===ins.workflowId);if(!w)return{};
  const batches=clone(s.batches),ledger=clone(s.ledger),audit=clone(s.audit);
  const id=nextBatchId(batches);
  const form=w.nodes.find(n=>n.type==='form');
  const snapshot=Object.fromEntries(((form?.data.config.fields||[]) as {label:string;type:string}[]).map(f=>[f.label,f.type==='amount'?'12,800.00':f.type==='attachment'?'行程单.pdf':'华东区客户拜访差旅（补录）']));
  const blocked=batches.some(b=>b.instanceId===instanceId&&b.nodeLabel===ins.currentNode&&inFlight(b));
  const attempt=batches.filter(b=>b.instanceId===instanceId&&b.nodeLabel===ins.currentNode).length+1;
  const batch:RetryBatch={id,instanceId,workflowId:w.id,nodeLabel:ins.currentNode,version:w.version,snapshot,window:win,attempt,status:blocked?'pending':'running',createdAt:NOW,actions:buildActions(id,ins.currentNode),compensations:[]};
  batches.unshift(batch);
  pushAudit(audit,id,'创建重试批次',`${win} 提交，尝试绑定流程版本 v${w.version} 与输入快照（${Object.keys(snapshot).length} 项）`,'林秋');
  if(blocked)pushAudit(audit,id,'并发排队','同例同节点只能有一个进行中重试，后到者待处理');
  else runInitial(batch,ledger,audit);
  return{batches,ledger,audit,toast:blocked?`${win} 提交的重试已排队待处理`:`重试批次 ${id} 已创建并绑定版本快照`}}),
 /* 模拟失败：失败动作定格，成功动作按依赖倒序补偿，已补偿动作不能重放 */
 simulateFailure:batchId=>set(s=>{
  const batches=clone(s.batches),ledger=clone(s.ledger),audit=clone(s.audit),instances=clone(s.instances);
  const b=batches.find(x=>x.id===batchId);
  if(!b||b.status!=='running')return{};
  const target=b.actions.find(a=>a.state==='running')||b.actions.find(a=>a.state==='pending');
  if(!target)return{};
  target.state='failed';
  pushAudit(audit,b.id,'动作失败',`${target.label} 调用外部系统超时`);
  b.status='compensating';
  b.actions.filter(a=>a.state==='success').reverse().forEach(a=>{
   const reversal=a.externalTxId+'-R';
   b.compensations.push({id:`${b.id}-c${b.compensations.length+1}`,actionId:a.id,actionLabel:a.label,seq:b.compensations.length+1,reversalTxId:reversal,reconciled:false});
   ledger.push({id:reversal,batchId:b.id,actionId:a.id,direction:'reversal',system:a.kind,ref:a.externalTxId,status:'posted'});
   const tx=ledger.find(t=>t.id===a.externalTxId);if(tx)tx.status='reversed';
   a.state='compensated';a.replayable=false;
   pushAudit(audit,b.id,'倒序补偿',`#${b.compensations.length} 补偿 ${a.label} → 冲正流水 ${reversal}`)});
  b.status='compensated';
  pushAudit(audit,b.id,'批次已补偿','成功动作已按依赖倒序补偿，已补偿动作不能重放');
  const ins=instances.find(i=>i.id===b.instanceId);
  if(ins)ins.timeline.push({title:`重试批次 ${b.id} 失败，已倒序补偿`,time:'17:35',status:'completed'});
  activateNext(batches,ledger,audit,b);
  return{batches,ledger,audit,instances,toast:`批次 ${b.id} 已按依赖倒序补偿`}}),
 /* 断点续做：超时重试只继续未完成部分，跳过已成功与已补偿动作 */
 resumeBatch:batchId=>set(s=>{
  const batches=clone(s.batches),ledger=clone(s.ledger),audit=clone(s.audit),instances=clone(s.instances);
  const b=batches.find(x=>x.id===batchId);
  if(!b||b.status!=='compensated')return{};
  if(batches.some(x=>x.id!==b.id&&sameKey(x,b)&&inFlight(x))){
   b.status='pending';
   pushAudit(audit,b.id,'并发排队','断点续做请求排队：同例同节点已有进行中重试');
   return{batches,audit,toast:'同节点已有进行中重试，续做请求转为待处理'}}
  b.status='running';b.attempt+=1;
  let skipped=0,locked=0,redone=0;
  b.actions.forEach(a=>{
   if(a.state==='success'){skipped++;return}
   if(a.state==='compensated'){locked++;pushAudit(audit,b.id,'不可重放',`已补偿动作不能重放，跳过：${a.label}`);return}
   a.state='success';a.externalTxId='EXT-2026-'+txSeq++;
   ledger.push({id:a.externalTxId,batchId:b.id,actionId:a.id,direction:'write',system:a.kind,status:'posted'});
   redone++;pushAudit(audit,b.id,'断点续做',`续做动作 ${a.label} → 外部流水 ${a.externalTxId}`)});
  pushAudit(audit,b.id,'断点续做',`超时重试只继续未完成部分：跳过已成功 ${skipped} 项、已补偿 ${locked} 项，续做 ${redone} 项`);
  b.status='completed';
  pushAudit(audit,b.id,'批次完成','未完成动作已全部执行成功');
  const ins=instances.find(i=>i.id===b.instanceId);
  if(ins)ins.timeline.push({title:`重试批次 ${b.id} 断点续做完成`,time:'17:45',status:'completed'});
  activateNext(batches,ledger,audit,b);
  return{batches,ledger,audit,instances,toast:`批次 ${b.id} 断点续做完成`}}),
 /* 外部流水对账：补偿任务逐笔核对冲正流水 */
 reconcileBatch:batchId=>set(s=>{
  const batches=clone(s.batches),audit=clone(s.audit);
  const b=batches.find(x=>x.id===batchId);
  if(!b||!b.compensations.length)return{};
  b.compensations.forEach(c=>{c.reconciled=s.ledger.some(t=>t.id===c.reversalTxId&&t.direction==='reversal')});
  b.reconciledAt='2026-07-11 17:50';
  const miss=b.compensations.filter(c=>!c.reconciled).length;
  pushAudit(audit,b.id,'外部流水对账',miss?`对账发现差异 ${miss} 笔：补偿任务与外部流水不一致`:`${b.compensations.length} 笔补偿任务与外部流水全部对平`,'林秋');
  return{batches,audit,toast:miss?`对账差异 ${miss} 笔`:'补偿任务与外部流水全部对平'}}),
 /* 补登缺失的冲正流水，让补偿任务与外部流水对平 */
 repairLedger:batchId=>set(s=>{
  const batches=clone(s.batches),ledger=clone(s.ledger),audit=clone(s.audit);
  const b=batches.find(x=>x.id===batchId);if(!b)return{};
  let fixed=0;
  b.compensations.forEach(c=>{
   if(c.reconciled)return;
   const action=b.actions.find(a=>a.id===c.actionId);
   ledger.push({id:c.reversalTxId,batchId:b.id,actionId:c.actionId,direction:'reversal',system:action?.kind||'外部系统',ref:action?.externalTxId,status:'posted'});
   const tx=ledger.find(t=>t.id===action?.externalTxId);if(tx)tx.status='reversed';
   c.reconciled=true;fixed++;
   pushAudit(audit,b.id,'补登流水',`补登缺失冲正流水 ${c.reversalTxId}，补偿任务与外部流水对平`,'林秋')});
  if(!fixed)return{};
  return{batches,ledger,audit,toast:`已补登 ${fixed} 笔冲正流水`}})}));
