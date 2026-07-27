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
  storeDashboardSha256: true,
});
const folders = JSON.parse(fs.readFileSync(path.join(__dirname, "folders.json"), "utf8")) as Record<string, string>;
const folderResources: Record<string, grafana.oss.Folder> = {};

for (const [uid, title] of Object.entries(folders)) {
  folderResources[uid] = new grafana.oss.Folder(uid, { uid, title }, { provider });
}

const dashboardsDirectory = path.join(__dirname, "dashboards");
for (const domain of fs.readdirSync(dashboardsDirectory).sort()) {
  for (const fileName of fs.readdirSync(path.join(dashboardsDirectory, domain)).filter(name => name.endsWith(".json")).sort()) {
    new grafana.oss.Dashboard(`${domain}-${path.basename(fileName, ".json")}`, {
      configJson: fs.readFileSync(path.join(dashboardsDirectory, domain, fileName), "utf8"),
      folder: folderResources[domain].uid,
      overwrite: true,
    }, { provider });
  }
}

export const folderUids = Object.fromEntries(Object.entries(folderResources).map(([domain, folder]) => [domain, folder.uid]));
