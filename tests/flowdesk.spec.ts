import {test,expect} from '@playwright/test';
test.describe.serial('FlowDesk 完整链路',()=>{
 test('Dashboard KPI 与最近流程进入编辑器',async({page})=>{await page.goto('/');await expect(page.getByTestId('kpi-grid')).toBeVisible();await expect(page.getByText('流程总数')).toBeVisible();await expect(page.getByText('异常实例',{exact:true}).first()).toBeVisible();await page.getByTestId('recent-workflow').first().click();await expect(page.getByTestId('flow-canvas')).toBeVisible();});
 test('审批配置、保存和双区域校验',async({page})=>{await page.goto('/workflows/wf-1');await page.getByTestId('canvas-node-approval').click();await expect(page.getByTestId('config-panel')).toContainText('审批配置');await page.getByLabel('审批人来源').selectOption({label:'固定角色'});await page.getByTestId('save-node-config').click();await page.getByRole('button',{name:'保存草稿'}).click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('canvas-node-condition')).toHaveClass(/invalid/);await expect(page.getByTestId('issues-panel')).toContainText('条件分支规则未配置');const before=await page.getByTestId('error-count').textContent();expect(Number(before?.match(/\d+/)?.[0])).toBeGreaterThan(0);await page.getByTestId('canvas-node-condition').click();await page.getByLabel('条件字段').selectOption('amount');await page.getByLabel('条件比较值').fill('5000');await page.getByTestId('save-node-config').click();await page.getByTestId('validate-button').click();await expect(page.getByTestId('error-count')).toContainText('0 错误');});
 test('表单预览金额驱动条件分支',async({page})=>{await page.goto('/workflows/wf-1/preview');await expect(page.getByTestId('branch-result')).toContainText('标准分支');await page.getByLabel('申请金额').fill('12000');await expect(page.getByTestId('branch-result')).toContainText('高额分支');});
 test('发布后列表和总览同步',async({page})=>{await page.goto('/workflows/wf-2');await page.getByTestId('publish-button').click();await expect(page.getByRole('status')).toContainText('发布成功');await page.getByRole('link',{name:'流程管理'}).click();const row=page.getByTestId('workflow-row').filter({hasText:'采购合同审批'});await expect(row).toContainText('已发布');await expect(row).toContainText('v3');await page.getByRole('link',{name:'总览'}).click();await expect(page.getByTestId('kpi-grid')).toBeVisible();});
 test('异常实例详情、时间线与当前节点高亮',async({page})=>{await page.goto('/monitor');await page.getByRole('button',{name:'异常',exact:true}).click();await page.getByTestId('instance-row').first().click();await expect(page.getByTestId('instance-detail')).toBeVisible();await expect(page.getByTestId('execution-timeline')).toContainText('提交申请');await expect(page.locator('.runtime-highlight')).toHaveCount(1);});
 test('版本比较并恢复历史版本',async({page})=>{await page.goto('/workflows/wf-2/versions');await expect(page.getByTestId('version-compare')).toContainText('新增节点');await page.getByTestId('restore-version').click();await expect(page).toHaveURL(/\/workflows\/wf-2$/);await expect(page.getByRole('status')).toContainText('已恢复');await expect(page.getByTestId('flow-canvas')).toBeVisible();});
 test('重试批次：并发排队、倒序补偿、断点续做与外部流水对账',async({page})=>{
  await page.goto('/monitor');await page.getByRole('button',{name:'异常',exact:true}).click();
  await page.getByTestId('instance-row').filter({hasText:'INS-2026-0002'}).click();
  await expect(page.getByTestId('instance-detail')).toBeVisible();
  // 窗口 A 提交：尝试绑定流程版本与输入快照
  await page.getByTestId('submit-retry').click();
  const batchA=page.getByTestId('batch-card').filter({hasText:'RB-2026-0003'});
  await expect(batchA).toContainText('进行中');
  await expect(batchA).toContainText('绑定版本 v2');
  await expect(batchA.getByTestId('batch-snapshot')).toContainText('申请金额');
  // 窗口 B 同时提交：同例同节点只能有一个进行中重试，后到者待处理
  await page.getByTestId('window-b').click();
  await page.getByTestId('submit-retry').click();
  const batchB=page.getByTestId('batch-card').filter({hasText:'RB-2026-0004'});
  await expect(batchB).toContainText('待处理');
  // 失败后按成功动作依赖倒序补偿，已补偿动作不能重放
  await batchA.getByTestId('simulate-failure').click();
  await expect(batchA).toContainText('已补偿');
  await expect(batchA.getByTestId('compensation-list').locator('.comp-row').first()).toContainText('写入系统记录');
  await expect(batchA.getByTestId('action-list')).toContainText('不可重放');
  await expect(page.getByTestId('execution-timeline')).toContainText('重试批次 RB-2026-0003 失败，已倒序补偿');
  // 后到者自动接手，同样失败补偿
  await expect(batchB).toContainText('进行中');
  await batchB.getByTestId('simulate-failure').click();
  await expect(batchB).toContainText('已补偿');
  // 断点续做：超时重试只继续未完成部分
  await batchA.getByTestId('resume-batch').click();
  await expect(batchA).toContainText('已完成');
  await expect(batchA.getByTestId('batch-audit')).toContainText('已补偿动作不能重放');
  await expect(batchA.getByTestId('batch-audit')).toContainText('续做 2 项');
  // 断点续做后补偿任务与外部流水对账
  await batchA.getByTestId('reconcile-batch').click();
  await expect(batchA.getByTestId('reconcile-result')).toContainText('全部对平');
  // 监控列表显示同一批次
  await page.getByTestId('close-drawer').click();
  await expect(page.getByTestId('instance-row').filter({hasText:'INS-2026-0002'})).toContainText('RB-2026-0004');
  // 版本页显示同一批次
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('link',{name:'流程管理'}).click();
  await page.getByTestId('workflow-row').filter({hasText:'采购合同审批'}).getByText('采购合同审批').click();
  await page.getByRole('button',{name:'版本历史'}).click();
  await expect(page.getByTestId('version-batch-tag').filter({hasText:'RB-2026-0003'})).toBeVisible();
 });
 test('遗留批次对账差异与补登流水',async({page})=>{
  await page.goto('/monitor');await page.getByRole('button',{name:'异常',exact:true}).click();
  await expect(page.getByTestId('instance-row').filter({hasText:'INS-2026-0003'})).toContainText('RB-2026-0001');
  await page.getByTestId('instance-row').filter({hasText:'INS-2026-0003'}).click();
  const legacy=page.getByTestId('batch-card').filter({hasText:'RB-2026-0001'});
  await expect(legacy).toContainText('已补偿');
  await expect(legacy).toContainText('绑定版本 v2');
  await expect(legacy.getByTestId('compensation-list').locator('.comp-row').first()).toContainText('写入系统记录');
  await legacy.getByTestId('reconcile-batch').click();
  await expect(legacy.getByTestId('reconcile-result')).toContainText('对账差异 1 笔');
  await legacy.getByTestId('repair-ledger').click();
  await expect(legacy.getByTestId('reconcile-result')).toContainText('全部对平');
  await expect(legacy.getByTestId('batch-audit')).toContainText('审计日志 · RB-2026-0001');
  await expect(legacy.getByTestId('batch-audit')).toContainText('补登缺失冲正流水 EXT-2026-5512-R');
 });
});

test('1440px 桌面视觉与控制台验证',async({page})=>{
 const errors:string[]=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const path of ['/','/workflows/wf-1','/monitor']){await page.goto(path);await page.waitForTimeout(250);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow,`${path} 不应横向溢出`).toBeFalsy()}
 await page.goto('/'); await page.screenshot({path:'test-results/dashboard-1440.png',fullPage:true});
 expect(errors,'浏览器 console 不应出现 error').toEqual([]);
});
