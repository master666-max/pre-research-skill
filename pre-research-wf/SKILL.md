---
name: pre-research-wf
description: 预调研·螺旋四站法工作流版（执行器）：以动态工作流跑「一轮一 run」的螺旋预调研——站1 区划并行广度调研→小实验→深度调研→小实验→确定性收窄产出锁定件，轮间候裁，直至饱和/3 轮上限/叫停收卷。当用户要求「发车预调研工作流」「用工作流跑螺旋预调研」「pre-research-wf」「prw 发车」时使用；单点选型、一次性事实检索不适用（直接检索即可，不开螺旋）。
version: 0.6.0
agent_created: true
---

# pre-research-wf · 螺旋四站法工作流版（导线协议）

**定位**：本技能是执行器；判据与验收的唯一事实源 = `~/.zcode/skills/pre-research/`（v1.5.0+，只读引用，子代理按路径自取——v1.3.0 反噬检查款/判定序，v1.4.0 预锁复锁+两级门+超配候裁，v1.5.0 失配标注强制：Mechanism.mismatch 必填，子代理须按新模板）。设计规划书见本目录 `PLAN.md`。两个全局 saved workflow：

| 工作流 | 覆盖 | 用法 | 适用 |
|---|---|---|---|
| `prw-round`（单轮引擎） | 站1-站5 + 锁定件/席位件/收卷分支；面板与轴件为输入 | 导线分步发车（本轮协议，轮间人工候裁） | 精细控制、逐轮候裁、成本低的可控节奏 |
| `prw-spiral`（全螺旋模板） | **立项（元问题/FP/轴）→ 首轮面板（硬数字 ≥20 区/60 学科）→ 轮循环 → 候裁门 → 收卷** 一键全包 | `saved: {name:"prw-spiral", args:{theme, workdir}}`；立项候批与 C2→C3 候裁走 escalation 暂停等委托方 | 一键托管；注意全螺旋单 run 成本量级=每轮数百万 token |

源码：`references/prw-round.dwf.ts` / `references/prw-spiral.dwf.ts`；验收单 `references/accept.md`。

## 〇 · 导线状态机（主会话职责）

1. **立项件**（计划书候批，零执行）：起草元问题（四候选淘汰）→ FP 链（公理→FP→轴）→ **轴件** `axis.json` → **配额表** `panel.json`。
2. **发车**：`CreateWorkflow saved:prw-round` + args（theme/round/workdir/axisPath/panelPath）。**不传 `subagent_model`**——子代理继承会话模型（用户裁决 2026-10-02 v2，见 PLAN §六·五）。
3. **轮间机械校验**：run 完成后核对 ①锁定件 artifact 与 `LockSpec` 数字一致（脚本内审计员已核，导线抽验）②子代理 model 字段=会话档（首 run 一次）③提名池/收敛表分片落盘在案。
4. **轮次门**：C1→C2 **默认续跑不问人**；C2→C3 **候裁**（呈锁定件）；≥3 轮硬顶，续轮再候裁。
5. **终止三判据**：①饱和（连续两站零证伪+零新 ≥3 路收敛，脚本算出 stallSuspected）②轮次上限 3 轮 ③用户叫停。触发即收卷：综述回顾件（未竟事项节照 LockSpec.unfinished 逐条，禁改数）+ 落地判据件草案。

## 〇·五 · 轮间操作（M2）

- C<k> run 完成 → 导线机械校验（锁定件数字 vs 审计 issues、池分片在案、首 run model 冒烟）。
- 起草下一轮配额表 `panel-C<k+1>.json`：把脚本产出的 `next-panel-C<k>.json`（席位件）展开为区划/学科配额——正式/观察/转正席 entryQuota ≥3；**自由探索位由导线补实义学科**；真实立项遵守硬数字规则（区划 ≥20/每区 ≤4/合计 ≥60）。
- 发车 C<k+1>：args 增 `prevPoolPath=pool-C<k>.jsonl`、`prevStall=<上轮 stallSuspected>`；`maxRound` 默认 3。
- **C2 默认续跑不问人；C3 候裁**；续轮再候裁。
- 脚本自动收卷条件：saturated（连续两轮失速）∥ round ≥ maxRound ∥ forceWrapUp=true（用户叫停收卷=发车一轮带 forceWrapUp）→ 产出收卷件（综述回顾+未竟事项+落地判据件草案，primary artifact）。
- 跨轮语义（脚本内建）：提名累计 ≥3 路 → 免观察转正；上轮观察席且本轮零再提名 → 退出入未竟；留池行永远续排不丢。

## 一 · 立项件硬数字（防偷懒配额表，用户裁决 2026-10-02）


`panel.json` 必须机器可读且满足：**区划 ≥20（典型 20-24）**、**每区 ≤4 学科（超限强制拆区）**、**全区学科合计 ≥60**、**每学科 entryQuota ≥3**。真实立项缺一不发车；最小 mock 试车（1 区 1 学科）仅限 `accept.md` 登记的试车单场景。

## 二 · 产物落盘（workdir 内，工作区相对路径）

`entries-C<k>-<区>.md`（站1 批件）→ `conv-C<k>`（收敛表，入锁定件）→ `sandbox/`（实验沙盒，零生产写）→ `pool-C<k>.jsonl`（提名池台账，append-only 按轮分片）→ `lock-C<k>.md`（站5 锁定件 = 下轮 panel 来源）。每轮 workdir 独立或分轮前缀，**禁多代并发写同一文件**（P-031）。

## 三 · 试车与验收

按 `references/accept.md` 执行；M1 试车单 = 最小螺旋（mock），通过标准：站1-站5 全走通、LockSpec 与锁定件数字两方一致、world.run 门与一致性审计有在案回执。**真实运行阶段**（2026-10-03~05，路线甲 C3/C4 两轮真调研全链+未竟 0 收官）实录与已知缺陷见 accept.md「真实运行阶段」章。

## 三·五 · 运行谱系纪律（P-043，真跑教训）

- **一轮一 run 的「一轮」指逻辑轮**；run 代际（中断恢复/重拉/GUI 接管）谱系混乱时，**唯一活线=主会话最新消息报备的 run id**，其余卡片视作考古层。
- 修订三铁律：**修 args（脚本字面量化）先于修血统（选修订目标）**；修订必须挂在**持有工作日志的代**（[[P-036]]）；修完必须**实测 cached_steps>0**，不许凭回执文案断言缓存命中。
- saved workflow 的 args 只在 CreateWorkflow saved 调用时正常继承（[[P-035]]）——正式发车一律走 saved 通道；settings-only amend 与 GUI 接管代**必丢 args**，只用于参数已字面量化的专车脚本。
- TaskStop 回执不可信（cc571c6c 击杀后复活实锤）：击杀后必须 post-stop 45 秒以上再拉 running/pending 清单验尸。
- 「零子代理在工作」三分鉴别：等槽+`rate_limited` 标记=限流背下（自愈，勿动）｜等槽+零 executing+token 不涨 20 分钟=僵尸（拧法=对该 run 做一次 settings 重发逼其吐 settled）｜徽标在而清单无=死代残影（无视）。

## 四 · 纪律

- 判据单一源：子代理按路径读 pre-research 技能文件，本技能不复述判据正文。
- escalation 诚实条款进所有 persona：判据不可满足就明说，禁凑数禁伪造。
- 世界观：脚本管数字，子代理管检索判读写作；数字冲突以 `LockSpec` 为准。
