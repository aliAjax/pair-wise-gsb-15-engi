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
export type ActionStatus='pending'|'success'|'failed'|'compensated'|'skipped';
export interface AutomationAction {id:string;name:string;externalTxId:string;status:ActionStatus;dependsOn:string[]}
export interface NodeExecution {nodeId:string;nodeLabel:string;status:'pending'|'success'|'failed';actions:AutomationAction[]}
export interface CompensationTask {id:string;actionId:string;actionName:string;externalTxId:string;order:number;status:'pending'|'done'|'reconciled'|'mismatch'}
export type BatchStatus='running'|'pending'|'failed'|'completed'|'compensated'|'reconciled'|'interrupted';
export interface Reconciliation {checkedAt:string;matched:number;mismatched:number;orphans:string[]}
export interface RetryBatch {id:string;instanceId:string;workflowId:string;nodeId:string;nodeLabel:string;workflowVersion:number;inputSnapshot:Record<string,string>;attempt:number;status:BatchStatus;createdAt:string;executions:NodeExecution[];compensations:CompensationTask[];reconciliation?:Reconciliation}
export interface LedgerEntry {txId:string;actionName:string;amount:number;batchId:string;status:'posted'|'reversed'}
