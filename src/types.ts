import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export type ServiceOverrides = k8s.core.v1.ServiceArgs;
export type PvcOverrides = k8s.core.v1.PersistentVolumeClaimArgs;
export type IngressOverrides = k8s.networking.v1.IngressArgs;
export type WorkloadLabels = pulumi.Input<Record<string, pulumi.Input<string>>>;

export interface WorkloadLabelArgs {
  workloadLabels?: WorkloadLabels;
}

type Metadata = {
  labels?: WorkloadLabels;
  [key: string]: unknown;
};

function mergeWorkloadLabels(labels: WorkloadLabels | undefined, workloadLabels: WorkloadLabels): WorkloadLabels {
  return pulumi.all([labels ?? {}, workloadLabels]).apply(([existing, provided]) => ({
    ...provided,
    ...existing,
  }));
}

function withMetadataLabels(metadata: Metadata | undefined, workloadLabels: WorkloadLabels): Metadata {
  return {
    ...(metadata ?? {}),
    labels: mergeWorkloadLabels(metadata?.labels, workloadLabels),
  };
}

function withTemplateLabels(template: any, workloadLabels: WorkloadLabels): any {
  if (!template) {
    return template;
  }

  return {
    ...template,
    metadata: withMetadataLabels(template.metadata, workloadLabels),
  };
}

function withControllerTemplateLabels(type: string, props: any, workloadLabels: WorkloadLabels): any {
  if (type.endsWith(":CronJob")) {
    return {
      ...props,
      spec: {
        ...props.spec,
        jobTemplate: {
          ...props.spec?.jobTemplate,
          spec: {
            ...props.spec?.jobTemplate?.spec,
            template: withTemplateLabels(props.spec?.jobTemplate?.spec?.template, workloadLabels),
          },
        },
      },
    };
  }

  if (
    type.endsWith(":Deployment")
    || type.endsWith(":StatefulSet")
    || type.endsWith(":DaemonSet")
    || type.endsWith(":ReplicaSet")
    || type.endsWith(":Job")
  ) {
    return {
      ...props,
      spec: {
        ...props.spec,
        template: withTemplateLabels(props.spec?.template, workloadLabels),
      },
    };
  }

  return props;
}

export function withWorkloadLabels<T extends pulumi.ResourceOptions>(
  opts: T | undefined,
  workloadLabels: WorkloadLabels | undefined
): T | undefined {
  if (!workloadLabels) {
    return opts;
  }

  const transformation: pulumi.ResourceTransformation = (args) => {
    if (!args.type.startsWith("kubernetes:")) {
      return undefined;
    }

    const propsWithLabels = {
      ...args.props,
      metadata: withMetadataLabels(args.props.metadata, workloadLabels),
    };

    return {
      props: withControllerTemplateLabels(args.type, propsWithLabels, workloadLabels),
      opts: args.opts,
    };
  };

  return {
    ...(opts ?? {}),
    transformations: [
      ...(opts?.transformations ?? []),
      transformation,
    ],
  } as T;
}
