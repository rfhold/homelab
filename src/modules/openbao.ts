import * as pulumi from "@pulumi/pulumi";
import { OpenBao, OpenBaoArgs } from "../components/openbao";
import { WorkloadLabelArgs, withWorkloadLabels } from "../types";

export interface OpenBaoModuleArgs extends OpenBaoArgs, WorkloadLabelArgs {}

export class OpenBaoModule extends pulumi.ComponentResource {
  public readonly instance: OpenBao;

  constructor(name: string, args: OpenBaoModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:OpenBao", name, args, withWorkloadLabels(opts, args.workloadLabels));

    this.instance = new OpenBao(name, args, { parent: this });

    this.registerOutputs({
      instance: this.instance,
    });
  }

  public getOpenBao(): OpenBao {
    return this.instance;
  }

  public getServiceName(): pulumi.Output<string> {
    return this.instance.getServiceName();
  }

  public getUiServiceName(): pulumi.Output<string> {
    return this.instance.getUiServiceName();
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.instance.getServiceUrl();
  }

  public getUiUrl(): pulumi.Output<string> {
    return this.instance.getUiUrl();
  }

  public getKvMountPath(): pulumi.Output<string> {
    return this.instance.getKvMountPath();
  }

  public getTransitMountPath(): pulumi.Output<string> {
    return this.instance.getTransitMountPath();
  }

  public getTransitKeyName(): pulumi.Output<string> {
    return this.instance.getTransitKeyName();
  }
}
