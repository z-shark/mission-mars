import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "nasa_marshall_ssn_forecast_nov2026.txt"
OUTPUT = ROOT / "data" / "solar_activity.json"
SOURCE_URL = "https://www.nasa.gov/wp-content/uploads/2026/11/nov2026ssn-prd.txt"
LOW_BELOW = 30.0
HIGH_FROM = 70.0
ROW = re.compile(
    r"^\s*(\d{4})\.\d+\s+([A-Z]{3})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+[\d.]+\s*$"
)


def level(value: float) -> str:
    if value < LOW_BELOW:
        return "low"
    if value >= HIGH_FROM:
        return "high"
    return "medium"


def main() -> int:
    by_year: dict[int, list[tuple[float, float, float]]] = {}
    for line in RAW.read_text(encoding="utf-8").splitlines():
        match = ROW.match(line)
        if match is None:
            continue
        year = int(match.group(1))
        by_year.setdefault(year, []).append(
            (float(match.group(3)), float(match.group(4)), float(match.group(5)))
        )
    years = []
    for year in sorted(by_year):
        rows = by_year[year]
        median = mean(row[1] for row in rows)
        years.append(
            {
                "year": year,
                "months": len(rows),
                "ssn_p95": round(mean(row[0] for row in rows), 1),
                "ssn_median": round(median, 1),
                "ssn_p05": round(mean(row[2] for row in rows), 1),
                "level": level(median),
            }
        )
    document = {
        "source": "NASA Marshall Solar Cycle Forecast, 13-month smoothed sunspot number, issued November 2026",
        "source_url": SOURCE_URL,
        "raw_file": str(RAW.relative_to(ROOT)).replace("\\", "/"),
        "level_rule": {"low_below": LOW_BELOW, "high_from": HIGH_FROM, "basis": "game assumption applied to the median forecast"},
        "built_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "years": years,
    }
    OUTPUT.write_text(json.dumps(document, indent=1), encoding="utf-8")
    print(f"wrote {len(years)} years to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
