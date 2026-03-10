import * as k8s from "@pulumi/kubernetes";

export type ServiceOverrides = k8s.core.v1.ServiceArgs;
export type PvcOverrides = k8s.core.v1.PersistentVolumeClaimArgs;
export type IngressOverrides = k8s.networking.v1.IngressArgs;
