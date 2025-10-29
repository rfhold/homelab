/**
 * Central configuration for Helm charts used across components
 * This file tracks repositories, versions, and chart names to ensure consistency
 * 
 * For OCI charts (starting with "oci://"), the full OCI URL should be in the chart field.
 * Components will automatically detect OCI charts and handle them appropriately.
 */

import * as pulumi from "@pulumi/pulumi";

export interface HelmChartConfig {
  /** Chart name */
  chart: string;
  /** Chart version */
  version: string;
  /** Helm repository URL */
  repository?: string;
}

/**
 * Creates base Helm chart arguments with proper OCI chart handling
 * 
 * @param chartConfig Chart configuration from HELM_CHARTS
 * @param namespace Kubernetes namespace to deploy into
 * @returns Base ChartArgs for both traditional and OCI charts (without values)
 */
export function createHelmChartArgs(
  chartConfig: HelmChartConfig,
  namespace: pulumi.Input<string>
) {
  const isOciChart = chartConfig.chart.startsWith("oci://");

  const chartArgs = {
    chart: chartConfig.chart,
    version: chartConfig.version,
    namespace: namespace,
  } as const;

  // Only add repositoryOpts for non-OCI charts
  if (!isOciChart && chartConfig.repository) {
    return {
      ...chartArgs,
      repositoryOpts: {
        repo: chartConfig.repository,
      },
    } as const;
  }

  return chartArgs;
}

/**
 * Helm chart configurations for all components
 */
export const HELM_CHARTS = {
  /**
   * MetalLB - Load balancer for bare metal Kubernetes clusters
   * @see https://metallb.universe.tf/
   */
  METAL_LB: {
    chart: "metallb",
    version: "0.14.9",
    repository: "https://metallb.github.io/metallb",
  } as HelmChartConfig,

  /**
   * Traefik - Modern HTTP reverse proxy and load balancer
   * @see https://traefik.io/
   */
  TRAEFIK: {
    chart: "traefik",
    version: "36.3.0",
    repository: "https://traefik.github.io/charts",
  } as HelmChartConfig,

  /**
   * ExternalDNS - Synchronizes exposed Kubernetes Services and Ingresses with DNS providers
   * @see https://kubernetes-sigs.github.io/external-dns/
   */
  EXTERNAL_DNS: {
    chart: "external-dns",
    version: "1.17.0",
    repository: "https://kubernetes-sigs.github.io/external-dns",
  } as HelmChartConfig,

  /**
   * cert-manager - X.509 certificate management for Kubernetes
   * @see https://cert-manager.io/
   */
  CERT_MANAGER: {
    chart: "cert-manager",
    version: "v1.18.2",
    repository: "https://charts.jetstack.io",
  } as HelmChartConfig,

  /**
   * Rook Ceph - Cloud-native storage operator for Kubernetes
   * @see https://rook.io/
   */
  ROOK_CEPH: {
    chart: "rook-ceph",
    version: "v1.17.5",
    repository: "https://charts.rook.io/release",
  } as HelmChartConfig,

  /**
   * Valkey - High-performance data structure server (Redis-compatible)
   * @see https://valkey.io/
   * @see https://github.com/bitnami/charts/tree/main/bitnami/valkey
   */
  VALKEY: {
    chart: "oci://registry-1.docker.io/bitnamicharts/valkey",
    version: "3.0.16",
  } as HelmChartConfig,

  /**
   * PostgreSQL - Open source object-relational database system
   * @see https://www.postgresql.org/
   * @see https://github.com/bitnami/charts/tree/main/bitnami/postgresql
   */
  POSTGRESQL: {
    chart: "oci://registry-1.docker.io/bitnamicharts/postgresql",
    version: "16.7.15",
  } as HelmChartConfig,

  /**
   * Velero - Backup and disaster recovery for Kubernetes
   * @see https://velero.io/
   * @see https://github.com/vmware-tanzu/helm-charts/tree/main/charts/velero
   */
  VELERO: {
    chart: "velero",
    version: "10.0.8",
    repository: "https://vmware-tanzu.github.io/helm-charts",
  } as HelmChartConfig,

  /**
   * Gitea - Self-hosted Git service with web interface
   * @see https://gitea.io/
   * @see https://gitea.com/gitea/helm-chart
   */
  GITEA: {
    chart: "oci://docker.gitea.com/charts/gitea",
    version: "12.1.1",
  } as HelmChartConfig,

  /**
   * Vaultwarden - Alternative implementation of the Bitwarden server API
   * @see https://github.com/dani-garcia/vaultwarden
   * @see https://github.com/guerzon/vaultwarden
   */
  VAULTWARDEN: {
    chart: "vaultwarden",
    version: "0.32.1",
    repository: "https://guerzon.github.io/vaultwarden",
  } as HelmChartConfig,

  /**
   * MongoDB - NoSQL document database
   * @see https://www.mongodb.com/
   * @see https://github.com/bitnami/charts/tree/main/bitnami/mongodb
   */
  MONGODB: {
    chart: "oci://registry-1.docker.io/bitnamicharts/mongodb",
    version: "16.5.33",
  } as HelmChartConfig,

  /**
   * NVIDIA Device Plugin - Enables GPU support in Kubernetes
   * @see https://github.com/NVIDIA/k8s-device-plugin
   */
  NVIDIA_DEVICE_PLUGIN: {
    chart: "nvidia-device-plugin",
    version: "0.18.0",
    repository: "https://nvidia.github.io/k8s-device-plugin",
  } as HelmChartConfig,

  /**
   * kgateway CRDs - Custom Resource Definitions for kgateway
   * @see https://kgateway.dev/
   */
  KGATEWAY_CRDS: {
    chart: "oci://cr.kgateway.dev/kgateway-dev/charts/kgateway-crds",
    version: "v2.1.0",
  } as HelmChartConfig,

  /**
   * kgateway - Kubernetes Gateway API implementation with Envoy-based API Gateway and AI capabilities
   * @see https://kgateway.dev/
   */
  KGATEWAY: {
    chart: "oci://cr.kgateway.dev/kgateway-dev/charts/kgateway",
    version: "v2.1.0",
  } as HelmChartConfig,

  /**
   * Gateway API Inference Extension - Provides InferencePool controller and Endpoint Picker Extension
   * @see https://gateway-api-inference-extension.sigs.k8s.io/
   */
  GATEWAY_API_INFERENCE_POOL: {
    chart: "oci://registry.k8s.io/gateway-api-inference-extension/charts/inferencepool",
    version: "v1.0.2",
  } as HelmChartConfig,

  /**
   * Gateway API Inference Extension - Body-Based Routing extension for kgateway
   * @see https://gateway-api-inference-extension.sigs.k8s.io/
   */
  GATEWAY_API_BODY_BASED_ROUTING: {
    chart: "oci://registry.k8s.io/gateway-api-inference-extension/charts/body-based-routing",
    version: "v1.0.2",
  } as HelmChartConfig,

  /**
   * Grafana - Open source analytics and monitoring solution
   * @see https://grafana.com/
   * @see https://github.com/grafana/helm-charts/tree/main/charts/grafana
   */
  GRAFANA: {
    chart: "grafana",
    version: "10.1.2",
    repository: "https://grafana.github.io/helm-charts",
  } as HelmChartConfig,

  /**
   * Mimir - Horizontally scalable, highly available, multi-tenant TSDB for Prometheus
   * @see https://grafana.com/oss/mimir/
   * @see https://github.com/grafana/mimir/tree/main/operations/helm/charts/mimir-distributed
   */
  MIMIR_DISTRIBUTED: {
    chart: "mimir-distributed",
    version: "5.8.0",
    repository: "https://grafana.github.io/helm-charts",
  } as HelmChartConfig,

  /**
   * Loki - Like Prometheus, but for logs
   * @see https://grafana.com/oss/loki/
   * @see https://github.com/grafana/loki/tree/main/production/helm/loki
   */
  LOKI: {
    chart: "loki",
    version: "6.44.0",
    repository: "https://grafana.github.io/helm-charts",
  } as HelmChartConfig,

  /**
   * Alloy - OpenTelemetry Collector distribution with Prometheus pipelines
   * @see https://grafana.com/docs/alloy/
   * @see https://github.com/grafana/alloy/tree/main/operations/helm/charts/alloy
   */
  ALLOY: {
    chart: "alloy",
    version: "1.3.1",
    repository: "https://grafana.github.io/helm-charts",
  } as HelmChartConfig,

  /**
   * k8s-monitoring - Comprehensive Kubernetes observability with Grafana Alloy
   * @see https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/
   * @see https://github.com/grafana/k8s-monitoring-helm
   */
  K8S_MONITORING: {
    chart: "k8s-monitoring",
    version: "3.5.5",
    repository: "https://grafana.github.io/helm-charts",
  } as HelmChartConfig,
} as const; 
