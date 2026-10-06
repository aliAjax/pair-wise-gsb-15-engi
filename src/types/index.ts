export type WorkflowStatus='draft'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[]}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[]}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[]}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';timeline:{title:string;time:string;status:string}[]}
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string}
/* 可恢复重试批次：节点执行 + 自动化动作 + 补偿任务 + 实例时间线 */
export type BatchStatus='pending'|'running'|'compensating'|'compensated'|'completed';
export type ActionState='pending'|'running'|'success'|'failed'|'compensated';
export interface AutomationAction {id:string;label:string;kind:string;dependsOn:string[];state:ActionState;externalTxId?:string;replayable:boolean}
export interface CompensationTask {id:string;actionId:string;actionLabel:string;seq:number;reversalTxId:string;reconciled:boolean}
export interface ExternalTransaction {id:string;batchId:string;actionId:string;direction:'write'|'reversal';system:string;ref?:string;status:'posted'|'reversed'}
export interface AuditEntry {id:string;batchId:string;time:string;actor:string;event:string;detail:string}
export interface RetryBatch {id:string;instanceId:string;workflowId:string;nodeLabel:string;version:number;snapshot:Record<string,string>;window:string;attempt:number;status:BatchStatus;createdAt:string;actions:AutomationAction[];compensations:CompensationTask[];reconciledAt?:string}
