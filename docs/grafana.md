# Grafana Helm Chart Static Configuration Guide

This document provides comprehensive guidance for statically configuring Grafana datasources, dashboards, and other settings using the official Grafana Helm chart.

## Overview

The Grafana Helm chart supports multiple approaches for static configuration:

1. **Direct values configuration** - Define settings directly in `values.yaml`
2. **ConfigMap provisioning** - Reference external ConfigMaps containing configurations
3. **Sidecar pattern** - Automatically discover and load configurations from labeled ConfigMaps/Secrets
4. **File provisioning** - Mount configuration files from volumes

## Installation

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install grafana grafana/grafana -f values.yaml
```

## Datasource Configuration

### Method 1: Direct Configuration in values.yaml

Define datasources directly in your Helm values:

```yaml
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server:9090
      access: proxy
      isDefault: true
      jsonData:
        timeInterval: "30s"
        httpMethod: POST
    - name: Loki
      type: loki
      url: http://loki:3100
      access: proxy
      jsonData:
        maxLines: 1000
    - name: PostgreSQL
      type: postgres
      url: postgres-service:5432
      database: mydb
      user: grafana
      secureJsonData:
        password: ${POSTGRES_PASSWORD}  # Can use env vars
      jsonData:
        sslmode: require
        postgresVersion: 1300
        timescaledb: false
    - name: Elasticsearch
      type: elasticsearch
      url: http://elasticsearch:9200
      access: proxy
      jsonData:
        timeField: "@timestamp"
        interval: Daily
        logMessageField: message
        logLevelField: level
    deleteDatasources:
    - name: old-datasource
      orgId: 1
```

### Method 2: Using ConfigMaps

Create a ConfigMap with datasource configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
    - name: CloudWatch
      type: cloudwatch
      jsonData:
        authType: keys
        defaultRegion: us-east-1
      secureJsonData:
        accessKey: ${AWS_ACCESS_KEY}
        secretKey: ${AWS_SECRET_KEY}
```

Reference in values.yaml:

```yaml
extraConfigmapMounts:
  - name: datasource-config
    mountPath: /etc/grafana/provisioning/datasources
    configMap: grafana-datasources
    readOnly: true
```

### Method 3: Sidecar Pattern for Datasources

Enable automatic datasource discovery:

```yaml
sidecar:
  datasources:
    enabled: true
    label: grafana_datasource
    labelValue: "1"
    searchNamespace: ALL  # or specific namespace
    watchMethod: WATCH    # or SLEEP
    resource: both        # configmap, secret, or both
    reloadURL: "http://localhost:3000/api/admin/provisioning/datasources/reload"
    skipReload: false
    initDatasources: false  # Set true if skipReload is true
```

Create datasource with appropriate label:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-datasource-prometheus
  labels:
    grafana_datasource: "1"
stringData:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus:9090
      access: proxy
      isDefault: true
```

## Dashboard Configuration

### Method 1: Inline Dashboard JSON

```yaml
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      editable: true
      options:
        path: /var/lib/grafana/dashboards/default

dashboards:
  default:
    kubernetes-cluster:
      json: |
        {
          "dashboard": {
            "title": "Kubernetes Cluster",
            "uid": "k8s-cluster",
            "panels": [
              {
                "id": 1,
                "title": "CPU Usage",
                "type": "graph",
                "targets": [
                  {
                    "expr": "sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)"
                  }
                ]
              }
            ]
          }
        }
    node-exporter:
      gnetId: 1860
      revision: 27
      datasource: Prometheus
    local-dashboard:
      url: https://raw.githubusercontent.com/example/dashboards/main/dashboard.json
      curlOptions: "-Lf"
    dashboard-from-file:
      file: dashboards/custom-dashboard.json
```

### Method 2: ConfigMap Reference

```yaml
dashboardsConfigMaps:
  default: grafana-dashboards-configmap
  team1: team1-dashboards-configmap
```

Create ConfigMap with dashboards:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards-configmap
data:
  nginx-dashboard.json: |
    {
      "dashboard": {
        "title": "NGINX Metrics",
        "uid": "nginx-metrics",
        ...
      }
    }
```

### Method 3: Sidecar Pattern for Dashboards

```yaml
sidecar:
  dashboards:
    enabled: true
    label: grafana_dashboard
    labelValue: "1"
    searchNamespace: ALL
    watchMethod: WATCH
    resource: both
    folder: /tmp/dashboards
    defaultFolderName: General
    provider:
      name: sidecarProvider
      orgid: 1
      folder: ''
      type: file
      disableDelete: false
      allowUiUpdates: false
      foldersFromFilesStructure: false
    reloadURL: "http://localhost:3000/api/admin/provisioning/dashboards/reload"
    skipReload: false
    folderAnnotation: grafana_folder  # Optional folder override
```

Create dashboard ConfigMap with label:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: custom-dashboard
  labels:
    grafana_dashboard: "1"
  annotations:
    grafana_folder: "Custom Dashboards"  # Optional
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "My Dashboard",
        ...
      }
    }
```

## Alerting Configuration

### Static Alert Rules and Contact Points

```yaml
alerting:
  # Alert Rules
  rules.yaml:
    apiVersion: 1
    groups:
      - orgId: 1
        name: embedded-alert-group
        folder: alerts
        interval: 5m
        rules:
          - uid: alert-1
            title: High CPU Usage
            condition: A
            data:
              - refId: A
                queryType: ''
                relativeTimeRange:
                  from: 600
                  to: 0
                datasourceUid: prometheus-uid
                model:
                  expr: 'avg(rate(container_cpu_usage_seconds_total[5m])) > 0.8'
                  interval: ''
                  refId: A
            noDataState: NoData
            execErrState: Alerting
            for: 5m
            annotations:
              description: CPU usage is above 80%
            labels:
              severity: warning
  
  # Contact Points
  contactpoints.yaml:
    apiVersion: 1
    contactPoints:
      - orgId: 1
        name: slack-notifications
        receivers:
          - uid: slack-receiver
            type: slack
            settings:
              url: ${SLACK_WEBHOOK_URL}
              title: 'Grafana Alert'
              text: '{{ `{{ template "default.message" . }}` }}'
  
  # Notification Policies
  policies.yaml:
    apiVersion: 1
    policies:
      - orgId: 1
        receiver: slack-notifications
        group_by: ['alertname', 'cluster']
        group_interval: 5m
        group_wait: 10s
        repeat_interval: 12h
  
  # Templates
  templates.yaml:
    apiVersion: 1
    templates:
      - orgId: 1
        name: custom-template
        template: |
          {{ `{{ define "custom.title" }}
            [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .GroupLabels.alertname }}
          {{ end }}` }}
```

### Sidecar Pattern for Alerts

```yaml
sidecar:
  alerts:
    enabled: true
    label: grafana_alert
    searchNamespace: ALL
    watchMethod: WATCH
    resource: both
    reloadURL: "http://localhost:3000/api/admin/provisioning/alerting/reload"
    skipReload: false
    initAlerts: false
```

## Grafana Configuration (grafana.ini)

```yaml
grafana.ini:
  server:
    domain: grafana.example.com
    root_url: https://grafana.example.com
    serve_from_sub_path: false
  
  auth:
    disable_login_form: false
    disable_signout_menu: false
  
  auth.anonymous:
    enabled: true
    org_role: Viewer
  
  auth.basic:
    enabled: true
  
  auth.ldap:
    enabled: true
    allow_sign_up: true
    config_file: /etc/grafana/ldap.toml
  
  database:
    type: postgres
    host: postgres:5432
    name: grafana
    user: grafana
    password: ${DATABASE_PASSWORD}
  
  analytics:
    check_for_updates: false
    reporting_enabled: false
  
  log:
    mode: console
    level: info
  
  unified_alerting:
    enabled: true
    ha_peers: grafana-headless:9094  # For HA setup
    ha_listen_address: ${POD_IP}:9094
    ha_advertise_address: ${POD_IP}:9094
```

## Plugin Configuration

### Installing Plugins

```yaml
plugins:
  - digrich-bubblechart-panel
  - grafana-clock-panel
  - grafana-piechart-panel
  - https://github.com/example/plugin/releases/download/v1.0.0/plugin.zip;custom-plugin
```

### Sidecar Pattern for Plugins

```yaml
sidecar:
  plugins:
    enabled: true
    label: grafana_plugin
    searchNamespace: ALL
    watchMethod: WATCH
    resource: both
    reloadURL: "http://localhost:3000/api/admin/provisioning/plugins/reload"
    skipReload: false
    initPlugins: false
```

## Advanced Configuration Patterns

### Environment Variable Substitution

```yaml
env:
  GF_DATABASE_PASSWORD:
    valueFrom:
      secretKeyRef:
        name: grafana-secrets
        key: database-password

datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: PostgreSQL
      type: postgres
      url: postgres:5432
      secureJsonData:
        password: ${GF_DATABASE_PASSWORD}
```

### Custom HTTP Headers

```yaml
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Custom API
      type: prometheus
      url: http://api.example.com
      jsonData:
        httpHeaderName1: 'X-API-Key'
        httpHeaderName2: 'Authorization'
      secureJsonData:
        httpHeaderValue1: '${API_KEY}'
        httpHeaderValue2: 'Bearer ${TOKEN}'
```

### High Availability Configuration

```yaml
replicas: 3
headlessService: true

grafana.ini:
  unified_alerting:
    enabled: true
    ha_peers: grafana-headless:9094
    ha_listen_address: ${POD_IP}:9094
    ha_advertise_address: ${POD_IP}:9094
```

### Persistence Configuration

```yaml
persistence:
  enabled: true
  type: pvc
  storageClassName: fast-ssd
  accessModes:
    - ReadWriteOnce
  size: 10Gi
  annotations:
    volume.beta.kubernetes.io/storage-class: fast-ssd
```

### RBAC Configuration

```yaml
rbac:
  create: true
  namespaced: false
  pspEnabled: false
  
serviceAccount:
  create: true
  name: grafana
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/grafana-role
```

## Best Practices

### 1. Use Secrets for Sensitive Data

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: grafana-datasource-credentials
type: Opaque
stringData:
  postgres-password: "secure-password"
  api-token: "secure-token"
```

### 2. Version Control Dashboard UIDs

Always specify UIDs for dashboards to maintain consistent URLs:

```json
{
  "dashboard": {
    "uid": "my-dashboard-v1",
    "title": "My Dashboard",
    ...
  }
}
```

### 3. Use Folder Structure

```yaml
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'infrastructure'
      folder: 'Infrastructure'
      folderUid: 'infra'
      type: file
      options:
        path: /var/lib/grafana/dashboards/infrastructure
    - name: 'applications'
      folder: 'Applications'
      folderUid: 'apps'
      type: file
      options:
        path: /var/lib/grafana/dashboards/applications
```

### 4. Enable UI Updates Carefully

```yaml
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'default'
      allowUiUpdates: false  # Prevents UI changes
      disableDeletion: true  # Prevents deletion
```

### 5. Use GitOps Patterns

Store all configuration in Git and deploy using CI/CD:

```yaml
# kustomization.yaml
resources:
  - grafana-namespace.yaml
  - grafana-datasources-configmap.yaml
  - grafana-dashboards-configmap.yaml
  - grafana-helm-release.yaml

configMapGenerator:
  - name: grafana-dashboards
    files:
      - dashboards/cluster.json
      - dashboards/nodes.json
```

## Common Patterns

### Multi-Tenant Setup

```yaml
# Multiple organizations with different datasources
datasources:
  org1-datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Org1-Prometheus
      type: prometheus
      url: http://org1-prometheus:9090
      orgId: 1
  
  org2-datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Org2-Prometheus
      type: prometheus
      url: http://org2-prometheus:9090
      orgId: 2
```

### Dynamic Dashboard Loading from Git

```yaml
dashboards:
  default:
    kubernetes-dashboards:
      url: https://raw.githubusercontent.com/kubernetes-monitoring/dashboards/main/cluster.json
      curlOptions: "-Lf"
    nginx-dashboard:
      url: https://raw.githubusercontent.com/nginxinc/nginx-prometheus-exporter/main/grafana/dashboard.json
```

### Notification Channel Templates

```yaml
alerting:
  templates.yaml:
    apiVersion: 1
    templates:
      - orgId: 1
        name: slack-template
        template: |
          {{ `{{ define "slack.title" }}
          [{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }}
          {{ end }}
          
          {{ define "slack.text" }}
          {{ range .Alerts }}
          *Alert:* {{ .Labels.alertname }} - {{ .Labels.severity }}
          *Description:* {{ .Annotations.description }}
          *Metric:* {{ range .Labels.SortedPairs }} - {{ .Name }}: {{ .Value }}
          {{ end }}
          {{ end }}
          {{ end }}` }}
```

## Troubleshooting

### Common Issues

1. **Datasource not appearing**: Check labels match sidecar configuration
2. **Dashboard not loading**: Verify JSON syntax and datasource UIDs
3. **Environment variables not substituted**: Ensure correct syntax (`$VAR` or `${VAR}`)
4. **Sidecar not detecting changes**: Check RBAC permissions for watching resources
5. **Alerts not firing**: Verify datasource UIDs and query syntax

### Debug Commands

```bash
# Check sidecar logs
kubectl logs grafana-pod -c grafana-sc-datasources

# Verify ConfigMap labels
kubectl get configmaps -l grafana_dashboard=1

# Test datasource connection
kubectl exec grafana-pod -- curl http://prometheus:9090/api/v1/query?query=up

# Check provisioning files
kubectl exec grafana-pod -- ls -la /etc/grafana/provisioning/
```

## References

- [Grafana Helm Chart Documentation](https://github.com/grafana/helm-charts/tree/main/charts/grafana)
- [Grafana Provisioning Documentation](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Grafana Configuration Documentation](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
- [Grafana Alerting Documentation](https://grafana.com/docs/grafana/latest/alerting/)