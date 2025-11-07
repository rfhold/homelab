# Ceph OSD Crash Identification and Diagnosis

## OSD Crash Identification

The primary method for identifying OSD crashes is through the Ceph crash module, which automatically collects and stores crash information:

```shell
# List all crash reports
ceph crash ls

# List only new (unarchived) crashes
ceph crash ls-new

# Get detailed information about a specific crash
ceph crash info <crashid>

# Show summary statistics
ceph crash stat
```

## OSD Status Monitoring

For OSD status monitoring, use these essential commands:

```shell
# Check overall cluster health
ceph health
ceph health detail

# Check OSD tree and status
ceph osd tree
ceph osd df

# Check specific OSD status
ceph osd status <osd-id>
```

## Common OSD Crash Causes

OSD crashes typically fall into these categories:

1. **Hardware Failures**: Drive failures, memory issues, controller problems
2. **Network Issues**: Connectivity problems, flapping OSDs due to network partition
3. **Filesystem/Storage Issues**: Full disks, corrupted filesystems, bad sectors
4. **Software Issues**: Bugs, configuration errors, resource exhaustion
5. **Resource Constraints**: Insufficient RAM, thread limits, connection tracking limits

## OSD Removal and Replacement Procedures

### Safe OSD Removal

```shell
# Mark OSD out to begin data migration
ceph osd out <osd-id>

# Wait for data to migrate, then verify it's safe to remove
while ! ceph osd safe-to-destroy osd.<id>; do sleep 10; done

# Remove the OSD from cluster
ceph osd purge <id> --yes-i-really-mean-it
```

### OSD Replacement

```shell
# Ensure safe to destroy
while ! ceph osd safe-to-destroy osd.<id>; do sleep 10; done

# Destroy the OSD (preserves ID for replacement)
ceph osd destroy <id> --yes-i-really-mean-it

# Prepare new disk
ceph-volume lvm zap /dev/sdX
ceph-volume lvm prepare --osd-id <id> --data /dev/sdX

# Activate the replacement OSD
ceph-volume lvm activate <id> <fsid>
```

## Flapping OSD Management

For OSDs that repeatedly go up and down, use these temporary stabilization commands:

```shell
# Prevent OSDs from changing state
ceph osd set noup      # prevent OSDs from getting marked up
ceph osd set nodown    # prevent OSDs from getting marked down

# Clear flags when stable
ceph osd unset noup
ceph osd unset nodown
```

## Device Health Monitoring

Ceph can monitor device health via SMART when enabled:

```shell
# Enable device monitoring
ceph device monitoring on

# Check device health status
ceph device ls
```

## Recommended Playbook Structure

### Phase 1: Immediate Response

1. Run `ceph health detail` to assess impact
2. Check `ceph crash ls-new` for recent crashes
3. Identify affected OSDs and root cause category
4. Set temporary flags if flapping: `ceph osd set noup nodown`

### Phase 2: Diagnosis

1. Review OSD logs: `/var/log/ceph/ceph-osd.<id>.log`
2. Check system health: `dmesg`, `systemctl status`, SMART data
3. Verify network connectivity between nodes
4. Analyze crash details: `ceph crash info <id>`

### Phase 3: Recovery Decision

- **Hardware failure**: Replace OSD using safe-to-destroy workflow
- **Network issue**: Fix connectivity, then restart OSDs
- **Software issue**: Fix configuration, restart services
- **Resource issue**: Add resources or adjust limits

### Phase 4: Recovery Execution

1. For replacement: follow `safe-to-destroy` → `destroy` → `prepare` → `activate` workflow
2. For repair: restart services and monitor recovery
3. Clear temporary flags: `ceph osd unset noup nodown`
4. Archive crash reports: `ceph crash archive <id>`

### Phase 5: Verification

1. Monitor `ceph -w` until cluster returns to `active+clean`
2. Verify all PGs are healthy
3. Check performance metrics return to normal
4. Update monitoring/alerting thresholds

## Prevention Strategies

- Enable device monitoring: `ceph device monitoring on`
- Implement proactive SMART monitoring
- Set up alerts for slow requests and OSD down events
- Maintain cluster below 85% capacity
- Use uniform hardware across pools when possible
- Regularly review crash reports for patterns

## When to Rebuild vs Repair

- **Repair**: Software issues, network problems, resource constraints
- **Rebuild**: Hardware failures, corrupted filesystems, repeated crashes
- **Always use `ceph osd safe-to-destroy`** before any destructive operation

## Additional Diagnostic Commands

```shell
# Monitor key metrics
ceph daemon osd.<id> perf dump
ceph daemon osd.<id> ops

# Track slow requests
ceph health detail | grep "slow requests"

# Check device SMART data
smartctl -a /dev/sdX

# Monitor system logs for I/O errors
dmesg | grep -i error
```

## Batch OSD Operations

For multiple OSD failures, process in batches:

```shell
# Remove 1-2 OSDs at a time
for osd in 0 1; do
    ceph osd out $osd
    # Wait for rebalancing
    while ! ceph osd safe-to-destroy osd.$osd; do sleep 30; done
    ceph osd purge $osd --yes-i-really-mean-it
done
```

## Common Pitfalls to Avoid

- Removing OSDs when cluster is near full → data loss risk
- Ignoring slow requests → eventual OSD crash
- Not checking `safe-to-destroy` → data corruption
- Forgetting to archive crash reports → health warnings persist