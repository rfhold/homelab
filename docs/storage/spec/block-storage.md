# Ceph Block Storage

## Pantheon Database Storage

- Pantheon MUST provide a `database` StorageClass backed by a Ceph RBD pool for latency-sensitive stateful workloads.
- The pool MUST use three replicas across the `host` failure domain and the `nvme` device class.
- The StorageClass MUST use RBD image format 2 with the `layering` feature and an `ext4` filesystem.
- The StorageClass MUST allow expansion, use `WaitForFirstConsumer` binding, and use the `Delete` reclaim policy.
- Kafka broker and KRaft metadata logs MUST use `database`; shared CephFS MUST NOT be the steady-state Kafka storage class.

## Migration Boundary

An existing persistent volume's StorageClass MUST NOT be treated as mutable. Moving a workload from CephFS to `database` requires an explicitly approved controlled recreation or an independently approved online migration procedure.

The controlled recreation MAY discard Kafka-buffered telemetry because Mimir and Tempo object storage remains the durable backend. Existing CephFS claims MUST remain retained until the RBD-backed cluster and telemetry paths are verified, and their deletion requires separate approval.
