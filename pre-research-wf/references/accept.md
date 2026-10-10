# pre-research-wf · M1 验收单（accept）

> 试车纪律：每条验收判据可证伪；通过/失败如实登记，失败不遮。

## 真实运行阶段（2026-10-03~05 · 路线甲 C3/C4 两轮真调研）

工作流在真实研究负载下的验收实录（mock 试车之上的活体压力测试）。权威研究产物=prw-试车/spiral/review-C3.md / review-C4.md（CBB 线辖区）；本表只记工作流面。

| 判据 | 方法 | 结果 |
|---|---|---|
| 长链真实负载稳定性 | C3（round=3/3）+C4（round=4/4 特批续轮）全链：站1×2（22 学科批件）/实验 5 枚/深读 6 篇/站5 收窄×2/收卷×2 | ✅ 引擎零脚本级故障；批量条目 51+51、提名 13+18 全 absorbed 机械对账 |
| 跨轮 carry（真数据） | C2→C3→C4 两跳：next-panel→panel 转换、池分片 carry（5→13→18 行） | ✅ 零裁量；absorbed 去重经真数据复验（C2 修复后未复发） |
| 未竟空集对账 | C4 unfinished=[] 五源旁证（候选轴/池存量/短收/退出/盲区） | ✅ 引擎五源枚举与收卷合成人逐源对账一致 |
| 预注册诚实机制（真触发） | C2 exp-C2-AX5 登记盲区（预锁则/表冲突）→C3 exp-C3-AX5 干净收口（ρ̂ 判死） | ✅ 法学条款工程上无法跳过，两连验证 |
| 涌现提名通道（真数据） | 四轮提名全部机械吸收：ORCID/ISAAR（C3）、MELD/TSA/Crossmark/LLM 代审/Fluid Notarization/SWH（C4） | ✅ 提名路计票与 absorbed/observing 账实一致 |
| **已知缺陷 1** | **expQuota 超配洞**：C3 棘轮 expQuota=2 实耗 4 枚——站4 选件逻辑在「新升结构必需轴」出现时无硬帽 | ✅ **已裁 A2**（2026-10-05 委托方）：不加硬帽；法学 v1.4.0「超配候裁」条已落地（超配合法+收卷件如实登记+判据不回改） |
| **已知缺陷 2** | **棘轮末档 exhaust**：档位序 i=min(round,3)，round≥3 后开席=收口持平（C4 实录），续轮棘轮失效 | ✅ **已裁 B2**（2026-10-05 委托方）：法学 v1.4.0「棘轮末档声明」已落地（末档后持平合法，续轮不造新维）；引擎仅加注释零行为变化 |
| **已知缺陷 3** | 运行谱系三病（僵尸徽标/TaskStop 不生效/GUI 死代接管）+args 通道（P-035 v2/P-036 v2/P-043） | ✅ 已立坑单+SKILL §三·五 鉴别法；治本（saved args 全通道继承）待上游 |
| ⑥红队触发/⑦LIMITED | 四轮真跑 stallSuspected 全 false、超交付倾向——自然路径未触发 | ✅ **C 案落地（2026-10-05）**：引擎重构 v4 抽 judgeStall/auditQuota/mergeRebake 纯函数，EvalWorkflowSnippet 谓词级测试 **13/13 全绿**（⑥失速判定 4 例含空转边界/⑦缺口识别-LIMITED 标记-回炉三分支 9 例）；红队/回炉的**活体触发观察**仍留全 run 构造（低优先——谓词已证） |
| 三票异构考官 | PLAN「如做」项 | ⏸ 挂起待委托方裁 |
| **失配标注（法学 v1.5.0）** | 委托方判据（Gentner 结构映射：同构只发借用许可，失配才决定怎么借/哪里会坏）→ 全修：法学 §四失配法条+methodology §1 模板失配列/§5 收敛表失配位+TS 引擎 v5（Mechanism.mismatch 必填/ConvPath 失配位/narrow 候选行共性失配句/站1 站3 ask 失配义务，SaveWorkflow 编译门过）+py 内核同步+TDD **40 checks ALL GREEN**（新增 v1.5.0 五例：失配随路携带/共性失配句入 suggestion/未寻得不进句/item-gap 数字禁改） | ✅ 三内核同步完成（wf v0.5.0/idle v0.2.0） |
| **注意力补丁（法学 v1.5.1）** | 注意力工程扫场 6 发现→全修：**A1** 站1/深读/预注册/实验员 ask 三段式重构（顶部编号义务清单+中部上下文+尾部收尾自检，治 12 项义务中段遗忘；读取精确到节勿整读）；**A2** MechanismBatch.selfCheck 自报计数+引擎对账门（谎报登记实数为准，py selfcheck 子命令+TDD 5 例）；**B** 失配两段式（表内短标+脚注详注）；**C** 回执判定序四行（kill/反噬/咬合/空转缺一不完整）；**D** 读取散射并入 A1；**E** idle 续跑首动作注意力重锚 | ✅ 全落（prw-round v5.1 编译门过；py **45 checks ALL GREEN**；法学 v1.5.1/wf v0.5.1/idle v0.2.1） |
| **矿脉学科（法学 v1.6.0，委托方裁 β）** | 「极端对口学科的深度发掘缺失」→矿脉机制：识别门三触发器（跨 ≥2 轴命中/全条目未寻得失配≥2 条/提名深掘标记 excavate）→站3 加强形态按**五维清单**挖档案（机制全集/失败化石/参数空间/演进史/对比边界）→矿脉席（不计收敛路/不占 A·B/不占探索税/与 A 并存票权不叠加）。TS v6（mineCandidates/PanelEntry tier 矿脉/QuotaDiscipline.tier 站3 深读保证位/提名 excavate/编译门过）+py 同步（mine_candidates/narrow 矿脉席）+TDD **55 checks ALL GREEN**（新增 10 例：三触发器/零增路全等断言/不挤野卡不变式/LIMITED 剔除；3 处测试断言建模错如实修正——含 v1.6.0 行为变更导致的旧断言更新） | ✅ 全落（法学 v1.6.0/wf v0.6.0/idle v0.3.0） |

## M1（本轮）

| # | 判据 | 方法 | 结果 |
|---|---|---|---|
| ① | 提名 schema 吸收：子代理返回的 `MechanismBatch.nominates` 为结构化数据 | 最小螺旋试车实测（EvalWorkflowSnippet 面无 agent()，schema 吸收只能活体验证） | ✅ 提名 1 条结构化入池（Splink/田野已实装），台账 jsonl 1 行 |
| ② | 最小螺旋走通：1 区 1 学科 mock，站1→站5 全走通，产出 LockSpec 与 `lock-C1.md`，数字两方一致 | CreateWorkflow saved 试车 + 审计员回执 | ✅ 5 相位 11 步全过（17m55s/669,699 token）；审计员 consistent 无 issues+导线抽验逐数核对一致（面板 0/0/1、棘轮 {≥2005,全文精读,3}、未竟差额 3−2=1） |
| ⑧a | 配额覆盖门：panel.json 区划无学科/entryQuota 非法 → 脚本立即抛错 | EvalWorkflowSnippet 负路径 | ✅ THREW-OK：配额表校验失败：区划「坏区」无学科 |
| ⑧b | 纯逻辑管线：配额验收→收敛计票→LockSpec 计算，在 fixture 上产出预期结构 | EvalWorkflowSnippet 正路径 | ✅ 面板校验过；计票=1 路文献+1 路提名=2 路候选（同源去重生效）；提名池 score=210（带锚 200+1 路 10）；棘轮进档 {≥2005,全文精读,3} |
| ⑤ | 模型继承冒烟：run 子代理 model 字段=会话档 | GetWorkflowRun 抽查 | ✅（继承制定义保证：脚本未传 subagent_model+全程零 provider 异常；字段级抽查工具面未暴露，M2 以计费侧佐证） |

## M2（2026-10-02）

| # | 判据 | 方法 | 结果 |
|---|---|---|---|
| ③ | 双轮 mock：C2 面板=脚本按 C1 LockSpec 收窄的结果，人工复核零裁量 | C2 试车 run `dwfrun-0852a3f0`（panelPath=m2/panel-C2.json；prevPoolPath=pool-C1.jsonl；prevStall=true；maxRound=2） | ✅ carry 链路实测：读入上轮 1 行（Splink）续排；AX1 本轮真凑满 5 路→结构必需（CQA 文献/权威控制田野+文献/L2D 提名/QE 提名）；**cSize 修复活体验证**（pool 非空→cSize=2→观察席 1，M1 边缘消除）；**实验链首跑**（预注册件+回执+world.run 门，exp-C2-AX1=不咬合，kill 未触发，零生产写 6282 件 SHA 复核）；棘轮进档 {≥2018,方法论级,2}；wrapUp=true（round≥maxRound）→收卷件 review-C2.md（23,845B） |
| ④ | AmendWorkflow 改一处 → 缓存命中零重付对账 | 两手实测：①对着报错中间代修订（`7c35f8b5`）→**缓存链断裂**全 live 重跑 16.3M（实付≈9.4M）——教训=修订要对着最后成功的 run，缓存链不穿失败代；②纯注释修订对成功满日志 run（`66eff34e`→`bc6567be`）→**0 秒 18 步全重放，cached_steps=13，实付≈0**（显示 16.3M 为导入记账口径） | ✅（含 P-035/缓存链两条新坑） |
| 意外A | 抽验发现真缺陷：同名学科重复占席（L2D 同时持正式+观察席） | lock-C2.md §3 | ✅ 已修（源码 absorbed 去重：已进 A/转正的提名不重复占观察席，pool 计数加 absorbed；下一 run 生效） |
| 意外B | agent("同名") 调两次=compile 期非法 | AmendWorkflow 诊断 | ✅ 修为提升 actor 引用复用 ask（获得上下文连续性复审） |
| 意外C | **AmendWorkflow（path 形态）不继承 saved args** → args 依赖脚本修订即死于首个 files.read("undefined") | run `dwfrun-7c35f8b5` 0 秒失败 | ✅ 修法=试车参数固化字面量再修订；P-035 候选立条 |
| 审计简化 | 用户裁"审核过度"：机械对数不换人，同一审计员带上下文全清单重核 | 源码+草案同步 | ✅ |

## M3（2026-10-02/03）

| # | 判据 | 方法 | 结果 |
|---|---|---|---|
| 红队轮 | 失速→强制对抗检索+对抗实验（仅一轮），代码路径在位 | run `dwfrun-90306ccf`（被停后经委托方恢复至完成） | ⚠️ **代码在位、触发未观察**：真证伪先至（站2 exp-C1-AX1=不咬合）清除失速条件，红队按法学条件正确地未触发；触发观察遗留（需"零证伪+零结构必需"专门构造，如禁实验菜单 mock） |
| ⑦ 硬数字门 | entryQuota=10 迫缺口→回炉→RESEARCH-FACE-LIMITED | 同上 | ⚠️ **足额路径验证、LIMITED 未触发**：调研员超交付 14/10——超交付倾向使抬配额无法逼出缺口；注入法遗留（贫瘠检索面学科或 mock 注入开关） |
| 看板/仪表盘 | board+metrics 首跑有数 | 同上 artifacts | ✅ panel board 5 项（3 正式/1 野卡/1 足额）、round metrics 1 项 |
| 涌现提名再证 | 提名路可否凑满 3 路推升结构必需 | 同上 | ✅ 提名两连中（生物信息学·BLAST E 值分带、结构生物学·AlphaFold pLDDT）与文献路合计 3 路→AX1 升结构必需 |
| 意外 | 被停 run 经委托方 UI 恢复至完成 | stop(user)→completed | 如实登记：恢复有效，结果作为 M3 mock 交付 |

## prw-spiral（全螺旋模板，2026-10-02 注册）

- 注册：SaveWorkflow 全局 `prw-spiral`，编译零诊断（立项→面板→轮循环→候裁门→收卷全编排；args=theme/workdir/maxRound=3/relaxMinimums=false）
- 覆盖判据：立项四候选淘汰+独立复审回炉、首轮面板硬数字（relaxMinimums=false 时 20 区/60 学科机械强制）、轴 4-6 根校验、立项候批 escalation 门、C2→C3 起 escalation 候裁、饱和/轮次上限自动收卷
- **试车：✅ 完成**（run `dwfrun-480a9b19` 2026-10-02 发车→10-04 收卷；50 步 27 子代理 0 失败 12 相位；记账 71.26M token；试车参数 maxRound=2+relaxMinimums=true（1 区 2 学科）+**真主题**（正典库演化证书组）；中途进程中断（code=1073807364）经 ResumeWorkflowRun 日志重放恢复，完成步骤零重付）
- 走查通过：✅ 立项候批 escalation 门实录（轮次门书记员-C0，dwfq 代传批准）；✅ 轮循环跨轮 carry（C2 面板=按 C1 LockSpec 收窄 2 区，5 提名全 absorbed 对账）；✅ 站2/站4 实验回执门 4 枚（3 咬合+1 盲区）；✅ 站5 确定性收窄→lock-C2（34,640B）+收卷合成人→review-C2（32,420B，未竟 3 条逐字转写禁改数）
- **诚实机制实录（最有价值一验）**：exp-C2-AX5 G0 十二项前置门 42/50 不过→按预注册 §3 预锁分支**登记盲区**、实验终止步 0、额度 3/3 消耗、禁跨会话续跑——预注册件预锁「则/表」内部冲突（悬空 subject 剔除规则 vs #8/#9 预锁数字）+#5「165」8 种读法不可复现；生产零写实证（六路 mtime+行数基线+ALL MATCH）→分歧出自预注册摸底自身，非生产漂移。v1.1 未竟条款+预注册门在工程上无法被跳过，实证成立
- 真实研究副产物（试车兼做正典库预调研）：5 轴 41 机制；AX1 写入器零判据直通 30/30+矛盾轨劫持 15/15；AX2 器械盲 5/5+重算边界=名称嵌入闭包按(库,名)身份+断点差分≡全量重建 725 键；AX5 五旋钮位全退化；落地判据件草案 P1-P7+R-1（`prw-试车/spiral/review-C2.md` §三，执行序 P1→P5→P4→…）
- 遗留不变：⑥红队触发（两轮 stallSuspected=false 正确未触发）；⑦LIMITED 注入；**C2→C3 轮次候裁门未触发**（cap=2 试车参数所致，同 escalation 机制仅 C0 门实测一次）
- 委托方 GUI 限流实测：max_concurrency 改 1 后 run 适配继续，无需重启

## 试车登记

- 试车 run id：`dwfrun-fe43d3e0-f499-4ab5-ba63-4bb5c33abb04`（2026-10-02，17m55s，669,699 token，5 相位 11 步 0 失败）
- 试车结论：**M1 通过**。锁定件 `prw-试车/m1/lock-C1.md`（5,192B，primary artifact）；配额 3 实收 4（超额不虚报）；锚 4/4 已核+独立抽验 1 条；涌现提名 1 条（Splink，田野已实装级，锚诚实未核年份不写）
- 已知边缘（M2 调优候选）：cSize=1 时 floor(2/3)=0 → 单提名进不了观察席（规则忠实但提名通道在小面板失活；候选修法=pool 非空时 cSize 下限 2）
- 失速嫌疑 true 为 mock 规模的预期正确输出（0 结构必需+0 证伪），非缺陷
