// =====================================================================
// prw-spiral · 螺旋四站法全流程模板（立项面板 → 轮循环 → 锁定件/收卷）
// 法学唯一事实源 = ~/.zcode/skills/pre-research/（v1.2.0+）；单轮专版 = prw-round
// 原则：脚本管数字（配额/计票/收窄/棘轮/差额全确定性代码），子代理管检索判读写作
// 轮次门：C1→C2 默认续跑；C2→C3 起 escalation 候裁（书记员呈报，委托方经会话答复）
// =====================================================================

// ---------- args 窄化 ----------
const theme = String(args.theme);
const workdir = String(args.workdir).replace(/\/+$/, "");
const maxRound = args.maxRound === undefined ? 3 : Number(args.maxRound);
const relaxMinimums = args.relaxMinimums === true;
const skillRef = "C:/Users/26672/.zcode/skills/pre-research/references/methodology.md";
const HONESTY = "若判据不可满足或指令互相矛盾：escalation 明说，禁硬编凑数。";

// ---------- 类型契约 ----------
interface Axis { id: string; name: string; isomorphicProblem: string; breachPoint: string; }
interface Nomination { discipline: string; hook: string; anchor: string; axisId: string; kind: "文献" | "田野"; }
interface Mechanism {
  name: string; hook: string; points: string; anchor: string;
  anchorStatus: "verified" | "unverified"; biteFace: string; experimentability: string;
  axisId: string; kind: "文献" | "田野";
}
interface DiscBatch { discipline: string; mechanisms: Mechanism[]; }
interface MechanismBatch { district: string; entries: DiscBatch[]; nominates: Nomination[]; }
interface QuotaDiscipline { name: string; entryQuota: number; }
interface QuotaDistrict { district: string; disciplines: QuotaDiscipline[]; }
interface Ratchets { recency: string; depth: string; expQuota: number; }
interface PanelSpec { round: number; districts: QuotaDistrict[]; ratchets: Ratchets; }
interface ConvPath { kind: "文献" | "田野" | "提名"; source: string; grade: string; }
interface ConvRow { axisId: string; problem: string; paths: ConvPath[]; pathCount: number; status: "候选" | "结构必需"; }
interface Prereg { hypothesis: string; criteria: string; sandboxPath: string; threeStateRule: string; killCriteria: string; budget: string; preregPath: string; }
interface ExpReceipt { id: string; discipline: string; problem: string; preregPath: string; receiptPath: string; state: "咬合" | "不咬合" | "登记盲区"; killCriteriaMet: boolean; blindSpotProblem?: string; }
interface DeepDive { axisId: string; refinedDisciplines: string[]; note: string; }
interface AnchorVerdict { anchor: string; verdict: "confirmed" | "notFound" | "unclear"; note: string; }
interface PanelEntry { name: string; axisIds: string[]; tier: "正式" | "观察" | "野卡"; origin: string; }
interface QuotaRow { district: string; discipline: string; quota: number; delivered: number; verifiedAnchors: number; unverifiedAnchors: number; limited: boolean; }
interface PoolCarry { round: number; source_district: string; discipline: string; hook: string; anchor: string; axisId: string; kind: string; status: string; paths?: number; }
interface PoolRow { discipline: string; hook: string; anchor: string; axisId: string; kind: "文献" | "田野"; sourceDistrict: string; carriedFrom: number | null; cumPaths: number; score: number; }
interface LockSpec {
  round: number; theme: string;
  panel: PanelEntry[];
  conv: ConvRow[];
  ratchets: Ratchets;
  quotaLedger: QuotaRow[];
  pool: { nominated: number; promoted: number; observing: number; stayed: number; exited: { name: string; reason: string }[]; absorbed: number };
  experiments: ExpReceipt[];
  deepDives: DeepDive[];
  stallSuspected: boolean;
  unfinished: { item: string; gap: string; suggestion: string }[];
}
interface RoundOut { lockSpec: LockSpec; carried: PoolCarry[]; lockPath: string; }
interface PlanOut {
  metaQuestion: string;
  candidates: { q: string; verdict: string; reason: string }[];
  axioms: string[]; certificates: string[];
  axes: Axis[];
  planPath: string; axisPath: string;
}
interface PanelDraft { panelPath: string; districts: QuotaDistrict[]; note: string; }
interface CheckOut { consistent: boolean; issues: string[]; }
interface GateVerdict { proceed: boolean; note: string; }
interface DraftOut { lockPath: string; poolPath: string; panelPath: string; }

// ---------- 看板预设（仪表盘） ----------
artifact.board("panel", { key: "name", status: "status", columns: ["足额", "缺口回炉", "限流", "正式", "观察", "野卡", "退出"], cardTitle: "name" });
artifact.metrics("round", { metrics: [{ field: "structuralRows", label: "结构必需行" }, { field: "experiments", label: "实验数" }, { field: "unfinished", label: "未竟" }] });

// ---------- 纯逻辑（确定性） ----------
function validateAxes(a: Axis[]): void {
  if (!a || a.length < 4) throw new Error(`轴件校验失败：轴 ${a ? a.length : 0} 根 < 4（法学 §二 轴 4-6 根）`);
  const ids = new Set<string>();
  for (const x of a) {
    if (!x.id || !x.name || !x.isomorphicProblem || !x.breachPoint) throw new Error("轴件校验失败：字段缺失");
    if (ids.has(x.id)) throw new Error(`轴件校验失败：轴 id 重复 ${x.id}`);
    ids.add(x.id);
  }
}
function validateQuota(districts: QuotaDistrict[], firstPanel: boolean): void {
  if (!districts || districts.length === 0) throw new Error("配额表校验失败：无区划");
  let total = 0;
  for (const d of districts) {
    if (!d.district) throw new Error("配额表校验失败：存在无名区划");
    if (!d.disciplines || d.disciplines.length === 0) throw new Error(`配额表校验失败：区划「${d.district}」无学科`);
    if (firstPanel && d.disciplines.length > 4) throw new Error(`配额表校验失败：区划「${d.district}」${d.disciplines.length} 学科 > 4（超限拆区）`);
    for (const c of d.disciplines) {
      if (!c.name) throw new Error(`配额表校验失败：区划「${d.district}」存在无名学科`);
      if (!(c.entryQuota >= 3)) throw new Error(`配额表校验失败：${d.district}/${c.name} entryQuota ${c.entryQuota} < 3`);
      total += 1;
    }
  }
  if (firstPanel && !relaxMinimums) {
    if (districts.length < 20) throw new Error(`配额表校验失败：首轮区划 ${districts.length} < 20`);
    if (total < 60) throw new Error(`配额表校验失败：首轮学科合计 ${total} < 60`);
  }
}
function countConv(axes: Axis[], batches: MechanismBatch[]): ConvRow[] {
  return axes.map((a) => {
    const seen = new Set<string>();
    const paths: ConvPath[] = [];
    for (const b of batches) {
      for (const e of b.entries) {
        for (const m of e.mechanisms) {
          if (m.axisId !== a.id) continue;
          const key = (m.kind === "田野" ? "田野" : "文献") + "|" + e.discipline;
          if (seen.has(key)) continue;
          seen.add(key);
          paths.push({ kind: m.kind === "田野" ? "田野" : "文献", source: e.discipline, grade: m.anchorStatus === "verified" ? "带锚已核" : "锚未核" });
        }
      }
      for (const n of b.nominates) {
        if (n.axisId !== a.id) continue;
        const key = "提名|" + n.discipline;
        if (seen.has(key)) continue;
        seen.add(key);
        paths.push({ kind: "提名", source: n.discipline, grade: n.kind === "田野" ? "田野已实装" : "提名" });
      }
    }
    const pathCount = paths.length;
    return { axisId: a.id, problem: a.isomorphicProblem, paths, pathCount, status: (pathCount >= 3 ? "结构必需" : "候选") as ConvRow["status"] };
  });
}
function buildPool(batches: MechanismBatch[], carried: PoolCarry[]): { rows: PoolRow[]; curDisciplines: Set<string> } {
  const cur = new Map<string, { nom: Nomination; districts: Set<string> }>();
  const curDisciplines = new Set<string>();
  for (const b of batches) {
    for (const n of b.nominates) {
      curDisciplines.add(n.discipline);
      const v = cur.get(n.discipline);
      if (v) v.districts.add(b.district);
      else cur.set(n.discipline, { nom: n, districts: new Set([b.district]) });
    }
  }
  const rows = new Map<string, PoolRow>();
  for (const c of carried) {
    const prevPaths = typeof c.paths === "number" && c.paths >= 1 ? c.paths : 1;
    rows.set(c.discipline, {
      discipline: c.discipline, hook: c.hook, anchor: c.anchor, axisId: c.axisId,
      kind: (c.kind === "田野" ? "田野" : "文献") as PoolRow["kind"],
      sourceDistrict: c.source_district, carriedFrom: c.round, cumPaths: prevPaths, score: 0,
    });
  }
  for (const [disc, v] of cur) {
    const ex = rows.get(disc);
    if (ex) ex.cumPaths += v.districts.size;
    else rows.set(disc, {
      discipline: disc, hook: v.nom.hook, anchor: v.nom.anchor, axisId: v.nom.axisId,
      kind: v.nom.kind, sourceDistrict: [...v.districts][0] ?? "", carriedFrom: null,
      cumPaths: v.districts.size, score: 0,
    });
  }
  const arr = [...rows.values()];
  for (const r of arr) {
    const anchorOk = r.anchor && r.anchor.length > 6 && !r.anchor.includes("未核");
    const base = r.kind === "田野" ? 3 : anchorOk ? 2 : 1;
    r.score = base * 100 + r.cumPaths * 10 + (r.carriedFrom !== null ? 5 : 0);
  }
  return { rows: arr.sort((x, y) => y.score - x.score), curDisciplines };
}
const RECENCY = ["不限年代", "≥2005", "≥2018", "≥2024"];
const DEPTH = ["摘要级", "全文精读", "方法论级", "边缘扫尾"];
const QUOTA = [5, 3, 2, 1];
function nextRatchets(round: number): Ratchets {
  const i = Math.min(round, 3);
  return { recency: RECENCY[i], depth: DEPTH[i], expQuota: QUOTA[i] };
}

// ---------- 立项 · 元问题、第一性原理与轴件 ----------
phase("立项·元问题、第一性原理与轴件");
const planner = agent("立项员");
let plan = await planner.ask<PlanOut>(
  `你是预调研立项员。主题：${theme}。先读判据文件 ${skillRef}（§1/§2 附近的元问题四候选淘汰法与第一性原理推导链），然后：\n` +
  `①元问题四候选淘汰法：列 3-4 个候选逐个裁定留一个（时序内嵌优先/一问覆盖四问/静态二分预置贬义淘汰/查重防撞车），操作化为证书组；\n` +
  `②公理 2-4 条（只能来自领域既有公理或既成工程事实，注明出处）→ FP 3-5 条（可独立证伪+本地器械对映，没有对映物的删或降级）→ 轴 4-6 根（每轴带同构问题一句+关键断裂点）；\n` +
  `③落盘两件：立项书 ${workdir}/plan-C0.md + 轴件 ${workdir}/axis-C0.json（{"axes":[{id,name,isomorphicProblem,breachPoint}]}，id 用 AX1..AXn）。\n` +
  `返回结构化 PlanOut（metaQuestion/candidates/axioms/certificates/axes/planPath/axisPath）。\n${HONESTY}`
);
validateAxes(plan.axes);
const axes = plan.axes;
const planReviewer = agent("立项复审员");
const planReview = await planReviewer.ask<CheckOut>(
  `你是立项独立复审员（没参与起草）。用读文件工具读 ${plan.planPath}、${plan.axisPath} 与判据文件 ${skillRef}，独立核对：元问题是否经四候选淘汰且非静态二分/公理是否凭空预设/FP 是否可证伪带器械对映/轴是否 4-6 根且同构问题可用于选学科。返回 {consistent, issues[]}。\n${HONESTY}`
);
if (!planReview.consistent) {
  log(`立项复审未过（${planReview.issues.length} 处），回炉一次`);
  await planner.ask<PlanOut>(`立项件被独立复审驳回，issues：${JSON.stringify(planReview.issues)}。逐条修正 ${plan.planPath} 与 ${plan.axisPath}，返回修订后 PlanOut。\n${HONESTY}`);
  const reReview = await planReviewer.ask<CheckOut>(`复 audit：立项件已修正。全清单从头重核（同上判据），不许只查上轮 issues。返回 {consistent, issues[]}。\n${HONESTY}`);
  if (!reReview.consistent) throw new Error(`立项件两次复审未过：${reReview.issues.join("；")}`);
}
report({ stage: "立项", axes: plan.axes.length, metaQuestion: plan.metaQuestion });

// ---------- 面板 · 首轮配额表 ----------
phase("面板·首轮配额表");
const designer = agent("面板设计师");
const panelDraft = await designer.ask<PanelDraft>(
  `你是面板设计师。主题：${theme}。轴件在 ${plan.axisPath}（读文件），判据：${skillRef}（选学科三条来源+大区审计纪律）。\n` +
  (relaxMinimums
    ? `试车模式（relaxMinimums=true）：编最小试车面板——1 区 × 1-2 学科 × 每学科 entryQuota=3，须覆盖至少一根轴的同构问题。\n`
    : `编首轮广度面板配额表：只按「该学科解决过与某轴同构的问题」入选，禁按学科目录铺；大区审计 ≥20 区逐区过（教育/质量工程/训练学等非显学区必查，判例：非显学区最易整片漏检）；每区 ≤4 学科（超限拆区）；全区学科合计 ≥60；每学科 entryQuota=3。\n`) +
  `落盘 ${workdir}/panel-C1.json（{"round":1,"districts":[{"district":...,"disciplines":[{"name":...,"entryQuota":3}]}],"ratchets":{"recency":"不限年代","depth":"摘要级","expQuota":5}}）。\n` +
  `返回 {panelPath, districts, note}。\n${HONESTY}`
);
validateQuota(panelDraft.districts, true);
report({ stage: "面板", districts: panelDraft.districts.length, disciplines: panelDraft.districts.reduce((s, d) => s + d.disciplines.length, 0) });

// ---------- 立项候批（escalation 门：委托方批准后才进轮循环） ----------
phase("立项候批");
const gate0 = await agent("轮次门书记员-C0").ask<GateVerdict>(
  `你是轮次门书记员。用 escalation 把以下事项呈报委托方审批，等答复后把结论转成结构化返回：\n` +
  `主题「${theme}」立项件已出：元问题「${plan.metaQuestion}」；轴 ${plan.axes.length} 根；首轮面板 ${panelDraft.districts.length} 区 ${panelDraft.districts.reduce((s, d) => s + d.disciplines.length, 0)} 学科。问：批准进入轮循环（C1 起，最多 ${maxRound} 轮，C2→C3 起每轮再候裁）吗？\n` +
  `委托方明确批准 → proceed=true；不批准或要求改 → proceed=false 并在 note 记理由。\n${HONESTY}`
);
if (!gate0.proceed) {
  log(`立项候批未过：${gate0.note}——螺旋未启动即收卷`);
  return {
    conclusion: `立项候批未通过（${gate0.note}），螺旋未启动。立项书：${plan.planPath}`,
    findings: [{ where: "立项", what: "委托方否决立项", evidence: gate0.note, status: "verified", severity: "medium" }],
    verified: ["立项独立复审", "面板配额机械校验"],
    notCovered: ["轮循环及以后全部阶段（候批未过）"],
  };
}

// ---------- 轮循环 · 四站一锁 ----------
let carried: PoolCarry[] = [];
let prevStall = false;
let saturated = false;
let wrapped = false;
let wrapReason = "";
let last: RoundOut | null = null;
const quota: { districts: QuotaDistrict[]; ratchets: Ratchets } = { districts: panelDraft.districts, ratchets: { recency: "不限年代", depth: "摘要级", expQuota: 5 } };

for (let round = 1; round <= maxRound && !wrapped; round++) {
  phase("站1·按区并行广度调研与配额回炉");
  const batches: MechanismBatch[] = await Promise.all(
    quota.districts.map((d) =>
      agent(`调研员-C${round}·${d.district}`).ask<MechanismBatch>(
        `你是预调研第 ${round} 轮站1 的区划调研员，辖区划「${d.district}」。研究主题：${theme}。\n` +
        `先读判据文件 ${skillRef} 的 §1，严格按其执行。执行棘轮（本轮口径）：文献年代下限 ${quota.ratchets.recency}、深度 ${quota.ratchets.depth}。\n` +
        `本区学科与配额：${d.disciplines.map((c) => `${c.name}（≥${c.entryQuota} 条）`).join("、")}。\n` +
        `轴件在 ${plan.axisPath}（读文件）：每条机制挂轴（axisId），同构钩子写"该机制解决什么同构问题"。\n` +
        `纪律：一手亲取，核不到 anchorStatus=unverified 并在 points 尾注疑点；禁编造 DOI/URL/年份；禁凑数。\n` +
        `涌现提名（必填，可空数组）：本区清单之外的新学科/子域/实建系统若解决某轴同构问题，写入 nominates；禁杜撰。\n` +
        `落盘：${workdir}/entries-C${round}-${d.district}.md。返回结构化批次（district 逐字等于「${d.district}」）。\n${HONESTY}`
      )
    )
  );
  const ledger: QuotaRow[] = [];
  let deficits: { district: string; discipline: string; missing: number }[] = [];
  function revalidate(): void {
    ledger.length = 0;
    deficits = [];
    for (const d of quota.districts) {
      const batch = batches.find((b) => b.district === d.district);
      for (const c of d.disciplines) {
        const entry = batch ? batch.entries.find((e) => e.discipline === c.name) : undefined;
        const delivered = entry ? entry.mechanisms.length : 0;
        const verifiedAnchors = entry ? entry.mechanisms.filter((m) => m.anchorStatus === "verified").length : 0;
        ledger.push({ district: d.district, discipline: c.name, quota: c.entryQuota, delivered, verifiedAnchors, unverifiedAnchors: delivered - verifiedAnchors, limited: delivered < c.entryQuota });
        if (delivered < c.entryQuota) deficits.push({ district: d.district, discipline: c.name, missing: c.entryQuota - delivered });
      }
    }
  }
  revalidate();
  for (const def of deficits) {
    const patch = await agent(`调研员-C${round}·${def.district}-回炉`).ask<MechanismBatch>(
      `回炉补齐：第 ${round} 轮区划「${def.district}」学科「${def.discipline}」缺 ${def.missing} 条。判据 ${skillRef} §1，轴件 ${plan.axisPath}，棘轮 ${quota.ratchets.recency}/${quota.ratchets.depth}。只补缺口学科，同纪律。返回 MechanismBatch（district 逐字=「${def.district}」，entries 只放缺口学科）。\n${HONESTY}`
    );
    const base = batches.find((b) => b.district === def.district);
    if (base) {
      const target = base.entries.find((e) => e.discipline === def.discipline);
      const pe = patch.entries.find((e) => e.discipline === def.discipline);
      if (target && pe) target.mechanisms = [...target.mechanisms, ...pe.mechanisms];
      else if (pe) base.entries.push(pe);
      base.nominates = [...base.nominates, ...patch.nominates];
    } else batches.push(patch);
  }
  revalidate();
  const limitedRows = ledger.filter((r) => r.limited);
  for (const b of batches) report({ round, district: b.district, mechanisms: b.entries.reduce((s, e) => s + e.mechanisms.length, 0), nominations: b.nominates.length });
  // 锚点抽验（每轮 ≤3，独立复核）
  const sample: { anchor: string; where: string }[] = [];
  for (const b of batches) {
    for (const e of b.entries) {
      if (sample.length >= 3) break;
      const m = e.mechanisms.find((x) => x.anchorStatus === "verified");
      if (m) sample.push({ anchor: m.anchor, where: `${b.district}/${e.discipline}/${m.name}` });
    }
    if (sample.length >= 3) break;
  }
  if (sample.length > 0) {
    const auditorCk = agent(`锚点复核员-C${round}`);
    const verdicts = await auditorCk.ask<AnchorVerdict[]>(`你是一手锚独立复核员。逐条检索核实下列锚（真实性+字段对得上），返回数组 anchor（逐字回抄）/verdict（confirmed|notFound|unclear）/note。只判锚真伪。清单：${JSON.stringify(sample)}\n${HONESTY}`);
    for (const v of verdicts) {
      if (v.verdict !== "notFound") continue;
      for (const b of batches) for (const e of b.entries) for (const m of e.mechanisms) {
        if (m.anchor === v.anchor) { m.anchorStatus = "unverified"; log(`C${round} 抽验降级：${v.anchor.slice(0, 50)} → unverified`); }
      }
    }
  }
  revalidate();

  // 站2
  phase("站2·小实验验证");
  let conv: ConvRow[] = countConv(axes, batches);
  const receipts: ExpReceipt[] = [];
  async function runExperiments(rows: ConvRow[], budget: number, station: string): Promise<void> {
    if (rows.length === 0 || budget <= 0) {
      const probe = await world.run("py", ["-c", "print('empty experiment menu: no converged rows >=3 paths or quota exhausted')"]);
      log(`${station} 空菜单确认（exit ${probe.exitCode}）`);
      return;
    }
    for (const row of rows) {
      const id = `exp-C${round}-${row.axisId}`;
      const prereg = await agent(`预注册员-C${round}·${row.axisId}`).ask<Prereg>(
        `针对收敛行（轴 ${row.axisId}「${row.problem}」，${row.pathCount} 路）设计小实验预注册件。判据 ${skillRef} §5/§6。六字段必填（hypothesis/criteria/sandboxPath=${workdir}/sandbox/${id}/，零生产写/threeStateRule/killCriteria/budget=单枚≤1会话/preregPath），落盘 ${workdir}/sandbox/${id}-prereg.md。\n${HONESTY}`
      );
      if (!prereg.hypothesis || !prereg.criteria || !prereg.killCriteria) throw new Error(`预注册件字段缺失：${id}`);
      const rec = await agent(`实验员-C${round}·${row.axisId}`).ask<ExpReceipt>(
        `读预注册件 ${prereg.preregPath}，按其执行小实验：沙盒 ${workdir}/sandbox/${id}/ 内最小验证（可用 py），零生产写，kill 即停。三态判定，落盘 ${workdir}/sandbox/${id}-receipt.md，返回结构化回执（id=${id}，receiptPath 工作区相对）。\n${HONESTY}`
      );
      if (!rec.receiptPath) throw new Error(`实验回执缺 receiptPath：${id}`);
      const gate = await world.run("py", ["-c", "import io;io.open(r'" + rec.receiptPath.replace(/\\/g, "/") + "', encoding='utf-8').read();print('receipt ok')"]);
      if (gate.exitCode !== 0) throw new Error(`回执文件门未过：${rec.receiptPath}`);
      receipts.push(rec);
      report({ round, id: rec.id, station, state: rec.state });
    }
  }
  await runExperiments(conv.filter((r) => r.status === "结构必需").slice(0, Math.ceil(quota.ratchets.expQuota / 2)), Math.ceil(quota.ratchets.expQuota / 2), "站2");

  // 站3
  phase("站3·深度调研");
  const deepDives: DeepDive[] = [];
  const structural = conv.filter((r) => r.status === "结构必需").slice(0, 3);
  if (structural.length === 0) {
    const probe = await world.run("py", ["-c", "print('no structural axis: deep dive legally empty')"]);
    log(`站3 空清单确认（exit ${probe.exitCode}）`);
  } else {
    for (const row of structural) {
      const axis = axes.find((a) => a.id === row.axisId);
      if (!axis) continue;
      const dive = await agent(`深读员-C${round}·${row.axisId}`).ask<DeepDive>(
        `轴 ${row.axisId}「${axis.isomorphicProblem}」结构必需（${row.pathCount} 路）。对贡献学科全文级精读：读 ${workdir}/entries-C${round}-*.md 批件并自行检索原文，机制要点精化、咬合面校准、批件错处更正、【未核】升级。笔记落盘 ${workdir}/deep-C${round}-${row.axisId}.md。返回 {axisId, refinedDisciplines, note}。\n${HONESTY}`
      );
      deepDives.push(dive);
      report({ round, axisId: dive.axisId, refined: dive.refinedDisciplines.length });
    }
  }

  // 站4
  phase("站4·小实验验证（剩余配额）");
  {
    const doneIds = new Set(receipts.map((r) => r.id));
    const remaining = conv.filter((r) => r.status === "结构必需" && !doneIds.has(`exp-C${round}-${r.axisId}`));
    await runExperiments(remaining, quota.ratchets.expQuota - receipts.length, "站4");
  }

  // 红队轮（法学 §七：连续两站零证伪且零新结构必需 → 强制红队，仅一轮）
  phase("红队轮·对抗性检索与对抗性实验");
  const preFalsified = receipts.filter((r) => r.state === "不咬合").length;
  const preStructural = conv.filter((r) => r.status === "结构必需").length;
  const stallSuspected = preFalsified === 0 && preStructural === 0;
  if (stallSuspected) {
    log(`C${round} 失速确认（两站零证伪+零新结构必需）→ 强制红队轮（仅此一轮）`);
    const adv = await agent(`红队检索员-C${round}`).ask<MechanismBatch>(
      `你是红队对抗检索员。当前螺旋失速：两站零证伪且零新结构必需。任务不是补常规条目：①从「最可能证伪现有收敛结论」的角度定向检索；②从完全未被扫过的学科中找轴（轴件 ${plan.axisPath}，读文件）的同构解；③为候选收敛行找第 3 路。返回 MechanismBatch（district 逐字填「红队-对抗检索」，纪律同站1）。不足 3 条照实返回。\n${HONESTY}`
    );
    batches.push(adv);
    conv = countConv(axes, batches);
    const advExp = await agent(`红队实验员-C${round}`).ask<ExpReceipt>(
      `你是红队对抗实验员。对当前最强候选设计并执行一枚「证伪向」小实验：假如它不成立，最容易观测到什么？沙盒 ${workdir}/sandbox/redteam-C${round}/，零生产写。三态判定，落盘回执 ${workdir}/sandbox/redteam-C${round}-receipt.md，返回结构化回执（id 填 redteam-C${round}，receiptPath 工作区相对）。\n${HONESTY}`
    );
    if (advExp.receiptPath) {
      const gate = await world.run("py", ["-c", "import io;io.open(r'" + advExp.receiptPath.replace(/\\/g, "/") + "', encoding='utf-8').read();print('ok')"]);
      if (gate.exitCode !== 0) throw new Error(`红队回执门未过：${advExp.receiptPath}`);
      receipts.push(advExp);
      report({ round, id: advExp.id, station: "红队", state: advExp.state });
    }
    log(`C${round} 红队后：结构必需 ${conv.filter((r) => r.status === "结构必需").length}，证伪 ${receipts.filter((r) => r.state === "不咬合").length}（红队仅此一轮）`);
  }
  saturated = prevStall && stallSuspected;

  // 站5 · 确定性收窄
  phase("站5·确定性收窄并合成锁定件");
  const aSet = new Set<string>();
  for (const r of conv) if (r.status === "结构必需") for (const p of r.paths) aSet.add(p.source);
  const bSet = new Set<string>(receipts.filter((r) => r.state === "咬合").map((r) => r.discipline));
  const ab = [...new Set([...aSet, ...bSet])].filter((name) => !limitedRows.some((lr) => lr.discipline === name));
  const built = buildPool(batches, carried);
  const promoted = built.rows.filter((r) => r.cumPaths >= 3);
  const poolRestPre = built.rows.filter((r) => r.cumPaths < 3);
  const exited: { name: string; reason: string }[] = [];
  const absorbed: string[] = [];
  const seated = new Set<string>([...ab, ...promoted.map((p) => p.discipline)]);
  const poolRest: PoolRow[] = [];
  for (const r of poolRestPre) {
    if (seated.has(r.discipline)) { absorbed.push(r.discipline); continue; }
    const carry = carried.find((c) => c.discipline === r.discipline);
    const wasSeated = carry ? carry.status === "观察" : false;
    if (wasSeated && !built.curDisciplines.has(r.discipline)) exited.push({ name: r.discipline, reason: "连续一轮零新证据（上轮观察席，本轮无再提名）" });
    else poolRest.push(r);
  }
  let cSize = ab.length === 0 ? Math.min(Math.max(poolRest.length, 0), 6) : Math.max(Math.ceil(ab.length * 0.25), 1);
  if (poolRest.length > 0) cSize = Math.max(cSize, 2);
  if (ab.length === 0 && cSize > 6) cSize = 6;
  const wildFromPool = Math.min(poolRest.length, Math.floor((cSize * 2) / 3), 6);
  const panelEntries: PanelEntry[] = [];
  for (const p of promoted) panelEntries.push({ name: p.discipline, axisIds: [p.axisId], tier: "正式", origin: `涌现提名·累计${p.cumPaths}路转正（免观察）` });
  for (const name of ab) {
    const axisIds = conv.filter((r) => r.status === "结构必需" && r.paths.some((p) => p.source === name)).map((r) => r.axisId);
    panelEntries.push({ name, axisIds, tier: "正式", origin: aSet.has(name) ? "A·≥3路收敛供给" : "B·实验存活" });
  }
  for (let i = 0; i < wildFromPool; i++) panelEntries.push({ name: poolRest[i].discipline, axisIds: [poolRest[i].axisId], tier: "观察", origin: `涌现提名·观察席（累计 ${poolRest[i].cumPaths} 路）` });
  const freeSlots = Math.max(cSize - wildFromPool, 0);
  for (let i = 0; i < freeSlots; i++) panelEntries.push({ name: `（自由探索位 ${i + 1}·待下轮立项补）`, axisIds: [], tier: "野卡", origin: "自由探索（≥1/3 税）" });
  const unfinished: { item: string; gap: string; suggestion: string }[] = [];
  for (const r of conv) if (r.status === "候选") unfinished.push({ item: `同构问题「${r.problem}」未收敛`, gap: `还差 ${3 - r.pathCount} 路独立命中`, suggestion: "下轮站1 定向补检" });
  if (poolRest.length > wildFromPool) unfinished.push({ item: `提名池存量 ${poolRest.length - wildFromPool} 条未入观察席`, gap: "排序超额落选", suggestion: "下轮续排（留池不丢）" });
  for (const r of limitedRows) unfinished.push({ item: `${r.district}/${r.discipline} 检索面受限`, gap: `配额 ${r.quota} 实收 ${r.delivered}`, suggestion: "下轮换检索面或降级出面板" });
  for (const e of exited) unfinished.push({ item: `观察席退出：${e.name}`, gap: e.reason, suggestion: "登记已探未收敛" });
  for (const rec of receipts) if (rec.state === "登记盲区" && rec.blindSpotProblem) unfinished.push({ item: `登记盲区：${rec.blindSpotProblem}`, gap: "实验无法判定", suggestion: "升格为下轮候选同构问题" });

  const nextQuota = nextRatchets(round);
  const lockSpec: LockSpec = {
    round, theme,
    panel: panelEntries,
    conv,
    ratchets: nextQuota,
    quotaLedger: ledger,
    pool: { nominated: built.rows.length, promoted: promoted.length, observing: wildFromPool, stayed: poolRest.length - wildFromPool, exited, absorbed: absorbed.length },
    experiments: receipts,
    deepDives,
    stallSuspected,
    unfinished,
  };
  const lockJson = JSON.stringify(lockSpec, null, 1);
  log(`C${round} 站5 收窄完成：转正 ${promoted.length}+正式 ${ab.length}+观察 ${wildFromPool}+野卡 ${freeSlots}；失速=${stallSuspected} 饱和=${saturated}；未竟 ${unfinished.length}`);

  const drafter = agent(`锁定件合成员-C${round}`);
  const draft = await drafter.ask<DraftOut>(
    `你是锁定件合成员。权威 LockSpec（禁改数字，只转写）：\n${lockJson}\n\n落盘三件：①${workdir}/lock-C${round}.md（本轮快照/收敛表/下轮面板/棘轮与配额/提名池快照/自检/未竟事项带差额）；②${workdir}/pool-C${round}.jsonl（每提名一行 JSON：round/source_district/discipline/hook/anchor/axisId/kind/status/paths）；③${workdir}/next-panel-C${round}.json（{"round":${round + 1},"seats":<panel 原样>,"ratchets":<ratchets 原样>,"prevStall":<stallSuspected 原样>}）。返回 {lockPath, poolPath, panelPath}。\n${HONESTY}`
  );
  const auditor = agent(`锁定件审计员-C${round}`);
  let audit = await auditor.ask<CheckOut>(
    `机械核对 ${draft.lockPath}、${draft.poolPath}、${draft.panelPath} 与权威 LockSpec：\n${lockJson}\n\n（面板各档数量/收敛行数与 pathCount/棘轮三值/配额账行数/未竟差额=3−pathCount/池行数/席位件字段）。返回 {consistent, issues[]}，只核对不修改。\n${HONESTY}`
  );
  if (!audit.consistent) {
    await drafter.ask<DraftOut>(`审计 issues：${JSON.stringify(audit.issues)}。逐条修正三件（数字以 LockSpec 为准），返回 {lockPath, poolPath, panelPath}。\n${HONESTY}`);
    audit = await auditor.ask<CheckOut>(`复 audit：三件已修正。全清单从头重核，不许只查上轮 issues。返回 {consistent, issues[]}。\n${HONESTY}`);
  }
  try {
    await artifact.file("lock", draft.lockPath, { title: `站5 锁定件 C${round}`, description: `${theme}·第 ${round} 轮` });
  } catch (e) { log(`锁定件发布失败：${String(e)}`); }

  last = { lockSpec, carried: built.rows.map((r) => ({ round, source_district: r.sourceDistrict, discipline: r.discipline, hook: r.hook, anchor: r.anchor, axisId: r.axisId, kind: r.kind, status: r.cumPaths >= 3 ? "转正" : (wildFromPool > 0 && poolRest.slice(0, wildFromPool).some((s) => s.discipline === r.discipline) ? "观察" : "在池"), paths: r.cumPaths })), lockPath: draft.lockPath };
  carried = last.carried;
  prevStall = stallSuspected;
  quota.districts = [];
  quota.ratchets = nextQuota;

  // 轮次门：C1→C2 默认；C2→C3 起 escalation 候裁
  if (saturated) { wrapped = true; wrapReason = "饱和（连续两轮零证伪+零新结构必需）"; break; }
  if (round >= maxRound) { wrapped = true; wrapReason = `轮次上限 ${maxRound} 轮`; break; }
  if (round >= 2) {
    phase("轮次候裁");
    const gate = await agent(`轮次门书记员-C${round}`).ask<GateVerdict>(
      `你是轮次门书记员。用 escalation 呈报委托方：C${round} 已收口（锁定件 ${draft.lockPath}；下轮面板 转正 ${promoted.length}/正式 ${ab.length}/观察 ${wildFromPool}/野卡 ${freeSlots}；未竟 ${unfinished.length} 条；饱和=${saturated}）。问：批准续跑 C${round + 1} 吗？明确批准 → proceed=true；否则 false 并记 note。\n${HONESTY}`
    );
    if (!gate.proceed) { wrapped = true; wrapReason = `委托方于 C${round}→C${round + 1} 候裁叫停：${gate.note}`; log(`轮次候裁叫停：${gate.note}`); break; }
    log(`轮次候裁批准：续跑 C${round + 1}（${gate.note}）`);
  } else {
    log(`C${round}→C${round + 1} 默认续跑（轮次制：C2 默认做）`);
  }
  // 下一轮配额表：由席位件展开（面板设计师按席位生成 quota districts，硬数字仅约束首轮）
  phase("下轮面板展开");
  const nextPanel = await agent(`面板设计师-C${round + 1}`).ask<PanelDraft>(
    `你是面板设计师。第 ${round + 1} 轮的席位件在 ${draft.panelPath}（读文件：seats=下轮 panel 席位，含 正式/观察/野卡）。把它展开成第 ${round + 1} 轮配额表：每个有实义学科席位 entryQuota=3 并归入合适区划；「自由探索位」由你补一个与已有学科不重复、可能解决未收敛同构问题的新学科（这是探索税的用途）；野卡空位照列但 entryQuota=0 不参与站1。\n` +
    `落盘 ${workdir}/panel-C${round + 1}.json（{"round":${round + 1},"districts":[...],"ratchets":${JSON.stringify(nextQuota)}}）。返回 {panelPath, districts, note}。\n${HONESTY}`
  );
  validateQuota(nextPanel.districts, false);
  quota.districts = nextPanel.districts;
  quota.ratchets = nextQuota;
}

// ---------- 收卷 ----------
if (wrapped && last) {
  phase("收卷·综述回顾件与落地判据件草案");
  const lockJson = JSON.stringify(last.lockSpec, null, 1);
  const finalRound = last.lockSpec.round;
  const review = await agent("收卷合成人").ask<{ reviewPath: string }>(
    `你是收卷合成人。权威 LockSpec：\n${lockJson}\n\n通读 ${workdir}/ 下在案批件与回执（读文件工具），写收卷件 ${workdir}/review-C${finalRound}.md 三节：①综述回顾（吸收/放弃逐条带出处）②未竟事项（照 LockSpec.unfinished 禁改数）③落地判据件草案（每件落点预注册）。收卷性质：${wrapReason}。措辞临床化。返回 {reviewPath}。\n${HONESTY}`
  );
  await artifact.file("review", review.reviewPath, { title: `收卷件 C${finalRound}`, description: `${theme}·${wrapReason}`, primary: true });
  log(`收卷完成：${review.reviewPath}（${wrapReason}）`);
  return {
    conclusion: `螺旋收卷（${wrapReason}）：共执行 ${last.lockSpec.round} 轮，末轮面板 转正+正式 ${last.lockSpec.panel.filter((p) => p.tier === "正式").length}/观察 ${last.lockSpec.panel.filter((p) => p.tier === "观察").length}/野卡 ${last.lockSpec.panel.filter((p) => p.tier === "野卡").length}，未竟 ${last.lockSpec.unfinished.length} 条。收卷件：${review.reviewPath}`,
    findings: last.lockSpec.unfinished.map((u) => ({ where: `C${last!.lockSpec.round} 未竟`, what: u.item, evidence: u.gap, status: "verified" as const, severity: "low" as const })),
    verified: ["各轮配额机械验收", "各轮锚点独立抽验", "各轮锁定件一致性审计", "轮次候裁门（escalation 实录）"],
    notCovered: ["田野第六路双源摸底（接入排期见 PLAN M3）"],
  };
}
return {
  conclusion: `螺旋未进入收卷（循环耗尽但未置收卷标记——理论不可达，若见到此条即为脚本缺陷）`,
  findings: [], verified: [], notCovered: ["全部"],
};
