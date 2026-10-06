import {useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Activity,AlertTriangle,Clock,RotateCcw,Search,X} from 'lucide-react';
import {PageTitle,Status} from '../components/common';
import {FlowCanvas} from '../components/FlowCanvas';
import {useAppStore} from '../store/useAppStore';
import type {RetryBatch} from '../types';
const actionStateLabel:Record<string,string>={pending:'待执行',running:'执行中',success:'成功',failed:'失败',compensated:'已补偿'};
export function Monitor(){
 const ins=useAppStore(s=>s.instances),ws=useAppStore(s=>s.workflows),batches=useAppStore(s=>s.batches),startRetry=useAppStore(s=>s.startRetry),[params]=useSearchParams();
 const [filter,setFilter]=useState('all'),[selected,setSelected]=useState<string|null>(params.get('instance')),[win,setWin]=useState('窗口A');
 const rows=useMemo(()=>ins.filter(i=>filter==='all'||i.status===filter),[ins,filter]);
 const item=ins.find(i=>i.id===selected),flow=ws.find(w=>w.id===item?.workflowId);
 const itemBatches=batches.filter(b=>b.instanceId===selected);
 const latest=(id:string)=>batches.find(b=>b.instanceId===id);
 const retryable=item&&(item.status==='abnormal'||item.status==='timeout');
 return <div className="page"><PageTitle eyebrow="运行中心" title="Runtime Monitor" desc="观察流程实例状态、耗时和风险，快速定位异常节点。"/><section className="monitor-kpis">{[['运行中',ins.filter(i=>i.status==='running').length,Activity],['异常',ins.filter(i=>i.status==='abnormal').length,AlertTriangle],['超时',ins.filter(i=>i.status==='timeout').length,Clock],['今日完成',ins.filter(i=>i.status==='completed').length,Activity]].map(([a,b,I]:any)=><article key={a}><I/><span><small>{a}</small><b>{b}</b></span></article>)}</section><div className="toolbar panel"><div className="search"><Search/><input placeholder="搜索实例或申请人"/></div>{[['all','全部'],['abnormal','异常'],['timeout','超时'],['running','进行中'],['completed','已完成']].map(([v,l])=><button key={v} className={'filter '+(filter===v?'active':'')} onClick={()=>setFilter(v)}>{l}</button>)}</div><section className="panel monitor-table"><table><thead><tr><th>实例编号</th><th>申请人</th><th>业务域</th><th>当前节点</th><th>状态</th><th>提交时间</th><th>耗时</th><th>风险</th><th>重试批次</th></tr></thead><tbody>{rows.map(i=>{const b=latest(i.id);return <tr key={i.id} data-testid="instance-row" onClick={()=>setSelected(i.id)}><td><b>{i.id}</b></td><td>{i.applicant}</td><td>{i.domain}</td><td>{i.currentNode}</td><td><Status value={i.status}/></td><td>{i.submittedAt}</td><td>{i.duration}</td><td><Status value={i.risk}/></td><td>{b?<span className="batch-ref"><b>{b.id}</b><Status value={b.status}/></span>:'—'}</td></tr>})}</tbody></table></section>{item&&flow&&<div className="drawer-backdrop"><aside className="instance-drawer" data-testid="instance-detail"><div className="drawer-head"><div><small>流程实例详情</small><h2>{item.id}</h2></div><button className="icon-btn" data-testid="close-drawer" onClick={()=>setSelected(null)}><X/></button></div><div className="detail-meta"><div><small>申请人</small><b>{item.applicant}</b></div><div><small>状态</small><Status value={item.status}/></div><div><small>耗时</small><b>{item.duration}</b></div><div><small>风险</small><Status value={item.risk}/></div></div><h3>执行流程</h3><div className="runtime-canvas"><FlowCanvas nodes={flow.nodes} edges={flow.edges} onNodes={()=>{}} onEdges={()=>{}} onSelect={()=>{}} highlight={flow.nodes.find(n=>n.data.label===item.currentNode)?.id}/></div><h3>执行时间线</h3><div className="timeline" data-testid="execution-timeline">{item.timeline.map(t=><div key={t.title} className={t.status}><i/><span><b>{t.title}</b><small>{t.time}</small></span><Status value={t.status}/></div>)}</div><h3>重试批次</h3><div className="retry-panel"><div className="retry-bar"><div className="window-toggle"><button className={win==='窗口A'?'active':''} onClick={()=>setWin('窗口A')}>窗口 A</button><button data-testid="window-b" className={win==='窗口B'?'active':''} onClick={()=>setWin('窗口B')}>窗口 B</button></div><button data-testid="submit-retry" disabled={!retryable} onClick={()=>startRetry(item.id,win)}><RotateCcw/>提交重试</button></div><p className="retry-hint">重试尝试绑定当前流程版本与输入快照；同例同节点仅允许一个进行中重试，两个窗口同时提交时后到者待处理。</p>{itemBatches.map(b=><BatchCard key={b.id} batch={b}/>)}{!itemBatches.length&&<div className="no-batch">当前实例还没有重试批次</div>}</div></aside></div>}</div>;
}
function BatchCard({batch:b}:{batch:RetryBatch}){
 const simulateFailure=useAppStore(s=>s.simulateFailure),resumeBatch=useAppStore(s=>s.resumeBatch),reconcileBatch=useAppStore(s=>s.reconcileBatch),repairLedger=useAppStore(s=>s.repairLedger);
 const audit=useAppStore(s=>s.audit).filter(a=>a.batchId===b.id);
 const miss=b.compensations.filter(c=>!c.reconciled).length;
 return <div className="batch-card" data-testid="batch-card">
  <div className="batch-head"><b>{b.id}</b><Status value={b.status}/><small>{b.window} · 第 {b.attempt} 次尝试 · 绑定版本 v{b.version}</small></div>
  <div className="batch-snapshot" data-testid="batch-snapshot"><small>输入快照</small>{Object.entries(b.snapshot).map(([k,v])=><span key={k}>{k}<em>{v}</em></span>)}</div>
  <div className="batch-actions" data-testid="action-list"><small>自动化动作</small>{b.actions.map(a=><div key={a.id} className="action-row"><span className="a-label">{a.label}</span><small>{a.kind}{a.dependsOn.length?' · 依赖 '+a.dependsOn.map(d=>b.actions.find(x=>x.id===d)?.label).join('、'):''}</small><i className={'a-state '+a.state}>{actionStateLabel[a.state]}</i><code>{a.externalTxId||'—'}</code>{!a.replayable&&<em className="no-replay">不可重放</em>}</div>)}</div>
  {!!b.compensations.length&&<div className="batch-comps" data-testid="compensation-list"><small>补偿任务 · 按成功动作依赖倒序</small>{b.compensations.map(c=><div key={c.id} className="comp-row"><span>#{c.seq} 补偿 {c.actionLabel}</span><code>{c.reversalTxId}</code><i className={c.reconciled?'rec-ok':'rec-miss'}>{c.reconciled?'已对平':b.reconciledAt?'差异':'待对账'}</i></div>)}</div>}
  {b.reconciledAt&&<div className="reconcile-result" data-testid="reconcile-result">{miss?`对账差异 ${miss} 笔，请补登缺失流水`:'补偿任务与外部流水全部对平'} · 对账于 {b.reconciledAt}</div>}
  <div className="batch-ops">
   {b.status==='running'&&<button className="secondary mini" data-testid="simulate-failure" onClick={()=>simulateFailure(b.id)}>模拟失败</button>}
   {b.status==='compensated'&&<button className="secondary mini" data-testid="resume-batch" onClick={()=>resumeBatch(b.id)}>断点续做</button>}
   {!!b.compensations.length&&b.status!=='running'&&b.status!=='pending'&&<button className="secondary mini" data-testid="reconcile-batch" onClick={()=>reconcileBatch(b.id)}>外部流水对账</button>}
   {!!b.reconciledAt&&miss>0&&<button className="secondary mini" data-testid="repair-ledger" onClick={()=>repairLedger(b.id)}>补登流水</button>}
  </div>
  <div className="batch-audit" data-testid="batch-audit"><small>审计日志 · {b.id}</small>{audit.map(a=><div key={a.id} className="audit-row"><small>{a.time}</small><b>{a.event}</b><span>{a.detail}</span></div>)}</div>
 </div>;
}
