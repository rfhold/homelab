import * as pulumi from "@pulumi/pulumi";
import { PrometheusExporter } from "./prometheus-exporter";
import { DOCKER_IMAGES } from "../docker-images";

export interface MktxpRouterArgs {
  name: string;
  hostname: pulumi.Input<string>;
  port?: pulumi.Input<number>;
  username: pulumi.Input<string>;
  password: pulumi.Input<string>;
  useSsl?: pulumi.Input<boolean>;
  noSslCertificate?: pulumi.Input<boolean>;
  sslCertificateVerify?: pulumi.Input<boolean>;
  sslCheckHostname?: pulumi.Input<boolean>;
  sslCaFile?: pulumi.Input<string>;
  plainTextLogin?: pulumi.Input<boolean>;
  enabled?: pulumi.Input<boolean>;

  health?: pulumi.Input<boolean>;
  installedPackages?: pulumi.Input<boolean>;
  dhcp?: pulumi.Input<boolean>;
  dhcpLease?: pulumi.Input<boolean>;
  routes?: pulumi.Input<boolean>;
  wireless?: pulumi.Input<boolean>;
  wirelessClients?: pulumi.Input<boolean>;
  capsman?: pulumi.Input<boolean>;
  capsmanClients?: pulumi.Input<boolean>;
  interface?: pulumi.Input<boolean>;
  firewall?: pulumi.Input<boolean>;
  monitor?: pulumi.Input<boolean>;
  ipv6Firewall?: pulumi.Input<boolean>;
  ipv6Neighbor?: pulumi.Input<boolean>;
  poe?: pulumi.Input<boolean>;
  pool?: pulumi.Input<boolean>;
  queue?: pulumi.Input<boolean>;
  connections?: pulumi.Input<boolean>;
  connectionStats?: pulumi.Input<boolean>;
  neighbor?: pulumi.Input<boolean>;
  dns?: pulumi.Input<boolean>;
  netwatch?: pulumi.Input<boolean>;
  publicIp?: pulumi.Input<boolean>;
  user?: pulumi.Input<boolean>;
  w60g?: pulumi.Input<boolean>;
  ipsec?: pulumi.Input<boolean>;
  eoip?: pulumi.Input<boolean>;
  gre?: pulumi.Input<boolean>;
  ipip?: pulumi.Input<boolean>;
  lte?: pulumi.Input<boolean>;
  switchPort?: pulumi.Input<boolean>;
  bgp?: pulumi.Input<boolean>;
  bfd?: pulumi.Input<boolean>;
  routingStats?: pulumi.Input<boolean>;
  certificate?: pulumi.Input<boolean>;
  container?: pulumi.Input<boolean>;
  kidControlAssigned?: pulumi.Input<boolean>;
  kidControlDynamic?: pulumi.Input<boolean>;

  ipv6Pool?: pulumi.Input<boolean>;
  ipv6Route?: pulumi.Input<boolean>;

  addressList?: pulumi.Input<string>;
  ipv6AddressList?: pulumi.Input<string>;
  remoteDhcpEntry?: pulumi.Input<string>;
  remoteCapsmanEntry?: pulumi.Input<string>;
  credentialsFile?: pulumi.Input<string>;

  customLabels?: pulumi.Input<string>;
  useCommentsOverNames?: pulumi.Input<boolean>;
  checkForUpdates?: pulumi.Input<boolean>;
}

export interface MktxpSystemArgs {
  listen?: pulumi.Input<string>;
  socketTimeout?: pulumi.Input<number>;
  initialDelayOnFailure?: pulumi.Input<number>;
  maxDelayOnFailure?: pulumi.Input<number>;
  delayIncDiv?: pulumi.Input<number>;
  fetchRoutersInParallel?: pulumi.Input<boolean>;
  maxWorkerThreads?: pulumi.Input<number>;
  maxScrapeDuration?: pulumi.Input<number>;
  totalMaxScrapeDuration?: pulumi.Input<number>;
  minimalCollectInterval?: pulumi.Input<number>;
  persistentRouterConnectionPool?: pulumi.Input<boolean>;
  persistentDhcpCache?: pulumi.Input<boolean>;
  bandwidth?: pulumi.Input<boolean>;
  bandwidthTestInterval?: pulumi.Input<number>;
  verboseMode?: pulumi.Input<boolean>;
  compactDefaultConfValues?: pulumi.Input<boolean>;
  prometheusHeadersDeduplication?: pulumi.Input<boolean>;
}

export interface MktxpArgs {
  namespace: pulumi.Input<string>;
  routers: MktxpRouterArgs[];
  system?: MktxpSystemArgs;
  image?: pulumi.Input<string>;
  nodeSelector?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
  hostNetwork?: pulumi.Input<boolean>;
  dnsPolicy?: pulumi.Input<string>;
  resources?: pulumi.Input<{
    requests?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
    limits?: {
      memory?: pulumi.Input<string>;
      cpu?: pulumi.Input<string>;
    };
  }>;
}

export class Mktxp extends pulumi.ComponentResource {
  public readonly exporter: PrometheusExporter;

  constructor(name: string, args: MktxpArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:Mktxp", name, {}, opts);

    const defaultResourceOptions: pulumi.ResourceOptions = { parent: this };

    const boolToIni = (val: boolean | string | number | undefined) => {
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true' ? "True" : "False";
      }
      return val ? "True" : "False";
    };

    const routerSections = pulumi.all(args.routers.map(router =>
      pulumi.all([
        router.name,
        router.hostname,
        router.username,
        router.password,
        router.customLabels,
      ]).apply(([
        routerName, hostname, username, password, customLabels
      ]) => {
        let section = `[${routerName}]\n`;
        section += `    hostname = ${hostname}\n`;
        section += `    username = ${username}\n`;
        section += `    password = ${password}\n`;
        if (customLabels) {
          section += `    custom_labels = ${customLabels}\n`;
        }
        return section;
      })
    ));

    const firstRouter = args.routers[0];
    const defaultSection = pulumi.all([
      firstRouter.port ?? 8728,
      firstRouter.useSsl ?? false,
      firstRouter.noSslCertificate ?? false,
      firstRouter.sslCertificateVerify ?? false,
      firstRouter.sslCheckHostname ?? true,
      firstRouter.sslCaFile ?? "",
      firstRouter.plainTextLogin ?? true,
      firstRouter.credentialsFile ?? "",
      firstRouter.enabled ?? true,
      firstRouter.health ?? true,
      firstRouter.installedPackages ?? true,
      firstRouter.dhcp ?? true,
      firstRouter.dhcpLease ?? true,
      firstRouter.routes ?? true,
      firstRouter.wireless ?? true,
      firstRouter.wirelessClients ?? true,
      firstRouter.capsman ?? true,
      firstRouter.capsmanClients ?? true,
      firstRouter.interface ?? true,
      firstRouter.firewall ?? true,
      firstRouter.monitor ?? true,
      firstRouter.ipv6Firewall ?? false,
      firstRouter.ipv6Neighbor ?? false,
      firstRouter.poe ?? true,
      firstRouter.pool ?? true,
      firstRouter.queue ?? true,
      firstRouter.connections ?? true,
      firstRouter.connectionStats ?? false,
      firstRouter.neighbor ?? true,
      firstRouter.dns ?? true,
      firstRouter.netwatch ?? true,
      firstRouter.publicIp ?? true,
      firstRouter.user ?? true,
      firstRouter.w60g ?? false,
      firstRouter.ipsec ?? false,
      firstRouter.eoip ?? false,
      firstRouter.gre ?? false,
      firstRouter.ipip ?? false,
      firstRouter.lte ?? false,
      firstRouter.switchPort ?? false,
      firstRouter.bgp ?? false,
      firstRouter.bfd ?? false,
      firstRouter.routingStats ?? false,
      firstRouter.certificate ?? false,
      firstRouter.container ?? false,
      firstRouter.kidControlAssigned ?? false,
      firstRouter.kidControlDynamic ?? false,
      firstRouter.ipv6Pool ?? false,
      firstRouter.ipv6Route ?? false,
      firstRouter.addressList,
      firstRouter.ipv6AddressList,
      firstRouter.remoteDhcpEntry,
      firstRouter.remoteCapsmanEntry,
      firstRouter.useCommentsOverNames ?? true,
      firstRouter.checkForUpdates ?? false,
    ]).apply(([
      port, useSsl, noSslCertificate, sslCertificateVerify, sslCheckHostname, sslCaFile,
      plainTextLogin, credentialsFile, enabled, health, installedPackages, dhcp, dhcpLease,
      routes, wireless, wirelessClients, capsman, capsmanClients, iface, firewall, monitor,
      ipv6Firewall, ipv6Neighbor, poe, pool, queue, connections, connectionStats, neighbor,
      dns, netwatch, publicIp, user, w60g, ipsec, eoip, gre, ipip, lte, switchPort, bgp, bfd,
      routingStats, certificate, container, kidControlAssigned, kidControlDynamic, ipv6Pool,
      ipv6Route, addressList, ipv6AddressList, remoteDhcpEntry, remoteCapsmanEntry,
      useCommentsOverNames, checkForUpdates
    ]) => {
      let section = `[default]\n`;
      section += `    enabled = ${boolToIni(enabled)}\n`;
      section += `    hostname = localhost\n`;
      section += `    port = ${port}\n`;
      section += `    \n`;
      section += `    username = username\n`;
      section += `    password = password\n`;
      section += `    credentials_file = ""\n`;
      section += `    \n`;
      section += `    custom_labels = None\n`;
      section += `    \n`;
      section += `    use_ssl = ${boolToIni(useSsl)}\n`;
      section += `    no_ssl_certificate = ${boolToIni(noSslCertificate)}\n`;
      section += `    ssl_certificate_verify = ${boolToIni(sslCertificateVerify)}\n`;
      section += `    ssl_check_hostname = ${boolToIni(sslCheckHostname)}\n`;
      section += `    ssl_ca_file = ""\n`;
      section += `    plaintext_login = ${boolToIni(plainTextLogin)}\n`;
      section += `    \n`;
      section += `    health = ${boolToIni(health)}\n`;
      section += `    installed_packages = ${boolToIni(installedPackages)}\n`;
      section += `    dhcp = ${boolToIni(dhcp)}\n`;
      section += `    dhcp_lease = ${boolToIni(dhcpLease)}\n`;
      section += `    \n`;
      section += `    connections = ${boolToIni(connections)}\n`;
      section += `    connection_stats = ${boolToIni(connectionStats)}\n`;
      section += `    \n`;
      section += `    interface = ${boolToIni(iface)}\n`;
      section += `    \n`;
      section += `    route = ${boolToIni(routes)}\n`;
      section += `    pool = ${boolToIni(pool)}\n`;
      section += `    firewall = ${boolToIni(firewall)}\n`;
      section += `    neighbor = ${boolToIni(neighbor)}\n`;
      section += `    address_list = ${addressList ? addressList : 'None'}\n`;
      section += `    dns = ${boolToIni(dns)}\n`;
      section += `    \n`;
      section += `    ipv6_route = ${boolToIni(ipv6Route)}\n`;
      section += `    ipv6_pool = ${boolToIni(ipv6Pool)}\n`;
      section += `    ipv6_firewall = ${boolToIni(ipv6Firewall)}\n`;
      section += `    ipv6_neighbor = ${boolToIni(ipv6Neighbor)}\n`;
      section += `    ipv6_address_list = ${ipv6AddressList ? ipv6AddressList : 'None'}\n`;
      section += `    \n`;
      section += `    poe = ${boolToIni(poe)}\n`;
      section += `    monitor = ${boolToIni(monitor)}\n`;
      section += `    netwatch = ${boolToIni(netwatch)}\n`;
      section += `    public_ip = ${boolToIni(publicIp)}\n`;
      section += `    wireless = ${boolToIni(wireless)}\n`;
      section += `    wireless_clients = ${boolToIni(wirelessClients)}\n`;
      section += `    capsman = ${boolToIni(capsman)}\n`;
      section += `    capsman_clients = ${boolToIni(capsmanClients)}\n`;
      section += `    w60g = ${boolToIni(w60g)}\n`;
      section += `    \n`;
      section += `    eoip = ${boolToIni(eoip)}\n`;
      section += `    gre = ${boolToIni(gre)}\n`;
      section += `    ipip = ${boolToIni(ipip)}\n`;
      section += `    lte = ${boolToIni(lte)}\n`;
      section += `    ipsec = ${boolToIni(ipsec)}\n`;
      section += `    switch_port = ${boolToIni(switchPort)}\n`;
      section += `    \n`;
      section += `    kid_control_assigned = ${boolToIni(kidControlAssigned)}\n`;
      section += `    kid_control_dynamic = ${boolToIni(kidControlDynamic)}\n`;
      section += `    \n`;
      section += `    user = ${boolToIni(user)}\n`;
      section += `    queue = ${boolToIni(queue)}\n`;
      section += `    \n`;
      section += `    bfd = ${boolToIni(bfd)}\n`;
      section += `    bgp = ${boolToIni(bgp)}\n`;
      section += `    routing_stats = ${boolToIni(routingStats)}\n`;
      section += `    certificate = ${boolToIni(certificate)}\n`;
      section += `    \n`;
      section += `    container = ${boolToIni(container)}\n`;
      section += `    \n`;
      section += `    remote_dhcp_entry = ${remoteDhcpEntry ? remoteDhcpEntry : 'None'}\n`;
      section += `    remote_capsman_entry = ${remoteCapsmanEntry ? remoteCapsmanEntry : 'None'}\n`;
      section += `    \n`;
      section += `    use_comments_over_names = ${boolToIni(useCommentsOverNames)}\n`;
      section += `    check_for_updates = ${boolToIni(checkForUpdates)}\n`;
      return section;
    });

    const mktxpConfContent = pulumi.all([routerSections, defaultSection]).apply(([routers, defaults]) =>
      defaults + "\n\n" + routers.join("\n\n")
    );

    const systemConfig = args.system || {};
    const systemConfContent = pulumi.all([
      systemConfig.listen ?? "0.0.0.0:49090",
      systemConfig.socketTimeout ?? 2,
      systemConfig.initialDelayOnFailure ?? 120,
      systemConfig.maxDelayOnFailure ?? 900,
      systemConfig.delayIncDiv ?? 5,
      systemConfig.fetchRoutersInParallel ?? true,
      systemConfig.maxWorkerThreads ?? 5,
      systemConfig.maxScrapeDuration ?? 10,
      systemConfig.totalMaxScrapeDuration ?? 30,
      systemConfig.minimalCollectInterval ?? 5,
      systemConfig.persistentRouterConnectionPool ?? true,
      systemConfig.persistentDhcpCache ?? true,
      systemConfig.bandwidth ?? false,
      systemConfig.bandwidthTestInterval ?? 600,
      systemConfig.verboseMode ?? false,
      systemConfig.compactDefaultConfValues ?? false,
      systemConfig.prometheusHeadersDeduplication ?? false,
    ]).apply(([
      listen, socketTimeout, initialDelayOnFailure, maxDelayOnFailure,
      delayIncDiv, fetchRoutersInParallel, maxWorkerThreads, maxScrapeDuration,
      totalMaxScrapeDuration, minimalCollectInterval, persistentRouterConnectionPool,
      persistentDhcpCache, bandwidth, bandwidthTestInterval, verboseMode,
      compactDefaultConfValues, prometheusHeadersDeduplication
    ]) => {
      const boolToIni = (val: boolean | string | number | undefined) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true' ? "True" : "False";
        }
        return val ? "True" : "False";
      };

      let content = "[MKTXP]\n";
      content += `    listen = '${listen}'\n`;
      content += `    socket_timeout = ${socketTimeout}\n`;
      content += `    \n`;
      content += `    initial_delay_on_failure = ${initialDelayOnFailure}\n`;
      content += `    max_delay_on_failure = ${maxDelayOnFailure}\n`;
      content += `    delay_inc_div = ${delayIncDiv}\n`;
      content += `    \n`;
      content += `    fetch_routers_in_parallel = ${boolToIni(fetchRoutersInParallel)}\n`;
      content += `    max_worker_threads = ${maxWorkerThreads}\n`;
      content += `    max_scrape_duration = ${maxScrapeDuration}\n`;
      content += `    total_max_scrape_duration = ${totalMaxScrapeDuration}\n`;
      content += `    minimal_collect_interval = ${minimalCollectInterval}\n`;
      content += `    \n`;
      content += `    persistent_router_connection_pool = ${boolToIni(persistentRouterConnectionPool)}\n`;
      content += `    persistent_dhcp_cache = ${boolToIni(persistentDhcpCache)}\n`;
      content += `    \n`;
      content += `    bandwidth = ${boolToIni(bandwidth)}\n`;
      content += `    bandwidth_test_interval = ${bandwidthTestInterval}\n`;
      content += `    \n`;
      content += `    verbose_mode = ${boolToIni(verboseMode)}\n`;
      content += `    compact_default_conf_values = ${boolToIni(compactDefaultConfValues)}\n`;
      content += `    prometheus_headers_deduplication = ${boolToIni(prometheusHeadersDeduplication)}\n`;

      return content;
    });

    this.exporter = new PrometheusExporter(name, {
      namespace: args.namespace,

      deployment: {
        image: args.image || DOCKER_IMAGES.MKTXP.image,
        imagePullPolicy: "IfNotPresent",
        replicas: 1,

        env: [{
          name: "PYTHONUNBUFFERED",
          value: "1",
        }],

        resources: args.resources || {
          requests: {
            memory: "128Mi",
            cpu: "250m",
          },
          limits: {
            memory: "512Mi",
            cpu: "1000m",
          },
        },

        nodeSelector: args.nodeSelector,
        hostNetwork: args.hostNetwork,
        dnsPolicy: args.dnsPolicy,

        livenessProbe: {
          httpGet: {
            path: "/metrics",
            port: 49090,
          },
          initialDelaySeconds: 30,
          periodSeconds: 30,
        },

        readinessProbe: {
          httpGet: {
            path: "/metrics",
            port: 49090,
          },
          initialDelaySeconds: 10,
          periodSeconds: 10,
        },
      },

      metrics: {
        port: 49090,
        portName: "metrics",
        path: "/metrics",
        scheme: "http",
        scrapeInterval: "30s",
      },

      configMap: {
        data: {
          "mktxp.conf": mktxpConfContent,
          "_mktxp.conf": systemConfContent,
        },
        mountPath: "/home/mktxp/mktxp",
      },

      labels: {
        app: "mktxp-exporter",
        component: name,
      },
    }, defaultResourceOptions);

    this.registerOutputs({
      exporter: this.exporter,
    });
  }

  public getMetricsEndpoint(): pulumi.Output<string> {
    return this.exporter.getMetricsEndpoint();
  }

  public getServiceName(): pulumi.Output<string> {
    return this.exporter.getServiceName();
  }

  public getServiceUrl(): pulumi.Output<string> {
    return this.exporter.getServiceUrl();
  }
}
