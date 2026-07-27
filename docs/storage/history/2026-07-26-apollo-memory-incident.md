# Apollo Memory Incident

- Status: historical evidence, not current health
- Evidence recorded: 2026-07-26
- Exact incident onset: not recorded in the retained lifecycle evidence
- Provenance: repository commit `de647ca`

## Event

The lifecycle record attributed an Apollo failure to physical memory and swap exhaustion after a Pantheon Ceph OSD grew well beyond its configured memory target. K3s could no longer terminate workloads, and a Ceph monitor left quorum. An earlier investigation summary recorded approximately 18 GiB of OSD memory on Apollo and approximately 80 GiB on another storage node.

A separate control-daemon placement record reported that all Ceph monitors had landed on Apollo and storage became unavailable when Apollo failed. That finding motivated the monitor and manager separation contract; it does not describe current placement.

## Recovery

Operators guarded recovery with active-and-clean placement-group checks, Ceph `noout`, and `ceph osd ok-to-stop`. OSD2 was restarted first and its recorded use fell from 18.5 GiB to 2.3 GiB. After full recovery, OSD0 was restarted and fell from 26.3 GiB to 2.35 GiB. OSD3 on Apollo was not restarted and was recorded at 13.9 GiB.

The earlier approximate 80 GiB observation and the later 26.3 GiB pre-restart measurement came from different points in the lifecycle record; that record did not reconcile the difference.

## Point-In-Time Outcome

The completed recovery record reported all three OSDs up and in, all 106 placement groups active and clean, no `noout` flag, and Ceph `HEALTH_OK`. The later configuration rollout recorded an 8 GiB request, 16 GiB limit, and 8 GiB target for each OSD at that time.

These measurements and health results are historical. Use [`../verification.md`](../verification.md) for the evidence needed to establish current state.
