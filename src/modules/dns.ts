import * as pulumi from "@pulumi/pulumi";
import { AdguardHome, AdguardHomeArgs } from "../components/adguard-home";
import { AdguardHomeSync, AdguardHomeSyncArgs } from "../components/adguard-home-sync";

export interface DnsModuleArgs {
  namespace: pulumi.Input<string>;
  adguardHome: Omit<AdguardHomeArgs, "namespace">;
  sync: Omit<AdguardHomeSyncArgs, "namespace" | "localAdguardUrl" | "localAdguardUsername" | "localAdguardPassword">;
}

export class DnsModule extends pulumi.ComponentResource {
  public readonly adguardHome: AdguardHome;
  public readonly sync?: AdguardHomeSync;

  constructor(name: string, args: DnsModuleArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:modules:Dns", name, {}, opts);

    this.adguardHome = new AdguardHome(`${name}-adguard`, {
      namespace: args.namespace,
      ...args.adguardHome,
    }, { parent: this });

    if (args.sync.enabled) {
      const adguardConnection = this.adguardHome.getConnectionConfig();
      
      this.sync = new AdguardHomeSync(`${name}-sync`, {
        namespace: args.namespace,
        localAdguardUrl: adguardConnection.webUiUrl,
        localAdguardUsername: adguardConnection.adminUsername,
        localAdguardPassword: adguardConnection.adminPassword,
        ...args.sync,
      }, { parent: this });
    }

    this.registerOutputs({
      adguardHome: this.adguardHome,
      sync: this.sync,
    });
  }

  getAdguardHomeConnectionConfig() {
    return this.adguardHome.getConnectionConfig();
  }
}