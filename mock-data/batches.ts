import type {LedgerEntry,RetryBatch} from '../src/types';
export const batches:RetryBatch[]=[
 {id:'BATCH-20260710-001',instanceId:'INS-2026-0001',workflowId:'wf-1',nodeId:'automation',nodeLabel:'记录系统',workflowVersion:1,inputSnapshot:{'申请说明':'示例申请说明','申请金额':'8600','附件':'1 个附件'},attempt:1,status:'failed',createdAt:'2026-07-10 14:20',
  executions:[{nodeId:'automation',nodeLabel:'记录系统',status:'failed',actions:[
   {id:'a1-1',name:'记录系统·数据校验',externalTxId:'EXT-9001',status:'success',dependsOn:[]},
   {id:'a1-2',name:'记录系统·外部流水写入',externalTxId:'EXT-9002',status:'success',dependsOn:['a1-1']},
   {id:'a1-3',name:'记录系统·回执同步',externalTxId:'EXT-9003',status:'failed',dependsOn:['a1-2']}]}],
  compensations:[
   {id:'c-001-1',actionId:'a1-2',actionName:'记录系统·外部流水写入',externalTxId:'EXT-9002',order:1,status:'pending'},
   {id:'c-001-2',actionId:'a1-1',actionName:'记录系统·数据校验',externalTxId:'EXT-9001',order:2,status:'pending'}]},
 {id:'BATCH-20260709-002',instanceId:'INS-2026-0013',workflowId:'wf-1',nodeId:'automation',nodeLabel:'记录系统',workflowVersion:1,inputSnapshot:{'申请说明':'示例申请说明','申请金额':'3200','附件':'1 个附件'},attempt:1,status:'interrupted',createdAt:'2026-07-09 09:40',
  executions:[{nodeId:'automation',nodeLabel:'记录系统',status:'pending',actions:[
   {id:'a2-1',name:'记录系统·数据校验',externalTxId:'EXT-9101',status:'success',dependsOn:[]},
   {id:'a2-2',name:'记录系统·外部流水写入',externalTxId:'EXT-9102',status:'pending',dependsOn:['a2-1']},
   {id:'a2-3',name:'记录系统·回执同步',externalTxId:'EXT-9103',status:'pending',dependsOn:['a2-2']}]}],
  compensations:[]}];
export const ledger:LedgerEntry[]=[
 {txId:'EXT-9001',actionName:'记录系统·数据校验',amount:8600,batchId:'BATCH-20260710-001',status:'posted'},
 {txId:'EXT-9002',actionName:'记录系统·外部流水写入',amount:8600,batchId:'BATCH-20260710-001',status:'posted'},
 {txId:'EXT-9101',actionName:'记录系统·数据校验',amount:3200,batchId:'BATCH-20260709-002',status:'posted'},
 {txId:'EXT-7777',actionName:'历史遗留流水（无人核对）',amount:1200,batchId:'BATCH-LEGACY',status:'posted'}];
