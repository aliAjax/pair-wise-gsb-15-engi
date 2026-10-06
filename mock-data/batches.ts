import type {AuditEntry,ExternalTransaction,RetryBatch} from '../src/types';
/* 种子批次：一笔遗留已补偿批次（外部流水缺一笔冲正，等待对账发现），一笔超时断点续做后完成的历史批次 */
export const batches:RetryBatch[]=[
 {id:'RB-2026-0001',instanceId:'INS-2026-0003',workflowId:'wf-3',nodeLabel:'金额判断',version:2,
  snapshot:{'申请说明':'华东区客户拜访差旅（补录）','申请金额':'12,800.00','附件':'行程单.pdf'},
  window:'窗口A',attempt:1,status:'compensated',createdAt:'2026-07-10 15:20',
  actions:[
   {id:'RB-2026-0001-a1',label:'重算分支规则',kind:'规则引擎',dependsOn:[],state:'compensated',externalTxId:'EXT-2026-5511',replayable:false},
   {id:'RB-2026-0001-a2',label:'写入系统记录',kind:'系统记录',dependsOn:['RB-2026-0001-a1'],state:'compensated',externalTxId:'EXT-2026-5512',replayable:false},
   {id:'RB-2026-0001-a3',label:'发送 Webhook（模拟）',kind:'Webhook',dependsOn:['RB-2026-0001-a2'],state:'failed',replayable:true},
   {id:'RB-2026-0001-a4',label:'创建工单',kind:'工单',dependsOn:['RB-2026-0001-a2'],state:'pending',replayable:true}],
  compensations:[
   {id:'RB-2026-0001-c1',actionId:'RB-2026-0001-a2',actionLabel:'写入系统记录',seq:1,reversalTxId:'EXT-2026-5512-R',reconciled:false},
   {id:'RB-2026-0001-c2',actionId:'RB-2026-0001-a1',actionLabel:'重算分支规则',seq:2,reversalTxId:'EXT-2026-5511-R',reconciled:false}]},
 {id:'RB-2026-0002',instanceId:'INS-2026-0013',workflowId:'wf-1',nodeLabel:'直属主管审批',version:1,
  snapshot:{'申请说明':'部门团建费用申请（补录）','申请金额':'3,600.00','附件':'预算表.xlsx'},
  window:'窗口A',attempt:2,status:'completed',createdAt:'2026-07-09 11:02',
  actions:[
   {id:'RB-2026-0002-a1',label:'重建审批任务',kind:'审批中心',dependsOn:[],state:'success',externalTxId:'EXT-2026-5530',replayable:true},
   {id:'RB-2026-0002-a2',label:'同步待办中心',kind:'待办中心',dependsOn:['RB-2026-0002-a1'],state:'success',externalTxId:'EXT-2026-5531',replayable:true},
   {id:'RB-2026-0002-a3',label:'发送提醒通知',kind:'通知服务',dependsOn:['RB-2026-0002-a2'],state:'success',externalTxId:'EXT-2026-5532',replayable:true}],
  compensations:[]}];
/* 外部流水账：RB-2026-0001 的 EXT-2026-5512-R 冲正缺失，正是“自动化写出的外部流水没人核对”留下的差异 */
export const ledger:ExternalTransaction[]=[
 {id:'EXT-2026-5511',batchId:'RB-2026-0001',actionId:'RB-2026-0001-a1',direction:'write',system:'规则引擎',status:'reversed'},
 {id:'EXT-2026-5511-R',batchId:'RB-2026-0001',actionId:'RB-2026-0001-a1',direction:'reversal',system:'规则引擎',ref:'EXT-2026-5511',status:'posted'},
 {id:'EXT-2026-5512',batchId:'RB-2026-0001',actionId:'RB-2026-0001-a2',direction:'write',system:'系统记录',status:'posted'},
 {id:'EXT-2026-5530',batchId:'RB-2026-0002',actionId:'RB-2026-0002-a1',direction:'write',system:'审批中心',status:'posted'},
 {id:'EXT-2026-5531',batchId:'RB-2026-0002',actionId:'RB-2026-0002-a2',direction:'write',system:'待办中心',status:'posted'},
 {id:'EXT-2026-5532',batchId:'RB-2026-0002',actionId:'RB-2026-0002-a3',direction:'write',system:'通知服务',status:'posted'}];
export const audit:AuditEntry[]=[
 {id:'AU-0001',batchId:'RB-2026-0001',time:'2026-07-10 15:20',actor:'林秋',event:'创建重试批次',detail:'窗口A 提交，尝试绑定流程版本 v2 与输入快照（3 项）'},
 {id:'AU-0002',batchId:'RB-2026-0001',time:'2026-07-10 15:21',actor:'系统',event:'动作成功',detail:'重算分支规则 → 外部流水 EXT-2026-5511'},
 {id:'AU-0003',batchId:'RB-2026-0001',time:'2026-07-10 15:21',actor:'系统',event:'动作成功',detail:'写入系统记录 → 外部流水 EXT-2026-5512'},
 {id:'AU-0004',batchId:'RB-2026-0001',time:'2026-07-10 15:22',actor:'系统',event:'动作失败',detail:'发送 Webhook（模拟）调用外部系统超时'},
 {id:'AU-0005',batchId:'RB-2026-0001',time:'2026-07-10 15:22',actor:'系统',event:'倒序补偿',detail:'#1 补偿 写入系统记录 → 冲正流水 EXT-2026-5512-R'},
 {id:'AU-0006',batchId:'RB-2026-0001',time:'2026-07-10 15:22',actor:'系统',event:'倒序补偿',detail:'#2 补偿 重算分支规则 → 冲正流水 EXT-2026-5511-R'},
 {id:'AU-0007',batchId:'RB-2026-0001',time:'2026-07-10 15:22',actor:'系统',event:'批次已补偿',detail:'成功动作已按依赖倒序补偿，已补偿动作不能重放'},
 {id:'AU-0008',batchId:'RB-2026-0002',time:'2026-07-09 11:02',actor:'陈默',event:'创建重试批次',detail:'窗口A 提交，尝试绑定流程版本 v1 与输入快照（3 项）'},
 {id:'AU-0009',batchId:'RB-2026-0002',time:'2026-07-09 11:05',actor:'系统',event:'动作失败',detail:'发送提醒通知超时，批次挂起等待续做'},
 {id:'AU-0010',batchId:'RB-2026-0002',time:'2026-07-09 14:40',actor:'陈默',event:'断点续做',detail:'超时重试只继续未完成部分：跳过已成功 2 项，续做 1 项'},
 {id:'AU-0011',batchId:'RB-2026-0002',time:'2026-07-09 14:41',actor:'系统',event:'批次完成',detail:'未完成动作已全部执行成功'}];
