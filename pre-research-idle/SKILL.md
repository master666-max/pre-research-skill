---
name: pre-research-idle
description: 预调研·螺旋四站法闲时版（pre-research-wf 的一比一纯 skill 移植）：无动态工作流依赖，主会话+Agent 子代理+py 确定性内核跑同一螺旋——站1 区划并行广度调研→小实验→深读→小实验→红队轮（失速判定）→站5 py 确定性收窄→锁定件/收卷。checkpoint 幂等续跑，候裁点落盘自动续，专为闲时任务（OffPeak）无人值守设计。当用户要求「闲时跑预调研」「idle 预调研」「prw-idle 发车」，或要求把预调研挂闲时任务/夜间跑批时使用；交互式精细候裁预调研请用 pre-research-wf（工作流版）；单点选型不开螺旋。
version: 0.3.0
agent_created: true
---

# pre-research-idle · 螺旋四站法闲时版（纯 skill 导线协议）

**定位**：`pre-research-wf`（工作流版 v0.4.0）的一比一移植，运行面从动态工作流换成「主会话导线 + Agent 子代理 + py 确定性内核」，专供闲时任务（无人值守、可中断、可续跑）。法学唯一事实源不变 = `~/.zcode/skills/pre-research/`（v1.6.0+），子代理按路径自取，本技能不复述判据正文。确定性内核 = 本目录 `references/prw_core.py`（v1.7.0：回执五态判读/未竟九源/audit 自带 selfCheck 门/version 版本哨/sandboxcheck 静态门；76 项谓词测试全绿：`py -X utf8 references/test_prw_core.py`）。

## 〇 · 一比一映射表（工作流面 → 闲时面）

| 工作流版（pre-research-wf） | 闲时版（本技能） |
|---|---|
| `agent(...).ask<T>()` typed 子代理 | Agent 工具 spawn（persona=ask 文本照抄）；typed 返回值改为**子代理直接落盘 JSON**（`batch-C<k>-<区>.json` 等），主会话只传路径不传内容（上下文预算） |
| 站5 确定性收窄（TS 纯函数在 run 内执行） | `py -X utf8 references/prw_core.py narrow …` 一条命令出 LockSpec JSON（函数逐一对应：count_conv/build_pool/next_ratchets/judge_stall/audit_quota/merge_rebake/narrow） |
| `world.run` 回执文件门 | Bash `py -c "io.open(...).read()"` 同款 exit code 门 |
| 失配标注（法学 v1.5.0） | 调研员/深读员 ask 含失配义务；mismatch 字段随 batch JSON 落盘，prw_core count_conv 携带入收敛表失配位 |
| `report()/artifact` 看板 | 无仪表盘——产物文件即账本；进度写 `workdir/进度-C<k>.md`（checkpoint 载体） |
| escalation 候裁门（run 内暂停等委托方） | **候裁件落盘 + 按法学自动续**（见 §三）；委托方事后审 `候裁-C<k>.md` |
| 失速判定/红队轮 | 主会话 `prw_core.py stall …` 出 true/false，true 才 spawn 红队检索员+红队实验员（仅一轮） |
| 预注册/回执/kill criteria/反噬检查款 | 照抄法学 v1.4.0（含预锁复锁纪律与两级门——执行会话步 0 当日复算） |
| run 代际谱系纪律（P-043/P-035/P-036） | **域外不适用**（无 AmendWorkflow/TaskStop/GUI 接管）；等效物 = §二 幂等续跑纪律 |
| args 继承（saved 通道） | 无 args 机制——闲时任务 prompt 即参数袋（§一契约） |

## 一 · 闲时发车契约（任务 prompt 必带，发起即批准）

闲时任务的 prompt 必须自包含以下参数（缺一即在 step0 落停机件退出）：

```
theme=<主题一句话>；workdir=<产物目录>；axisPath=<轴件 json>；panelPath=<配额表 json>；
round=<起始轮 k>；maxRound=<轮次硬顶（默认 3）>；prevPoolPath=<上轮池 jsonl，首轮留空>；
prevStall=<0|1>；forceWrapUp=<0|1>
```

**发起即批准原则**：委托方创建闲时任务并在 prompt 写明上述参数 = 立项件与首轮面板获批（含硬数字门：区划 ≥20/每区 ≤4/合计 ≥60/entryQuota ≥3——mock 仅限 accept.md 登记试车单场景）。候裁点不再等人（§三）。

## 二 · 幂等续跑纪律（闲时命门，P-043/P-035 的域外等效物）

1. **产物在盘即跳过**：每站开工前先核对产物文件（entries/deep/prereg/receipt/lock/pool/next-panel），在盘且非空即视为该步已完成，直接进下一步——闲时任务被杀/超时后重发自动续跑，零重付。
2. **进度文件**：`workdir/进度-C<k>.md` 只追加（一行一站：站名/产物清单/时间戳），是断点续跑的唯一依据；每完成一步立即写。
3. **站1 各区独立**：`batch-C<k>-<区>.json` 单区重跑不影响他区；并行 spawn 用 Agent 工具同消息多调用。
4. **只落盘不悬挂**：任何中间态必须落成文件（JSON/md），禁依赖会话内存跨步传递——闲时会话随时可能被回收。
5. **零生产写**照抄法学：实验只对沙盒快照/纯读回放；生产写（如 P7 类工单件）在闲时禁做。

## 三 · 导线协议（主会话八步）

0. **step0 校验**：读 prompt 参数袋 → `validate_panel`（可用 `prw_core.py audit` 间接触发）→ 判据文件在盘（methodology.md）→ **`prw_core.py version --snapshot workdir/版本-C<k>.json` 判据源版本快照**（跨文件升级（法学/内核/测试）漂移检测；站5 前 `--check` 比对，漂移即登记并按「新站用新法、旧站不回判」处置）→ 缺任一 → 落 `workdir/停机-C<k>.md`（原因+现场快照）后退出，禁硬编凑数。
1. **checkpoint 检查（续跑首动作=注意力重锚）**：先重读 `workdir/进度-C<k>.md` 与本 SKILL §二纪律，再按进度文件跳过已完成站——禁凭半记忆续跑。
2. **站1 广度调研**：Agent 并行 spawn 区划调研员（ask 文本照抄 prw-round.dwf.ts 站1 段，把「返回结构化批次」改为「落盘 batch-C<k>-<区>.json + entries 批件 md」）；回收后 `prw_core.py audit` 机械验收（**v1.7.0 自带 selfCheck 门：不过 exit 2**；遗留批件回放加 `--lenient-selfcheck` 只登记不判死）+ `prw_core.py selfcheck` 自检对账（自报计数 vs 实数，不符处 spawn 补标/登记；带 `--prev-pool` 出重复提名提示，仅登记不判死）→ 缺口学科回炉一次（Agent spawn，`merge_rebake` 语义已内建于主会话合并逻辑——主会话按 JSON 合并或调 `merge_rebake`）→ 再验收 → limited 行 `RESEARCH-FACE-LIMITED` 登记（禁凑数）。锚点抽验 ≤3 条：Agent spawn 锚点复核员，notFound 即降级 unverified。
3. **站2/站4 实验**：`prw_core.py conv` 出收敛表 → 结构必需行按 expQuota 切半分站 → 每行 spawn 预注册员（六字段，落盘 prereg md）→ 实验员（沙盒执行，落盘 receipt md+回执 JSON）→ Bash py 门验证回执在盘 + **`prw_core.py sandboxcheck --dir sandbox/<id>/` 沙盒静态门（禁网模块/写越界/未声明读越界；动态路径仅提示，白名单走 sandboxcheck-allow.json 或 --whitelist；违规如实登记）** → state 五态照抄法学（咬合/不咬合/登记盲区/反噬/表冲突——含反噬检查款判定序 kill→反噬→咬合→空转；反噬=定态负向结果，清障失速）；回执必含**判定序四行**（法学 v1.5.1，缺一按不完整处置）。
**矿脉深读保证位（法学 v1.6.0）**：panel 学科带 `tier:"矿脉"` 标注者，站3 追加矿脉深读员按**五维清单**挖档案（机制全集/失败化石/参数空间/演进史/对比边界），落盘 `mine-C<k>-<学科>.md`；提名行带 `excavate:true` 深掘标记入矿脉识别门。
4. **站3 深读**：结构必需行（≤3）spawn 深读员，落盘 deep md。
5. **红队轮**：`prw_core.py stall --receipts … --conv …` → true 则 spawn 红队检索员+红队实验员（证伪向，仅一轮），完毕重算 conv 再判一次。
6. **站5 收窄**：先 `prw_core.py version --check workdir/版本-C<k>.json`（判据源漂移即登记处置）→ `prw_core.py narrow --axes … --batches "batch-C<k>-*.json" --receipts … --panel … --round k --prev-pool … --prev-stall … --max-round … --force-wrapup … [--mined "已掘矿脉学科|…"]`（**v1.7.0 未竟九源**：原五源 + 反噬登记/表冲突移交/矿脉未掘（--mined 给已掘清单）/野卡未填，四条不可静默项自动入账）→ LockSpec JSON → spawn 锁定件合成员（**权威数字禁改，只转写**）落盘三件：lock-C<k>.md / pool-C<k>.jsonl / next-panel-C<k>.json → spawn 审计员逐项机械核对（不一致回炉一次，全清单重核）。
7. **候裁点自动续**：C1→C2 默认续跑不问人；C2→C3 起每轮候裁——闲时无人值守，处理 = ①把候裁材料（上轮锁定件数字+续轮面板草案+棘轮）落盘 `workdir/候裁-C<k>.md` ②按法学默认续跑下一轮 ③收卷件中登记「候裁点均以自动续执行，候裁件在案候审」。**轮次上限照旧硬顶**（maxRound 触顶即收卷）；委托方叫停语义 = 删除/停止闲时任务本身。
8. **收卷分支**：wrapUp=true（饱和/触顶/force）→ spawn 收卷合成人写 review-C<k>.md（综述回顾/未竟照 LockSpec.unfinished 逐字转写禁改数/落地判据件草案），落盘后本技能终止。

## 四 · 已知差异与如实登记（一比一的边界）

- **同名学科双正式席**：提名凑 3 路转正后若同时是 A 供给源，面板可出现两个同名正式席（TS v4 同源行为；M2 absorbed 去重只管池行）。下游展开面板时按 C3 转换先例并席即可，本内核不为它偏离 TS 语义。
- **experimentQuota 超配**：法学 v1.4.0「超配候裁」适用——闲时模式超配须在进度文件与收卷件如实登记。
- **escalation 三次上限**：工作流面自带的 escalation 通道不存在；诚实条款等效物 = 停机件（宁停不编）。
- **深读/审计的上下文连续性**：工作流版同 actor 复用 ask；Agent 工具每次 spawn 新上下文——跨站一致性由落盘文件承载（审计员从头核全清单，天然对齐「全清单重核」裁决）。
- **sandboxcheck 静态面边界（v1.7.0）**：AST 面只能判字面量路径与显式模块导入——动态拼接路径（os.path.join 变量）只出提示不判死；实验员 ask 应要求「外部输入须预注册冻结为沙盒件或入白名单声明」，把动态面压到最小。

## 五 · 纪律（全照抄，违者停机）

- 判据单一源（pre-research v1.6.0+，按路径自取）；数字冲突以 `prw_core.py` 输出的 LockSpec 为准。
- 预注册先于实验；预锁复锁纪律（执行日步 0 当日复算，两级门）；假引用零容忍；措辞临床化。
- 一切候裁点自动续须留候裁件在案；一切停机须留停机件；禁静默跳站、禁硬编凑数。
