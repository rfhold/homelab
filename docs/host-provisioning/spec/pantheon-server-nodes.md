# Pantheon Server Nodes

## Cluster Role

- Athena and Artemis MUST be represented as Pantheon K3s server nodes using the Pantheon API endpoint on port 6443.
- Both nodes MUST carry the VLAN 3 access label.

## Athena

- Athena MUST carry `rholden.dev/gpu=cuda` so CUDA workloads can select it.
- Athena MUST NOT receive a GPU taint or KVM scheduling metadata from this host contract.
- NVIDIA host provisioning MUST install regular x86 server driver packages and the NVIDIA container runtime and toolkit.
- Running NVIDIA host provisioning MUST NOT itself add or remove Kubernetes labels or taints.

## Artemis

- Artemis MUST remain scheduling-neutral apart from the VLAN access label and its K3s server role.
- Artemis MUST NOT carry GPU labels, GPU taints, KVM labels, or storage scheduling labels.
