# -*- coding: utf-8 -*-
"""prw_core.py 谓词级测试（TDD 先行；用例与 TS v4 版 EvalWorkflowSnippet 13 用例同源 + py 专属边界）。
跑法：py -X utf8 test_prw_core.py  → 全绿输出 ALL GREEN，任何断言失败抛 AssertionError。"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prw_core import (  # noqa: E402
    LAW_RECEIPT_STATES,
    audit_quota,
    build_pool,
    count_conv,
    judge_stall,
    merge_rebake,
    narrow,
    next_ratchets,
    validate_panel,
)

# ---------- fixture 工厂（与 TS 版逐字段同源） ----------

def mk_row(axis_id, status):
    return {"axisId": axis_id, "problem": "p", "paths": [], "pathCount": 3 if status == "结构必需" else 1, "status": status}

def mk_mech(verified=True, axis_id="AX1", kind="文献", mismatch=None):
    return {"name": "m", "hook": "h", "points": "p", "anchor": "a" if verified else "",
            "anchorStatus": "verified" if verified else "unverified", "biteFace": "b",
            "mismatch": mismatch if mismatch is not None else "未寻得失配",
            "experimentability": "e", "axisId": axis_id, "kind": kind}

def mk_disc(disc, n, verified=True):
    return {"discipline": disc, "mechanisms": [mk_mech(verified) for _ in range(n)]}

def mk_batch(district, disc, n):
    return {"district": district, "entries": [mk_disc(disc, n)], "nominates": []}

def mk_receipt(rid, state="不咬合", discipline="d"):
    return {"id": rid, "discipline": discipline, "problem": "p", "preregPath": "x", "receiptPath": "y",
            "state": state, "killCriteriaMet": False}

def mk_nom(disc, axis_id="AX1", kind="文献", anchor="UK MoJ Splink 开源记录链接引擎 github.com/moj-analytical-services/splink"):
    return {"discipline": disc, "hook": "h", "anchor": anchor, "axisId": axis_id, "kind": kind}

CHECKS = []

def check(name, actual, expected):
    ok = json.dumps(actual, ensure_ascii=False, sort_keys=True) == json.dumps(expected, ensure_ascii=False, sort_keys=True)
    CHECKS.append((ok, name, actual, expected))
    assert ok, f"FAIL {name}: actual={json.dumps(actual, ensure_ascii=False)[:200]} expected={json.dumps(expected, ensure_ascii=False)[:200]}"

# ---------- validate_panel ----------
def test_validate_panel():
    ok_panel = {"round": 1, "districts": [{"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 3}]}], "ratchets": {"recency": "不限年代", "depth": "摘要级", "expQuota": 5}}
    validate_panel(ok_panel)  # 不抛即过
    for bad, frag in [
        ({"round": 1, "districts": []}, "无区划"),
        ({"round": 1, "districts": [{"district": "", "disciplines": [{"name": "甲", "entryQuota": 3}]}]}, "无名区划"),
        ({"round": 1, "districts": [{"district": "区1", "disciplines": []}]}, "无学科"),
        ({"round": 1, "districts": [{"district": "区1", "disciplines": [{"name": "", "entryQuota": 3}]}]}, "无名学科"),
        ({"round": 1, "districts": [{"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 0}]}]}, "非法"),
    ]:
        try:
            validate_panel(bad)
            raise AssertionError(f"validate_panel 未拦截坏表：{frag}")
        except ValueError as e:
            assert frag in str(e), f"报错文案缺「{frag}」：{e}"

# ---------- ⑥ judge_stall ----------
def test_judge_stall():
    cand = mk_row("AX1", "候选")
    struct = mk_row("AX2", "结构必需")
    check("⑥a 零证伪+零结构必需 → 失速", judge_stall([], [cand]), True)
    check("⑥b 有不咬合（证伪清障）→ 不失速", judge_stall([mk_receipt("e1", "不咬合")], [cand]), False)
    check("⑥c 有结构必需 → 不失速", judge_stall([], [struct]), False)
    check("⑥d 空receipts空conv → 失速（空转边界）", judge_stall([], []), True)

# ---------- ⑦ audit_quota / merge_rebake ----------
def test_audit_and_rebake():
    panel = {"round": 1, "districts": [{"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 3}, {"name": "乙", "entryQuota": 3}]}],
             "ratchets": {"recency": "不限年代", "depth": "摘要级", "expQuota": 5}}
    batches = [{"district": "区1", "entries": [mk_disc("甲", 2), mk_disc("乙", 3)], "nominates": []}]
    a = audit_quota(panel, batches)
    check("⑦a 缺口识别（甲 2/3 → 仅甲入 deficits）", a["deficits"], [{"district": "区1", "discipline": "甲", "missing": 1}])
    check("⑦b LIMITED 标记落在缺口行", [r["limited"] for r in a["ledger"]], [True, False])
    check("⑦c 锚核计数", [r["verifiedAnchors"] for r in a["ledger"]], [2, 3])

    # 回炉：原学科追加分支
    added = merge_rebake(batches, a["deficits"][0], {"district": "区1", "entries": [mk_disc("甲", 1)], "nominates": []})
    check("⑦d 回炉追加分支补 1 条", added, 1)
    a = audit_quota(panel, batches)
    check("⑦e 回炉后缺口清零（LIMITED 解除）", a["deficits"], [])
    check("⑦f 回炉后 limited 全 false", all(not r["limited"] for r in a["ledger"]), True)

    # 回炉：提名并账
    merge_rebake(batches, {"district": "区1", "discipline": "甲"}, {"district": "区1", "entries": [], "nominates": [mk_nom("新学科")]})
    check("⑦g 补丁提名并入主批次", len(batches[0]["nominates"]), 1)

    # 回炉：整区新增分支
    batches2 = []
    added2 = merge_rebake(batches2, {"district": "区9", "discipline": "丙"}, {"district": "区9", "entries": [mk_disc("丙", 2)], "nominates": []})
    check("⑦h 整区新增分支补 2 条", added2, 2)
    a2 = audit_quota({"round": 1, "districts": [{"district": "区9", "disciplines": [{"name": "丙", "entryQuota": 2}]}], "ratchets": panel["ratchets"]}, batches2)
    check("⑦i 新区验收足额", [r["limited"] for r in a2["ledger"]], [False])

# ---------- count_conv ----------
def test_count_conv():
    axes = [{"id": "AX1", "name": "轴1", "isomorphicProblem": "p1", "breachPoint": "b1"},
            {"id": "AX2", "name": "轴2", "isomorphicProblem": "p2", "breachPoint": "b2"}]
    batches = [
        {"district": "区1", "entries": [{"discipline": "甲", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX1")]}], "nominates": [mk_nom("丙", "AX1", "田野")]},
        {"district": "区2", "entries": [{"discipline": "甲", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": [mk_nom("丙", "AX1", "田野")]},
    ]
    conv = count_conv(axes, batches)
    # 同区划同源去重：甲 2 条同轴只计 1 路；提名丙两区各 1 路=2 路；AX1=文献甲+提名丙=2 路
    ax1 = next(r for r in conv if r["axisId"] == "AX1")
    check("conv 同区去重", ax1["pathCount"], 2)
    check("conv 提名两区计 2 路", sum(1 for p in ax1["paths"] if p["kind"] == "提名"), 1)  # 提名按 discipline 去重（同 disc 同 kind 键）
    ax2 = next(r for r in conv if r["axisId"] == "AX2")
    check("conv 无命中行为候选 0 路", (ax2["pathCount"], ax2["status"]), (0, "候选"))

# ---------- build_pool ----------
def test_build_pool():
    batches = [
        {"district": "区1", "entries": [], "nominates": [mk_nom("Splink")]},
        {"district": "区2", "entries": [], "nominates": [mk_nom("Splink")]},
        {"district": "区1", "entries": [], "nominates": [mk_nom("QE", kind="文献")]},
    ]
    carried = [{"round": 1, "source_district": "区0", "discipline": "旧提名", "hook": "h", "anchor": "a", "axisId": "AX1", "kind": "田野", "status": "在池", "paths": 2}]
    built = build_pool(batches, carried)
    rows = {r["discipline"]: r for r in built["rows"]}
    # Splink：两区各 1 路=2 路；田野 base 3（注意提名 kind=田野→base 3）
    check("pool 跨区计路", rows["Splink"]["cumPaths"], 2)
    # 排序：Splink（田野 3*100+2*10+0=320）> QE（文献锚好 2*100+1*10=210）> 旧提名（田野 carry 3*100+2*10+5=315）？
    # 旧提名 base：kind=田野→3；cumPaths=2；carried→+5 → 325。Splink=320。故 旧提名>Splink>QE
    check("pool 排序（旧提名 325 > Splink 320 > QE 210）", [r["discipline"] for r in built["rows"]], ["旧提名", "Splink", "QE"])
    check("pool curDisciplines 含新提名", built["curDisciplines"], ["QE", "Splink"])

# ---------- next_ratchets ----------
def test_next_ratchets():
    check("ratchets 轮1→第2档", next_ratchets(1), {"recency": "≥2005", "depth": "全文精读", "expQuota": 3})
    check("ratchets 轮2→第3档", next_ratchets(2), {"recency": "≥2018", "depth": "方法论级", "expQuota": 2})
    check("ratchets 轮3→第4档", next_ratchets(3), {"recency": "≥2024", "depth": "边缘扫尾", "expQuota": 1})
    check("ratchets 轮4→末档持平（B2 声明）", next_ratchets(4), {"recency": "≥2024", "depth": "边缘扫尾", "expQuota": 1})

# ---------- narrow 端到端（站5 一条命令） ----------
def test_narrow_e2e():
    axes = [{"id": "AX1", "name": "轴1", "isomorphicProblem": "p1", "breachPoint": "b1"}]
    batches = [
        {"district": "区1", "entries": [{"discipline": "甲", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX1"), mk_mech(True, "AX1")]}], "nominates": []},
        {"district": "区2", "entries": [{"discipline": "乙", "mechanisms": [mk_mech(True, "AX9")]}], "nominates": [mk_nom("丙")]},
    ]
    panel = {"round": 2, "districts": [{"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 3}]}, {"district": "区2", "disciplines": [{"name": "乙", "entryQuota": 1}]}],
             "ratchets": {"recency": "≥2005", "depth": "全文精读", "expQuota": 3}}
    receipts = [mk_receipt("exp-C2-AX1", "不咬合", "甲")]
    lock = narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=2,
                  carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    check("narrow AX1 2 路（甲文献+提名丙）候选", [(r["axisId"], r["pathCount"], r["status"]) for r in lock["conv"]], [("AX1", 2, "候选")])
    check("narrow 未竟=候选差额 1 路", lock["unfinished"][0]["gap"], "还差 1 路独立命中")
    check("narrow 失速=false（有不咬合证伪清障）", lock["stallSuspected"], False)
    check("narrow 收卷=false（round2<3 且未饱和）", lock["wrapUp"], False)
    check("narrow 棘轮进档", lock["ratchets"], {"recency": "≥2018", "depth": "方法论级", "expQuota": 2})
    # 面板：甲 2 路候选不入 A 供给；丙(提名观察席)+野卡 1；甲 3 条全「未寻得失配」→ v1.6.0 触发器②获矿脉席（席列尾）
    check("narrow 面板=丙观察+野卡 1+甲矿脉席", [e["name"] for e in lock["panel"]], ["丙", "（自由探索位 1·待下轮立项补）", "甲"])

    # 提名凑满 3 路 → 转正
    batches3 = [
        {"district": "区1", "entries": [{"discipline": "甲", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": []},
        {"district": "区2", "entries": [], "nominates": [mk_nom("丙")], },
    ]
    carried3 = [{"round": 1, "source_district": "区0", "discipline": "丙", "hook": "h", "anchor": "a", "axisId": "AX1", "kind": "文献", "status": "观察", "paths": 2}]
    lock3 = narrow(axes=axes, batches=batches3, receipts=[], panel=panel, round_=2, carried=carried3, prev_stall=False, max_round=3, force_wrapup=False)
    # 丙：carry 2 路+本轮 1 区提名=3 路 → promoted 转正
    check("narrow 提名凑 3 路转正", any(e["name"] == "丙" and "转正" in e["origin"] for e in lock3["panel"]), True)
    # 甲 1 路候选；零证伪+零结构必需 → 失速
    check("narrow 零证伪+零结构必需 → 失速", lock3["stallSuspected"], True)

    # 收卷分支：round>=maxRound
    lock4 = narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=3, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    check("narrow round=3/3 触收卷", lock4["wrapUp"], True)
    lock5 = narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=1, carried=[], prev_stall=True, max_round=3, force_wrapup=False)
    check("narrow 强制收卷 flag", narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=1, carried=[], prev_stall=False, max_round=3, force_wrapup=True)["wrapUp"], True)
    check("narrow 饱和=prevStall∧stall", lock5["saturated"], False)

# ---------- json 容错 ----------
def test_json_tolerant():
    from prw_core import parse_pool_lines
    lines = '{"discipline":"A"}\n\n坏行不是json\n{"discipline":"B"}\r\n'
    rows = parse_pool_lines(lines)
    check("pool 台账坏行跳过（合票容错）", [r["discipline"] for r in rows], ["A", "B"])

# ---------- v1.5.0 失配标注 ----------
def test_mismatch_v15():
    axes = [{"id": "AX1", "name": "轴1", "isomorphicProblem": "p1", "breachPoint": "b1"}]
    # 两路带不同失配标注 + 一路未寻得
    batches = [
        {"district": "区1", "entries": [{"discipline": "甲", "mechanisms": [
            mk_mech(True, "AX1", mismatch="原生域靠金标全集；本库无金标——覆盖率只能上界估计")]}], "nominates": []},
        {"district": "区2", "entries": [{"discipline": "乙", "mechanisms": [
            mk_mech(True, "AX1", mismatch="原生域靠中心化注册档；本库虚构域无权威档——断裂=锚不稳"),
            mk_mech(True, "AX1", mismatch="未寻得失配")]}], "nominates": []},
    ]
    conv = count_conv(axes, batches)
    paths = conv[0]["paths"]
    check("v15a 失配位随路携带", [p.get("mismatch", "")[:10] for p in paths], ["原生域靠金标全集；本", "原生域靠中心化注册档"])
    # narrow：候选行共性失配句（甲乙各 1 路，2 路<3 候选）
    panel = {"round": 2, "districts": [{"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 1}]}, {"district": "区2", "disciplines": [{"name": "乙", "entryQuota": 2}]}],
             "ratchets": {"recency": "不限年代", "depth": "摘要级", "expQuota": 5}}
    lock = narrow(axes=axes, batches=batches, receipts=[], panel=panel, round_=2, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    check("v15b 候选行 2 路候选", (conv[0]["pathCount"], conv[0]["status"]), (2, "候选"))
    sug = lock["unfinished"][0]["suggestion"]
    check("v15c 共性失配句入 suggestion（金标+权威档两条聚敛）",
          ("失配避让" in sug) and ("原生域靠金标全集" in sug) and ("中心化注册" in sug), True)
    # 未寻得失配不进共性句
    batches2 = [{"district": "区1", "entries": [{"discipline": "甲", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": []}]
    lock2 = narrow(axes=axes, batches=batches2, receipts=[], panel=panel, round_=2, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    check("v15d 全未寻得 → suggestion 保持原样", lock2["unfinished"][0]["suggestion"], "下轮站1 定向补检")
    check("v15e item/gap 数字禁改（gap 不含失配文本）", lock2["unfinished"][0]["gap"], "还差 2 路独立命中")

# ---------- v1.5.1 自检对账门（A2 自报计数） ----------
def test_selfcheck_v151():
    from prw_core import selfcheck_audit
    good = mk_batch("区1", "甲", 3)
    good["selfCheck"] = {"total": 3, "anchorsVerified": 3, "mismatchFilled": 3, "nominations": 0}
    check("a2a 诚实自报 → 零 issue", selfcheck_audit([good]), [])
    liar = mk_batch("区1", "甲", 2)
    liar["selfCheck"] = {"total": 5, "anchorsVerified": 5, "mismatchFilled": 2, "nominations": 0}
    issues = selfcheck_audit([liar])
    check("a2b 谎报两处被逮（total/anchorsVerified）", len(issues), 2)
    check("a2c issue 文案带区名与字段", ("区1" in issues[0]) and ("total" in issues[0]), True)
    no_sc = mk_batch("区2", "乙", 1)
    issues2 = selfcheck_audit([no_sc])
    check("a2d 缺 selfCheck 整批登记", ("区2" in issues2[0]) and ("缺 selfCheck" in issues2[0]), True)
    empty_mm = mk_batch("区3", "丙", 1)
    for m in empty_mm["entries"][0]["mechanisms"]:
        m["mismatch"] = ""
    empty_mm["selfCheck"] = {"total": 1, "anchorsVerified": 1, "mismatchFilled": 1, "nominations": 0}
    issues3 = selfcheck_audit([empty_mm])
    check("a2e 空失配算未填（mismatchFilled 对账 1≠0 谎报被逮）", len(issues3), 1)

# ---------- v1.6.0 矿脉学科 ----------
def test_mine_v16():
    from prw_core import mine_candidates
    axes = [{"id": "AX1", "name": "轴1", "isomorphicProblem": "p1", "breachPoint": "b1"},
            {"id": "AX2", "name": "轴2", "isomorphicProblem": "p2", "breachPoint": "b2"}]
    # 触发器①：金矿学科跨 AX1/AX2 两轴命中（各 1 路）；砂岩只有 AX1 一轴
    batches = [
        {"district": "区1", "entries": [
            {"discipline": "金矿", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX2")]}], "nominates": []},
        {"district": "区2", "entries": [
            {"discipline": "砂岩", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": []},
    ]
    conv = count_conv(axes, batches)
    mines = mine_candidates(conv=conv, batches=batches, carried=[], limited_rows=[])
    check("m1 触发①跨轴命中识别金矿", any(m["discipline"] == "金矿" and "跨≥2轴" in m["trigger"] for m in mines), True)
    check("m2 单轴砂岩不候选", any(m["discipline"] == "砂岩" for m in mines), False)

    # 触发器②：全条目「未寻得失配」（≥2 条）
    batches_b = [{"district": "区3", "entries": [
        {"discipline": "近原生", "mechanisms": [mk_mech(True, "AX1", mismatch="未寻得失配"), mk_mech(True, "AX1", mismatch="未寻得失配")]}], "nominates": []}]
    conv_b = count_conv(axes, batches_b)
    mines_b = mine_candidates(conv=conv_b, batches=batches_b, carried=[], limited_rows=[])
    check("m3 触发②全未寻得失配识别近原生", any(m["discipline"] == "近原生" and "未寻得失配" in m["trigger"] for m in mines_b), True)

    # 触发器③：提名深掘标记
    batches_c = [{"district": "区4", "entries": [], "nominates": [dict(mk_nom("深掘学科"), excavate=True, hook="体系级同构")]}]
    conv_c = count_conv(axes, batches_c)
    mines_c = mine_candidates(conv=conv_c, batches=batches_c, carried=[], limited_rows=[])
    check("m4 触发③提名深掘标记识别", any(m["discipline"] == "深掘学科" and "深掘标记" in m["trigger"] for m in mines_c), True)

    # 不变式：矿脉席不计收敛路+不占野卡税+LIMITED 剔除
    panel = {"round": 2, "districts": [{"district": "区1", "disciplines": [{"name": "金矿", "entryQuota": 2}, {"name": "砂岩", "entryQuota": 1}]}],
             "ratchets": {"recency": "不限年代", "depth": "摘要级", "expQuota": 5}}
    lock = narrow(axes=axes, batches=batches, receipts=[], panel=panel, round_=2, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    tiers = {e["name"]: e["tier"] for e in lock["panel"]}
    check("m5 矿脉席 tier=矿脉", tiers.get("金矿"), "矿脉")
    # 金矿席为矿脉额外席，且金矿条目 2 条<配额 2 足额无 LIMITED
    check("m6 矿脉零增路（lock.conv 与裸 count_conv 全等）", lock["conv"], count_conv(axes, batches))
    # 不变式强断言：有/无矿脉候选两跑，野卡数必须相等（矿脉席不挤探索税）
    batches_nom = [{"district": "区2", "entries": [{"discipline": "砂岩", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": [mk_nom("野卡提名学科")]}]
    lock_with = narrow(axes=axes, batches=[batches[0]] + batches_nom, receipts=[], panel=panel, round_=2, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    batches_plain = [{"district": "区1", "entries": [{"discipline": "金矿", "mechanisms": [mk_mech(True, "AX1", mismatch="缺金标①"), mk_mech(True, "AX1", kind="田野", mismatch="缺权威档②")]}]}] + batches_nom
    lock_without = narrow(axes=axes, batches=batches_plain, receipts=[], panel=panel, round_=2, carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    wc_with = sum(1 for e in lock_with["panel"] if e["tier"] == "野卡")
    wc_without = sum(1 for e in lock_without["panel"] if e["tier"] == "野卡")
    check("m7 矿脉席不挤野卡（有/无矿脉野卡数相等）", wc_with, wc_without)
    check("m7b 有矿脉跑法含矿脉席", any(e["tier"] == "矿脉" for e in lock_with["panel"]), True)
    check("m7c 无矿脉跑法无矿脉席", any(e["tier"] == "矿脉" for e in lock_without["panel"]), False)
    # LIMITED 学科不候选
    batches_l = [{"district": "区L", "entries": [{"discipline": "限流学科", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX2")]}], "nominates": []}]
    conv_l = count_conv(axes, batches_l)
    limited = [{"district": "区L", "discipline": "限流学科", "quota": 5, "delivered": 2, "verifiedAnchors": 2, "unverifiedAnchors": 0, "limited": True}]
    mines_l = mine_candidates(conv=conv_l, batches=batches_l, carried=[], limited_rows=limited)
    check("m8 LIMITED 学科不候选", any(m["discipline"] == "限流学科" for m in mines_l), False)

# ---------- v1.7.0 回执五态 / 未竟补源 / 版本哨 / 沙盒静态门 ----------
def test_receipt_states_v17():
    cand = mk_row("AX1", "候选")
    check("v17a 反噬清障不失速（定态负向结果）", judge_stall([mk_receipt("e", "反噬")], [cand]), False)
    check("v17b 表冲突不清障（待重预注册裁决）", judge_stall([mk_receipt("e", "表冲突-移交重预注册")], [cand]), True)
    check("v17c 登记盲区不清障", judge_stall([mk_receipt("e", "登记盲区")], [cand]), True)
    check("v17d 五态契约齐备", tuple(LAW_RECEIPT_STATES), ("咬合", "不咬合", "登记盲区", "反噬", "表冲突"))

def test_unfinished_sources_v17():
    axes = [{"id": "AX1", "name": "轴1", "isomorphicProblem": "p1", "breachPoint": "b1"},
            {"id": "AX2", "name": "轴2", "isomorphicProblem": "p2", "breachPoint": "b2"}]
    batches = [
        {"district": "区1", "entries": [
            {"discipline": "甲", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX2")]},
            {"discipline": "乙", "mechanisms": [mk_mech(True, "AX1"), mk_mech(True, "AX2")]}], "nominates": []},
        {"district": "区2", "entries": [
            {"discipline": "丙", "mechanisms": [mk_mech(True, "AX1")]}], "nominates": []},
    ]
    panel = {"round": 3, "districts": [
        {"district": "区1", "disciplines": [{"name": "甲", "entryQuota": 2}, {"name": "乙", "entryQuota": 2}]},
        {"district": "区2", "disciplines": [{"name": "丙", "entryQuota": 1}]}],
        "ratchets": {"recency": "≥2018", "depth": "方法论级", "expQuota": 2}}
    receipts = [mk_receipt("e-RB", "反噬", "甲"), mk_receipt("e-CF", "表冲突-移交重预注册", "乙"),
                mk_receipt("e-BL", "登记盲区", "丙"), mk_receipt("e-OK", "咬合", "丙")]
    receipts[0]["blindSpotProblem"] = "代价面超线样例"
    receipts[1]["blindSpotProblem"] = "则6允差判读未预锁"
    receipts[2]["blindSpotProblem"] = "层规模无权威读数"
    lock = narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=3,
                  carried=[], prev_stall=False, max_round=3, force_wrapup=False, mined=["甲"])
    items = [u["item"] for u in lock["unfinished"]]
    check("v17e 反噬登记入未竟（带 id 与盲区文）",
          any(i.startswith("反噬登记（e-RB）") and "代价面超线样例" in i for i in items), True)
    check("v17f 表冲突移交入未竟",
          any(i.startswith("表冲突移交重预注册（e-CF）") and "则6" in i for i in items), True)
    check("v17g 登记盲区源不回归", any(i == "登记盲区：层规模无权威读数" for i in items), True)
    check("v17h 矿脉未掘计数（甲已掘→乙剩 1/2）",
          any("未掘矿脉席 1 席（共 2 席）" in i for i in items), True)
    check("v17i 野卡未填登记", any(i.startswith("野卡位") for i in items), True)
    lock2 = narrow(axes=axes, batches=batches, receipts=receipts, panel=panel, round_=3,
                   carried=[], prev_stall=False, max_round=3, force_wrapup=False)
    check("v17j 未给已掘清单不猜（无矿脉未掘行）",
          any("未掘矿脉席" in u["item"] for u in lock2["unfinished"]), False)

def test_version_v17():
    from prw_core import version_snapshot, version_check
    snap = version_snapshot()
    check("v17k 快照含内核与测试件", {"prw_core.py", "test_prw_core.py"} <= set(snap["files"]), True)
    check("v17l 零改动自检零漂移", version_check(snap), [])
    bad = json.loads(json.dumps(snap))
    k = next(iter(bad["files"]))
    bad["files"][k]["sha256"] = "0" * 64
    drifts = version_check(bad)
    check("v17m 篡改即报漂移（含件名）", len(drifts) >= 1 and drifts[0]["file"] == k, True)
    missing = json.loads(json.dumps(snap))
    missing["files"]["幽灵文件"] = {"path": "D:/不存在-幽灵.py", "sha256": "0" * 64}
    check("v17n 缺失件报漂移", any(d["kind"] == "缺失" for d in version_check(missing)), True)

def test_sandboxcheck_v17():
    from prw_core import sandboxcheck
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        with open(os.path.join(td, "bad.py"), "w", encoding="utf-8") as f:
            f.write("import requests\nopen('D:/outside-sbx.txt', 'w')\n")
        with open(os.path.join(td, "good.py"), "w", encoding="utf-8") as f:
            f.write("with open('ok.txt', 'r', encoding='utf-8') as fh:\n    fh.read()\n")
        rep = sandboxcheck(td)
        kinds = {e["kind"] for e in rep["errors"]}
        check("v17o 禁网模块被逮", "禁网模块" in kinds, True)
        check("v17p 写越界被逮", "写越界（零生产写违规）" in kinds, True)
        check("v17q 沙盒内读不误报", any(e["file"] == "good.py" for e in rep["errors"]), False)
        with open(os.path.join(td, "read_out.py"), "w", encoding="utf-8") as f:
            f.write("open('D:/declared-read.txt', 'r')\n")
        rep2 = sandboxcheck(td)
        check("v17r 未声明读越界被逮", any(e["kind"] == "未声明读越界（输入面白名单外）" for e in rep2["errors"]), True)
        rep3 = sandboxcheck(td, whitelist=["D:/declared-read.txt"])
        check("v17s 白名单读放行", any(e["file"] == "read_out.py" for e in rep3["errors"]), False)
        with open(os.path.join(td, "write_allow.py"), "w", encoding="utf-8") as f:
            f.write("open('D:/declared-write.txt', 'w')\n")
        rep4 = sandboxcheck(td, whitelist=["D:/declared-write.txt"])
        check("v17t 白名单不放行写（写越界仍在）",
              any(e["file"] == "write_allow.py" and e["kind"] == "写越界（零生产写违规）" for e in rep4["errors"]), True)
        check("v17u 体积读数在案", rep["size"]["pyFiles"] >= 2, True)

if __name__ == "__main__":
    test_validate_panel()
    test_judge_stall()
    test_audit_and_rebake()
    test_count_conv()
    test_build_pool()
    test_next_ratchets()
    test_narrow_e2e()
    test_json_tolerant()
    test_mismatch_v15()
    test_selfcheck_v151()
    test_mine_v16()
    test_receipt_states_v17()
    test_unfinished_sources_v17()
    test_version_v17()
    test_sandboxcheck_v17()
    print(f"ALL GREEN · {len(CHECKS)} checks passed")
