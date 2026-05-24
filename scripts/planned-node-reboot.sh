#!/bin/bash
set -euo pipefail

NODE=""
CONTEXT=""
STORAGE_MODE="skip"
STORAGE_NAMESPACE="storage"
REBOOT=false
DRY_RUN=false
SSH_TARGET=""
FORCE=false
DELETE_EMPTYDIR_DATA=false
IGNORE_DAEMONSETS=true
LABEL_SELECTORS=()
SAFE_LAYER_SELECTOR="rholden.dev/workload-layer,rholden.dev/workload-layer!=storage"

usage() {
    echo "Usage: $0 -n <node> [options]"
    echo ""
    echo "Options:"
    echo "  -n <node>                 Kubernetes node to cordon and drain"
    echo "  -c <context>              Kubernetes context to use"
    echo "  -l <selector>             Workload label selector for default drain candidates"
    echo "                            Can be specified multiple times"
    echo "  --storage-mode <mode>     Storage handling mode: skip or ceph (default: skip)"
    echo "  --storage-namespace <ns>  Namespace containing Rook Ceph tools (default: storage)"
    echo "  --reboot                  Reboot the target node after successful drain checks"
    echo "  --ssh-target <target>     SSH target for reboot command (default: node name)"
    echo "  --dry-run                 Print kubectl commands without evicting pods or rebooting"
    echo "  --force                   Pass --force to kubectl drain"
    echo "  --delete-emptydir-data    Pass --delete-emptydir-data to kubectl drain"
    echo "  -h, --help                Show this help"
    echo ""
    echo "Default selectors exclude unlabeled pods and rholden.dev/workload-layer=storage."
    exit 1
}

run_kubectl() {
    if [ -n "$CONTEXT" ]; then
        local subcommand=$1
        shift
        kubectl "$subcommand" --context "$CONTEXT" "$@"
    else
        kubectl "$@"
    fi
}

run_or_print() {
    if [ "$DRY_RUN" = true ]; then
        printf 'DRY RUN:'
        printf ' %q' "$@"
        printf '\n'
    else
        "$@"
    fi
}

run_kubectl_or_print() {
    if [ -n "$CONTEXT" ]; then
        local subcommand=$1
        shift
        run_or_print kubectl "$subcommand" --context "$CONTEXT" "$@"
    else
        run_or_print kubectl "$@"
    fi
}

ceph_exec() {
    local toolbox_pod=$1
    shift

    run_kubectl exec -n "$STORAGE_NAMESPACE" "$toolbox_pod" -- ceph "$@"
}

get_ceph_toolbox_pod() {
    run_kubectl get pods -n "$STORAGE_NAMESPACE" -l app=rook-ceph-tools -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

get_osd_ids_on_node() {
    run_kubectl get pods -A -l app=rook-ceph-osd --field-selector "spec.nodeName=$NODE" -o jsonpath='{range .items[*]}{.metadata.labels.ceph-osd-id}{"\n"}{end}' 2>/dev/null | sed '/^$/d'
}

check_ceph_storage() {
    local toolbox_pod health
    local -a osd_ids

    toolbox_pod=$(get_ceph_toolbox_pod)
    if [ -z "$toolbox_pod" ]; then
        echo "ERROR: No Rook Ceph tools pod found in namespace '$STORAGE_NAMESPACE'" >&2
        exit 1
    fi

    health=$(ceph_exec "$toolbox_pod" health | awk '{print $1}')
    if [ "$health" != "HEALTH_OK" ]; then
        echo "ERROR: Ceph health is '$health'; refusing planned reboot" >&2
        exit 1
    fi

    mapfile -t osd_ids < <(get_osd_ids_on_node)
    if [ "${#osd_ids[@]}" -eq 0 ]; then
        echo "No Ceph OSD pods found on node '$NODE'"
        return
    fi

    echo "Checking Ceph ok-to-stop for OSDs on '$NODE': ${osd_ids[*]}"
    ceph_exec "$toolbox_pod" osd ok-to-stop "${osd_ids[@]}" >/dev/null
}

list_candidates() {
    local selector=$1

    run_kubectl get pods -A --field-selector "spec.nodeName=$NODE,status.phase!=Succeeded,status.phase!=Failed" -l "$selector" -o wide
}

has_storage_pods_on_node() {
    local pods

    pods=$(run_kubectl get pods -A --field-selector "spec.nodeName=$NODE,status.phase!=Succeeded,status.phase!=Failed" -l "rholden.dev/workload-layer=storage" -o name 2>/dev/null)
    [ -n "$pods" ]
}

safe_selector() {
    local selector=$1

    if [ -z "$selector" ]; then
        echo "$SAFE_LAYER_SELECTOR"
    else
        echo "$selector,$SAFE_LAYER_SELECTOR"
    fi
}

drain_selector() {
    local selector=$1
    local drain_args=(drain "$NODE" --pod-selector "$selector")

    if [ "$IGNORE_DAEMONSETS" = true ]; then
        drain_args+=(--ignore-daemonsets)
    fi

    if [ "$FORCE" = true ]; then
        drain_args+=(--force)
    fi

    if [ "$DELETE_EMPTYDIR_DATA" = true ]; then
        drain_args+=(--delete-emptydir-data)
    fi

    run_kubectl_or_print "${drain_args[@]}"
}

reboot_node() {
    local target=$SSH_TARGET

    if [ -z "$target" ]; then
        target=$NODE
    fi

    run_or_print ssh "$target" sudo systemctl reboot
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -n|--node)
            NODE=$2
            shift 2
            ;;
        -c|--context)
            CONTEXT=$2
            shift 2
            ;;
        -l|--selector)
            LABEL_SELECTORS+=("$2")
            shift 2
            ;;
        --storage-mode)
            STORAGE_MODE=$2
            shift 2
            ;;
        --storage-namespace)
            STORAGE_NAMESPACE=$2
            shift 2
            ;;
        --reboot)
            REBOOT=true
            shift
            ;;
        --ssh-target)
            SSH_TARGET=$2
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --delete-emptydir-data)
            DELETE_EMPTYDIR_DATA=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage
            ;;
    esac
done

if [ -z "$NODE" ]; then
    usage
fi

case "$STORAGE_MODE" in
    skip|ceph)
        ;;
    *)
        echo "ERROR: --storage-mode must be 'skip' or 'ceph'" >&2
        exit 1
        ;;
esac

if [ "$REBOOT" = true ] && [ "$STORAGE_MODE" = "skip" ] && has_storage_pods_on_node; then
    echo "ERROR: Storage-layer pods are present on '$NODE'; pass --storage-mode ceph before rebooting" >&2
    exit 1
fi

echo "Cordoning node '$NODE'"
run_kubectl_or_print cordon "$NODE"

echo "Default drain candidates selected by workload labels:"
if [ "${#LABEL_SELECTORS[@]}" -eq 0 ]; then
    LABEL_SELECTORS=("")
fi

for selector in "${LABEL_SELECTORS[@]}"; do
    selector=$(safe_selector "$selector")
    echo "Selector: $selector"
    list_candidates "$selector"
done

for selector in "${LABEL_SELECTORS[@]}"; do
    selector=$(safe_selector "$selector")
    echo "Draining selector: $selector"
    drain_selector "$selector"
done

if [ "$STORAGE_MODE" = "ceph" ]; then
    echo "Explicit Ceph storage handling requested"
    check_ceph_storage
    echo "Draining storage-layer pods"
    drain_selector "rholden.dev/workload-layer=storage"
else
    echo "Storage handling skipped; rholden.dev/workload-layer=storage pods were not selected"
fi

if [ "$REBOOT" = true ]; then
    echo "Rebooting node '$NODE'"
    reboot_node
else
    echo "Reboot not requested; pass --reboot after reviewing drain results"
fi
