#!/usr/bin/env python3
"""Validate commerce specification structure and independent synthetic oracles.

Standard library only; no network, credentials, provider APIs or production data.
Passing this checker does not certify the TypeScript runtime or live integrations.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction
from pathlib import Path
from urllib.parse import unquote, urlsplit

getcontext().prec = 50
ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "docs" / "specs"
ID_RE = re.compile(r"\*\*(C\d{2}-[RA]\d{2}):\*\*")
LINK_RE = re.compile(r"(?<!!)\[[^\]\n]*\]\(([^)\n]+)\)")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def dec(value: str) -> Decimal:
    require(isinstance(value, str), f"Exact amount must be a string, not {type(value).__name__}")
    result = Decimal(value)
    require(result.is_finite(), "Non-finite exact amount")
    return result


def text(value: Decimal | None) -> str | None:
    if value is None:
        return None
    result = format(value, "f")
    return result.rstrip("0").rstrip(".") if "." in result else result


def instant(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None, "Source instant needs an explicit timezone")
    return result


def evaluate(case: dict) -> dict:
    """Independent reference math, deliberately not an application implementation."""
    kind, data = case["kind"], case["input"]
    if kind == "margin":
        net = dec(data["merchandise"]) - dec(data["seller_discount"]) - dec(data["merchandise_reversal"])
        gross = None if data["cogs"] is None else net - dec(data["cogs"])
        pre = None if gross is None or data["variable_fees"] is None else gross - dec(data["variable_fees"])
        post = None if pre is None or data["ads"] is None else pre - dec(data["ads"])
        return {"net_sales": text(net), "gross_profit": text(gross), "contribution_pre_ads": text(pre), "contribution_post_ads": text(post)}
    if kind == "settlement":
        payout = sum((dec(v) for v in data["components"]), Decimal(0))
        received = sum((dec(v) for v in data["receipts"]), Decimal(0))
        return {"expected_payout": text(payout), "matched_receipts": text(received), "gap": text(payout - received), "recorded_recovery": "0"}
    if kind == "allocation":
        amount = dec(data["minor_units"])
        require(amount >= 0 and amount == amount.to_integral_value(), "Allocation expects nonnegative integer minor units")
        lines = data["lines"]
        ids = [line["id"] for line in lines]
        require(len(ids) == len(set(ids)) and len(ids) > 0, "Unique nonempty allocation line identities required")
        weights = {line["id"]: Fraction(dec(line["weight"])) for line in lines}
        require(all(w >= 0 for w in weights.values()) and sum(weights.values()) > 0, "Allocation weight total must be positive")
        shares = {key: Fraction(int(amount)) * weight / sum(weights.values()) for key, weight in weights.items()}
        allocated = {key: share.numerator // share.denominator for key, share in shares.items()}
        remainder = int(amount) - sum(allocated.values())
        order = sorted(ids, key=lambda key: (-(shares[key] - allocated[key]), key))
        for key in order[:remainder]:
            allocated[key] += 1
        require(sum(allocated.values()) == int(amount), "Allocation failed conservation")
        return {key: str(value) for key, value in allocated.items()}
    if kind == "partial_refund":
        units, returned = dec(data["original_units"]), dec(data["returned_units"])
        require(units > 0 and 0 <= returned <= units, "Invalid return quantity")
        refund = (dec(data["original_merchandise"]) - dec(data["original_discount"])) * returned / units
        return {"merchandise_refund": text(refund)}
    if kind == "ratio":
        require(len(data["numerators"]) == len(data["denominators"]), "Incompatible ratio grains")
        num = sum((dec(v) for v in data["numerators"]), Decimal(0))
        den = sum((dec(v) for v in data["denominators"]), Decimal(0))
        ratio = None if den == 0 else format((num / den).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP), "f")
        return {"numerator": text(num), "denominator": text(den), "ratio_6dp": ratio}
    if kind == "canonical_orders":
        # Mapping has already been explicitly supplied; no fuzzy matching here.
        orders = {}
        for row in data["observations"]:
            key, amount = row["canonical_id"], dec(row["amount"])
            require(isinstance(key, str) and key != "", "Canonical identity required")
            require(key not in orders or orders[key] == amount, "Conflicting source amount requires authority resolution")
            orders[key] = amount
        return {"canonical_count": len(orders), "amount": text(sum(orders.values(), Decimal(0)))}
    if kind == "inventory":
        cutoff, latest = instant(data["as_of"]), {}
        for row in data["observations"]:
            observed = instant(row["observed_at"])
            if observed > cutoff:
                continue
            key, qty = (row["pool"], row["sku"]), dec(row["quantity"])
            previous = latest.get(key)
            if previous is not None and observed == previous[0]:
                require(previous[1] == qty, "Conflicting stock at same instant requires authority resolution")
            if previous is None or observed > previous[0]:
                latest[key] = (observed, qty)
        return {"available_units": text(sum((v[1] for v in latest.values()), Decimal(0)))}
    if kind == "cost_center":
        cash = dec(data["cash_expense_removed"]) - dec(data["runtime_cost"]) - dec(data["support_cost"])
        payback = None if cash <= 0 else dec(data["implementation_cost"]) / cash
        return {"released_hours": text(dec(data["released_hours"])), "net_cash_savings": text(cash), "cash_payback_months": text(payback)}
    if kind == "business_window":
        offset = timezone(timedelta(minutes=data["offset_minutes"]))
        start = datetime.fromisoformat(data["start"]).replace(tzinfo=offset)
        end = datetime.fromisoformat(data["end"]).replace(tzinfo=offset)
        require(start < end, "Invalid half-open business window")
        return {"included": [start <= instant(v) < end for v in data["instants"]]}
    if kind == "identifier":
        value = data["source_id"]
        return {"source_id": value, "is_string": isinstance(value, str)}
    raise ValueError(f"Unknown reference fixture kind: {kind}")


def check_case(case: dict) -> None:
    actual = evaluate(case)
    require(actual == case["expected"], f"{case['id']}: expected {case['expected']}, got {actual}")


def check_graph(rows: list[dict]) -> None:
    by_id = {row["id"]: row for row in rows}
    require(len(by_id) == len(rows), "Duplicate spec ID in manifest")
    visiting, done = set(), set()

    def visit(key: str) -> None:
        require(key in by_id, f"Unknown dependency: {key}")
        require(key not in visiting, f"Dependency cycle at {key}")
        if key in done:
            return
        visiting.add(key)
        for dep in by_id[key]["depends_on"]:
            visit(dep)
        visiting.remove(key)
        done.add(key)

    for key in by_id:
        visit(key)


def definitions(source: str, owner: str) -> list[str]:
    ids = ID_RE.findall(source)
    require(ids and len(ids) == len(set(ids)), f"Missing or duplicate requirement/acceptance IDs in {owner}")
    require(all(value.startswith(owner + "-") for value in ids), f"Foreign owned definition in {owner}")
    require(any("-R" in value for value in ids), f"No contract requirements in {owner}")
    require(any("-A" in value for value in ids), f"No acceptance tests in {owner}")
    return ids


def strip_fences(source: str) -> str:
    return re.sub(r"```[\s\S]*?```", "", source)


def anchors(source: str) -> set[str]:
    result = set(re.findall(r'<a\s+(?:id|name)="([^"]+)"', source))
    for heading in re.findall(r"^#{1,6}\s+(.+)$", strip_fences(source), re.MULTILINE):
        slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        result.add(slug)
    return result


def check_links(path: Path) -> int:
    source, checked = strip_fences(path.read_text(encoding="utf-8")), 0
    require("\ue200cite" not in source and "\ue200filecite" not in source, f"Nonportable chat citation in {path}")
    for match in LINK_RE.finditer(source):
        link = match.group(1).split(' "', 1)[0]
        parts = urlsplit(link)
        if parts.scheme or parts.netloc:
            continue  # No external requests or claims of live link validation.
        target = (path.parent / unquote(parts.path)).resolve() if parts.path else path.resolve()
        require(target.is_relative_to(ROOT), f"Link escapes repository: {path} -> {link}")
        require(target.is_file(), f"Missing local target: {path} -> {link}")
        if parts.fragment and target.suffix == ".md":
            require(unquote(parts.fragment) in anchors(target.read_text(encoding="utf-8")), f"Missing anchor: {path} -> {link}")
        checked += 1
    return checked


def check_specs() -> tuple[list[dict], list[dict], int, int]:
    manifest = read_json(SPECS / "manifest.json")
    require(manifest["schema_version"] == 1, "Unsupported spec manifest version")
    rows = manifest["specs"]
    require({row["id"] for row in rows} == {f"C{i:02}" for i in range(28)}, "Expected C00 through C27")
    check_graph(rows)
    catalog = (SPECS / "README.md").read_text(encoding="utf-8")
    all_ids, paths = set(), set()
    for row in rows:
        require(row["start"] in {"P0", "P1", "P2", "P3"}, f"Invalid stage: {row['id']}")
        path = (SPECS / row["path"]).resolve()
        require(path.is_relative_to(SPECS) and path.is_file(), f"Missing/invalid spec path: {path}")
        require(path not in paths, f"Duplicate owned spec path: {path}")
        paths.add(path)
        require(row["path"] in catalog, f"Spec absent from index: {row['id']}")
        source = path.read_text(encoding="utf-8")
        require(source.startswith(f"# {row['id']} "), f"Wrong header: {path}")
        require("Status: Target" in source, f"Missing target-not-shipped label: {path}")
        ids = definitions(source, row["id"])
        require(not all_ids.intersection(ids), f"Duplicate global IDs: {path}")
        all_ids.update(ids)
    actual_paths = {p.resolve() for p in (SPECS / "commerce").glob("*.md")}
    require(paths == actual_paths, "Manifest and commerce file inventory differ")
    links = sum(check_links(path) for path in SPECS.rglob("*.md"))
    fixture_doc = read_json(SPECS / "fixtures" / "commerce-golden-cases.json")
    require(fixture_doc.get("synthetic") is True, "Fixtures must explicitly be synthetic")
    cases, seen = fixture_doc["cases"], set()
    for case in cases:
        require(case["id"] not in seen, f"Duplicate fixture: {case['id']}")
        seen.add(case["id"])
        require(case["acceptance"] and all(a in all_ids and "-A" in a for a in case["acceptance"]), f"Unresolved acceptance reference in {case['id']}")
        check_case(case)
    return rows, cases, len(all_ids), links


def expect_failure(fn, label: str) -> None:
    try:
        fn()
    except ValueError:
        return
    raise ValueError(f"Self-test failed to reject {label}")


def self_test(rows: list[dict], cases: list[dict]) -> int:
    count = 0
    for case in cases:
        bad = copy.deepcopy(case)
        key = next(iter(bad["expected"]))
        old = bad["expected"][key]
        if isinstance(old, list):
            old[0] = not old[0]
        elif isinstance(old, int):
            bad["expected"][key] = old + 1
        elif isinstance(old, str):
            bad["expected"][key] = text(dec(old) + 1)
        else:
            bad["expected"][key] = "unexpected"
        expect_failure(lambda item=bad: check_case(item), f"mutated expectation {case['id']}")
        count += 1
    cyclic = copy.deepcopy(rows)
    cyclic[0]["depends_on"] = ["C27"]
    expect_failure(lambda: check_graph(cyclic), "dependency cycle")
    expect_failure(lambda: check_graph(rows + [rows[0]]), "duplicate spec ID")
    expect_failure(lambda: definitions("**C00-R01:** x\n**C00-R01:** y\n**C00-A01:** z", "C00"), "duplicate contract ID")
    expect_failure(lambda: definitions("**C01-R01:** x\n**C00-A01:** y", "C00"), "foreign contract owner")
    expect_failure(lambda: json.loads('{"id":1,"id":2}', object_pairs_hook=unique_object), "duplicate JSON key")
    expect_failure(lambda: dec(0.1), "floating point amount")
    conflict = copy.deepcopy(next(case for case in cases if case["kind"] == "canonical_orders"))
    conflict["input"]["observations"][1]["amount"] = "999"
    expect_failure(lambda: evaluate(conflict), "unresolved source amount conflict")
    return count + 7


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="also prove malformed definitions/expectations are rejected")
    args = parser.parse_args()
    try:
        rows, cases, ids, links = check_specs()
        mutations = self_test(rows, cases) if args.self_test else 0
        print(f"PASS: {len(rows)} owned specs; {ids} requirement/acceptance IDs; {links} local links; {len(cases)} synthetic reference cases; {mutations} rejection self-tests.")
        print("Evidence level: specification/independent oracle only; no live API or commerce-runtime certification claimed.")
        return 0
    except (ValueError, KeyError, OSError, TypeError, ArithmeticError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
