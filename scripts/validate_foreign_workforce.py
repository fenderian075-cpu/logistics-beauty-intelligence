#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'economy' / 'logistics-foreign-workforce.json'

def series(d, mid):
    return next(s for s in d['series'] if s['metric_id'] == mid)

def values(d, mid):
    return {o['period']: float(o['value']) for o in series(d, mid)['observations']}

d = json.loads(DATA.read_text(encoding='utf-8'))
all_workers = values(d, 'foreign_workers_all_industries')
transport = values(d, 'transport_postal_foreign_workers')
share = values(d, 'transport_postal_foreign_share_of_all_foreign')
index = values(d, 'transport_postal_foreign_worker_index_2023')
periods = ['2023-10', '2024-10', '2025-10']
assert list(all_workers) == periods
assert list(transport) == periods
assert list(share) == periods
assert list(index) == periods
assert all_workers == {'2023-10': 2048675.0, '2024-10': 2302587.0, '2025-10': 2571037.0}
assert transport == {'2023-10': 66581.0, '2024-10': 75157.0, '2025-10': 85477.0}
for p in periods:
    assert abs(share[p] - round(transport[p] / all_workers[p] * 100, 1)) <= 0.11
    assert abs(index[p] - round(transport[p] / transport['2023-10'] * 100, 1)) <= 0.11
assert transport['2025-10'] > transport['2023-10']
print(json.dumps({
    'status':'success',
    'transport_foreign_workers_2023': transport['2023-10'],
    'transport_foreign_workers_2025': transport['2025-10'],
    'index_2025': index['2025-10'],
}, ensure_ascii=False, indent=2))
