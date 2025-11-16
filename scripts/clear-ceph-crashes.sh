#!/bin/bash

CLUSTER=$1
NAMESPACE=${2:-storage}

if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ -z "$CLUSTER" ]; then
    echo "Usage: $0 <cluster> [namespace]"
    echo ""
    echo "Arguments:"
    echo "  cluster      Kubernetes cluster context (required)"
    echo "  namespace    Kubernetes namespace (default: storage)"
    echo ""
    echo "Available clusters:"
    kubectl config get-contexts -o name | sed 's/^/  /'
    echo ""
    echo "Examples:"
    echo "  $0 pantheon           # Use pantheon cluster, storage namespace"
    echo "  $0 jupiter storage    # Use jupiter cluster, storage namespace"
    exit 0
fi

CURRENT_CONTEXT=$(kubectl config current-context)
echo "Switching to cluster '$CLUSTER'..."
kubectl config use-context "$CLUSTER" >/dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "Error: Failed to switch to cluster '$CLUSTER'"
    echo ""
    echo "Available clusters:"
    kubectl config get-contexts -o name | sed 's/^/  /'
    exit 1
fi

echo "Targeting namespace '$NAMESPACE' in cluster '$CLUSTER'"
echo ""

TOOLBOX_POD=$(kubectl get pods -n "$NAMESPACE" -l app=rook-ceph-tools -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$TOOLBOX_POD" ]; then
    echo "Error: No toolbox pod found in namespace '$NAMESPACE'"
    echo "Looking for pods with label app=rook-ceph-tools"
    echo ""
    echo "Available pods in namespace:"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "Namespace not found or no access"
    exit 1
fi

echo "Using toolbox pod: $TOOLBOX_POD"
echo ""

echo "Listing crash reports..."
kubectl exec -n "$NAMESPACE" "$TOOLBOX_POD" -- ceph crash ls

CRASH_COUNT=$(kubectl exec -n "$NAMESPACE" "$TOOLBOX_POD" -- ceph crash ls --format json 2>/dev/null | grep -o '"crash_id"' | wc -l)

if [ "$CRASH_COUNT" -eq 0 ]; then
    echo ""
    echo "No crash reports found"
    exit 0
fi

echo ""
echo "Found $CRASH_COUNT crash report(s)"
echo ""
read -p "Archive all crash reports? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Archiving all crash reports..."
    kubectl exec -n "$NAMESPACE" "$TOOLBOX_POD" -- ceph crash archive-all
    
    echo ""
    echo "Verifying crashes are archived..."
    kubectl exec -n "$NAMESPACE" "$TOOLBOX_POD" -- ceph crash ls
    
    echo ""
    echo "Checking cluster health after 2 seconds..."
    sleep 2
    kubectl exec -n "$NAMESPACE" "$TOOLBOX_POD" -- ceph health
    
    echo ""
    echo "Done!"
else
    echo "Cancelled"
    kubectl config use-context "$CURRENT_CONTEXT" >/dev/null 2>&1
    exit 0
fi

echo ""
echo "Switching back to original context '$CURRENT_CONTEXT'..."
kubectl config use-context "$CURRENT_CONTEXT" >/dev/null 2>&1
