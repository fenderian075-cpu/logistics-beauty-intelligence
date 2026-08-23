#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'economy' / 'logistics-foreign-workforce.json'
PIPELINE = ROOT / 'data' / 'economy' / 'logistics-foreign-capacity-pipeline.json'

def series(d, mid):
    return next(s for s in d['series'] if s['metric_id'] == mid)

def values(d, mid):
    return {o['period']: float(o['value']) for o in series(d, mid)['observations']}

d = json.loads(DATA.read_text(encoding='utf-8'))
p = json.loads(PIPELINE.read_text(encoding='utf-8'))
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
for period in periods:
    assert abs(share[period] - round(transport[period] / all_workers[period] * 100, 1)) <= 0.11
    assert abs(index[period] - round(transport[period] / transport['2023-10'] * 100, 1)) <= 0.11
assert transport['2025-10'] > transport['2023-10']

ssw_total = values(p, 'ssw_auto_transport_residents')
truck = values(p, 'ssw_auto_transport_truck_drivers')
taxi = values(p, 'ssw_auto_transport_taxi_drivers')
bus = values(p, 'ssw_auto_transport_bus_drivers')
auto_capacity = values(p, 'ssw_auto_transport_intake_capacity_to_2029_03')
warehouse_capacity = values(p, 'ssw_logistics_warehouse_intake_capacity_to_2029_03')
assert ssw_total == {'2025-06': 10.0, '2025-12': 151.0}
assert truck == {'2025-12': 123.0}
assert taxi == {'2025-12': 16.0}
assert bus == {'2025-12': 12.0}
assert truck['2025-12'] + taxi['2025-12'] + bus['2025-12'] == ssw_total['2025-12']
assert auto_capacity == {'2029-03': 22100.0}
assert warehouse_capacity == {'2029-03': 11400.0}
assert ssw_total['2025-12'] < auto_capacity['2029-03']

print(json.dumps({
    'status':'success',
    'transport_foreign_workers_2023': transport['2023-10'],
    'transport_foreign_workers_2025': transport['2025-10'],
    'index_2025': index['2025-10'],
    'ssw_auto_transport_2025_12': ssw_total['2025-12'],
    'ssw_truck_drivers_2025_12': truck['2025-12'],
    'auto_transport_policy_capacity': auto_capacity['2029-03'],
    'logistics_warehouse_policy_capacity': warehouse_capacity['2029-03'],
}, ensure_ascii=False, indent=2))
