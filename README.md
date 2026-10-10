# pre-research 家族 · 螺旋四站法预调研（权威仓）

> 把任意研究主题推进为多轮收缩的跨学科预调研：广度调研 → 小实验验证 → 深度调研 → 小实验验证 → 确定性收窄，循环收窄直至锁定前沿学科面或触发饱和/轮次上限收卷。**三件套同仓发布，本仓是唯一权威出处。**

## 三件套

```
pre-research/        法学（判据唯一源）          v1.6.0
pre-research-wf/     交互工作流版执行器          v0.6.0   ← 动态工作流，一轮一 run
pre-research-idle/   闲时纯 skill 版执行器       v0.3.0   ← 无工作流依赖，Agent+py 内核
```

| 角色 | 你要用它，当你… | 关键设施 |
|---|---|---|
| 法学 | 想读/改判据（失配标注、矿脉学科、预锁复锁、反噬检查款、终止三判据） | `pre-research/SKILL.md` + `references/methodology.md`（模板/收敛表/预注册格式/矿脉档案/提名池细则） |
| 交互执行器 | 在场精细控制：逐轮候裁、escalation 暂停、看板 | `prw-round`（单轮引擎 v6）+ `prw-spiral`（一键全螺旋），源码在 `pre-research-wf/references/` |
| 闲时执行器 | 挂闲时/夜间任务无人值守：checkpoint 幂等续跑、候裁件自动续 | py 内核 `prw_core.py`（CLI：narrow/stall/audit/conv/selfcheck/ratchets）+ `test_prw_core.py`（76 checks） |

## 法学演进史（六版）

| 版本 | 机制 | 一句话 |
|---|---|---|
| v1.1 | 未竟事项强制披露 | 未达饱和收卷必须列未竟清单带差额与续轮建议，禁「基本收敛」措辞 |
| v1.2 | 涌现提名 | 子代理报告的好苗子强制收集入后续轮：提名池计票、≥3 路转正、观察席、退出入未竟——收窄不再等于遗忘 |
| v1.3 | 反噬检查款 | 预注册必含代价面读数；判定序 kill→反噬→咬合→空转；「效果达成但代价失控」必须落反噬 |
| v1.4 | 预锁复锁+两级门+超配候裁 | 摸底数字执行日复算；活跃管线下结构谓词判死/点值漂移只登记；超配合法须登记 |
| v1.5 | 失配标注+注意力补丁 | **同构只发借用许可，失配才决定怎么借、借了哪里会坏**（Gentner 结构映射）：每条借入机制必标「原生域前提 vs 本域现状」，未寻得失配降半票；ask 三段式/自报计数对账/判定序四行 |
| v1.6 | 矿脉学科 | 极端对口学科的深度发掘：识别门三触发器→五维清单挖档案（机制全集/失败化石/参数空间/演进史/对比边界）→矿脉席（不计收敛路/不占探索税，防单源绑架） |

## 实证

- 2026-10-02~05 工作流真跑四轮（C1~C4，特批终轮**未竟 0 条**收官：五轴全结构必需 46 路，51 条机制入库，假锚拦截 16 起）
- 预注册诚实机制：exp-C2-AX5 登记盲区（预锁「则/表」冲突被门拦下）→ C3 干净收口
- 涌现提名四轮全 absorbed（ORCID/ISAAR/MELD/TSA/Crossmark/LLM 代审等新面孔均由提名通道入席）

## 相关仓

- 流程图与判定分析：[pre-research-skill-flowchart](https://github.com/master666-max/pre-research-skill-flowchart)
- 知识库记账史：[zcode-knowledge-base](https://github.com/master666-max/zcode-knowledge-base)
- 应用实例（正典库演化证书组，C1~C4 全程产物）：[cbb-canon-system](https://github.com/master666-max/cbb-canon-system)（快照语义）

## 纪律（直接引用法学）

预注册先于实验；一手亲取、假引用零容忍；沙盒零生产写；措辞临床化；预锁复锁（执行日步 0 当日复算）；失配标注强制。详见 [`pre-research/SKILL.md`](pre-research/SKILL.md) §八。
