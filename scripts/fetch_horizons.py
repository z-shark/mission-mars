import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
START = "2026-11-01"
STOP = "2035-12-31"
STEP = "2 d"
C_KM_S = 299792.458
SEP_THRESHOLDS_DEG = {"ka_band": 1.0, "analysis_default": 2.0, "x_band": 2.3, "mro_moratorium": 3.0, "s_band": 4.0}
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "earth_mars_range.json"
BODIES = {"earth": "399", "mars": "499"}


def build_query(command: str) -> str:
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTORS'",
        "CENTER": "'500@10'",
        "REF_PLANE": "'ECLIPTIC'",
        "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'",
        "VEC_TABLE": "'1'",
        "CSV_FORMAT": "'YES'",
        "OUT_UNITS": "'KM-S'",
    }
    return f"{API_URL}?{urllib.parse.urlencode(params)}"


def fetch_vectors(command: str) -> list[tuple[str, float, float, float]]:
    with urllib.request.urlopen(build_query(command), timeout=60) as response:
        payload = json.load(response)
    text = payload["result"]
    start = text.index("$$SOE") + len("$$SOE")
    end = text.index("$$EOE")
    rows = []
    for line in text[start:end].strip().splitlines():
        fields = [field.strip() for field in line.split(",")]
        stamp = datetime.strptime(fields[1].replace("A.D. ", ""), "%Y-%b-%d %H:%M:%S.%f")
        rows.append((stamp.date().isoformat(), float(fields[2]), float(fields[3]), float(fields[4])))
    return rows


def angle_between(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return math.degrees(math.acos(max(-1.0, min(1.0, dot / norm))))


def wrap_degrees(value: float) -> float:
    return (value + 180.0) % 360.0 - 180.0


def build_samples(earth: list, mars: list) -> list[dict]:
    samples = []
    for (day, ex, ey, ez), (day_m, mx, my, mz) in zip(earth, mars, strict=True):
        if day != day_m:
            raise ValueError(f"date mismatch {day} {day_m}")
        to_mars = (mx - ex, my - ey, mz - ez)
        to_sun = (-ex, -ey, -ez)
        range_km = math.sqrt(sum(v * v for v in to_mars))
        phase = wrap_degrees(math.degrees(math.atan2(my, mx)) - math.degrees(math.atan2(ey, ex)))
        samples.append(
            {
                "date": day,
                "range_km": round(range_km, 1),
                "one_way_delay_min": round(range_km / C_KM_S / 60.0, 3),
                "sun_earth_mars_deg": round(angle_between(to_sun, to_mars), 3),
                "mars_lead_deg": round(phase, 3),
                "earth_lon_deg": round(math.degrees(math.atan2(ey, ex)) % 360.0, 3),
                "mars_lon_deg": round(math.degrees(math.atan2(my, mx)) % 360.0, 3),
                "earth_sun_km": round(math.sqrt(ex * ex + ey * ey + ez * ez), 1),
                "mars_sun_km": round(math.sqrt(mx * mx + my * my + mz * mz), 1),
            }
        )
    return samples


def find_blackouts(samples: list[dict], threshold_deg: float) -> list[dict]:
    intervals = []
    current = None
    for sample in samples:
        if sample["sun_earth_mars_deg"] < threshold_deg:
            if current is None:
                current = {"start": sample["date"], "end": sample["date"]}
            else:
                current["end"] = sample["date"]
        elif current is not None:
            intervals.append(current)
            current = None
    if current is not None:
        intervals.append(current)
    for interval in intervals:
        interval["days"] = (date.fromisoformat(interval["end"]) - date.fromisoformat(interval["start"])).days + 1
    return intervals


def main() -> int:
    earth = fetch_vectors(BODIES["earth"])
    mars = fetch_vectors(BODIES["mars"])
    samples = build_samples(earth, mars)
    document = {
        "source": "NASA JPL Horizons System API",
        "api": API_URL,
        "bodies": BODIES,
        "center": "Sun (500@10)",
        "reference_plane": "ECLIPTIC",
        "start": START,
        "stop": STOP,
        "step": STEP,
        "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "blackout_thresholds_deg": SEP_THRESHOLDS_DEG,
        "blackouts": {name: find_blackouts(samples, value) for name, value in SEP_THRESHOLDS_DEG.items()},
        "samples": samples,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=1), encoding="utf-8")
    summary = {name: [item["days"] for item in items] for name, items in document["blackouts"].items()}
    print(f"wrote {len(samples)} samples to {OUTPUT}")
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
