# Cluster Memory Alerting Delta

## Change Overview

See `../storage/spec.md` for the change overview. This delta adds warning coverage for the memory conditions that preceded the Pantheon node failure.

## ADDED Requirements

### Requirement: Ceph OSD Memory Growth Alert
The observability platform MUST issue a warning through existing Grafana notification routing when any monitored Pantheon Ceph OSD uses more than 12 GiB of memory for 10 minutes.

#### Scenario: OSD memory remains above the warning threshold
Given a Pantheon Ceph OSD has used more than 12 GiB of memory for 10 minutes
When Grafana evaluates the OSD memory alert
Then the system MUST produce a warning identifying the affected OSD and node

#### Scenario: OSD memory spike is brief
Given a Pantheon Ceph OSD uses more than 12 GiB of memory for less than 10 minutes
When its memory use returns below 12 GiB
Then the system MUST NOT fire the sustained OSD memory warning

### Requirement: Cluster Node Memory Exhaustion Alerts
The observability platform MUST issue warnings through existing Grafana notification routing for sustained node memory or swap utilization and for any detected OOM kill.

#### Scenario: Node memory utilization is sustained
Given a monitored cluster node has used more than 85 percent of physical memory for 10 minutes
When Grafana evaluates the node memory alert
Then the system MUST produce a warning identifying the affected node

#### Scenario: Node swap utilization is sustained
Given a monitored cluster node has used more than 50 percent of available swap for 10 minutes
When Grafana evaluates the node swap alert
Then the system MUST produce a warning identifying the affected node

#### Scenario: OOM kill occurs
Given a monitored cluster node reports an OOM kill within a five-minute evaluation window
When Grafana evaluates the OOM alert
Then the system MUST produce a warning identifying the affected node

#### Scenario: Resource utilization spike is brief
Given a monitored cluster node crosses a memory or swap utilization threshold for less than 10 minutes
When its utilization returns below the threshold
Then the system MUST NOT fire the corresponding sustained utilization warning
