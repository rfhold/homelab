import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";
import * as fs from "fs";
import * as path from "path";

const config = new pulumi.Config();

const serverName = config.require("serverName");
const serverType = config.get("serverType") || "cpx11";
const location = config.get("location") || "ash";
const image = config.get("image") || "debian-13";

const sshKeyName = config.get("sshKeyName") || "default";
const cloudInitConfig = config.get("cloudInitConfig");

const firewall = new hcloud.Firewall(`${serverName}-firewall`, {
  name: `${serverName}-firewall`,
  rules: [
    {
      direction: "in",
      protocol: "tcp",
      port: "22",
      sourceIps: ["0.0.0.0/0", "::/0"],
      description: "SSH",
    },
    {
      direction: "in",
      protocol: "tcp",
      port: "443",
      sourceIps: ["0.0.0.0/0", "::/0"],
      description: "wstunnel",
    },
    {
      direction: "in",
      protocol: "icmp",
      sourceIps: ["0.0.0.0/0", "::/0"],
      description: "ICMP",
    },
  ],
  labels: {
    managed_by: "pulumi",
    stack: pulumi.getStack(),
  },
});

const cloudConfig = cloudInitConfig
  ? fs.readFileSync(path.join(__dirname, cloudInitConfig), "utf-8")
  : undefined;

const server = new hcloud.Server(serverName, {
  name: serverName,
  serverType: serverType,
  image: image,
  location: location,
  sshKeys: [sshKeyName],
  userData: cloudConfig,
  publicNets: [
    {
      ipv4Enabled: true,
      ipv6Enabled: true,
    },
  ],
  firewallIds: [firewall.id.apply((id: string) => parseInt(id))],
  labels: {
    managed_by: "pulumi",
    stack: pulumi.getStack(),
    os: image,
  },
  shutdownBeforeDeletion: true,
});

export const serverId = server.id;
export const serverIpv4 = server.ipv4Address;
export const serverIpv6 = server.ipv6Address;
export const serverStatus = server.status;
export const sshCommand = pulumi.interpolate`ssh root@${server.ipv4Address}`;
