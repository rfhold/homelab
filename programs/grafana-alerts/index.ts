import fs from "node:fs";
import path from "node:path";
import * as pulumi from "@pulumi/pulumi";
import * as grafana from "@pulumiverse/grafana";
import { getStackOutput } from "../../src/adapters/stack-reference";

const config = new pulumi.Config();
const grafanaStack = {
  organization: pulumi.getOrganization(),
  project: "grafana",
  stack: config.require("grafanaStack"),
};
const provider = new grafana.Provider("grafana", {
  url: getStackOutput<string>(grafanaStack, "grafanaApiUrl"),
  auth: pulumi.interpolate`${getStackOutput<string>(grafanaStack, "grafanaAdminUser")}:${getStackOutput<string>(grafanaStack, "grafanaAdminPassword")}`,
});
const rulesDirectory = path.join(__dirname, "rules");

for (const domain of fs.readdirSync(rulesDirectory).sort()) {
  for (const fileName of fs.readdirSync(path.join(rulesDirectory, domain)).filter(name => name.endsWith(".json")).sort()) {
    const args = JSON.parse(fs.readFileSync(path.join(rulesDirectory, domain, fileName), "utf8")) as grafana.alerting.v0alpha1.AlertRuleArgs & { metadata: { uid: string } };
    new grafana.alerting.v0alpha1.AlertRule(args.metadata.uid, args, { provider });
  }
}
