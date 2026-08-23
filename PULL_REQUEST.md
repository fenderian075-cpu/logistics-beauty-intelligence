# Pull Request Notes

This repository keeps implementation notes here for larger data/UI changes. See the active GitHub pull request for the authoritative review state.

## Demand × Capacity structural layer

The Economic Flow page now begins to connect logistics demand with labor supply rather than treating freight volume in isolation.

Current scope:
- MLIT parcel-delivery history as a last-mile / B2C-demand proxy
- Labour Force Survey transport/postal employment history
- latest male/female transport/postal snapshot and female share
- derived parcel-per-worker demand/capacity proxy and 2015=100 load index
- regression validation that recomputes derived indicators from source stores

Data semantics:
- parcel volume is not labelled as pure B2C because the official series includes some business deliveries
- annual employment and monthly sex snapshots are not mixed into a single time series
- no age-band interpolation or pseudo average age is permitted
- average age may only be shown when directly published by an official source
- the formal Labor Capacity Stress index is deferred until age structure, wages and job-openings data are all connected

Pinned official workforce tables:
- e-Stat Labour Force Survey 2-2-1: age × industry × sex, annual history from 2007
- e-Stat detailed 2-1-1: industry × employment type × age, annual history from 2007
- Labour Force Survey detailed source tables include road freight transport and warehousing for finer industry cuts

Next implementation targets:
1. age bands and 55+ / young-worker ratios
2. road-freight and warehousing employment, age and sex structure
3. transport/postal wage history
4. transport-driver job-openings ratio
5. composite Labor Capacity Stress after all component series pass coverage validation
