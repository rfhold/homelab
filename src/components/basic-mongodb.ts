import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import { createConnectionSafePassword, MongoDBConfig } from "../adapters/mongodb";
import { StorageConfig, createPVCSpec } from "../adapters/storage";
import { DOCKER_IMAGES } from "../docker-images";

/**
 * MongoDB architecture options
 */
export enum MongoDBArchitecture {
  STANDALONE = "standalone",
  REPLICASET = "replicaset",
}

/**
 * Configuration for the BasicMongoDB component
 */
export interface BasicMongoDBArgs {
  /** Kubernetes namespace to deploy MongoDB into */
  namespace: pulumi.Input<string>;
  
  /** MongoDB architecture (standalone or replicaset) */
  architecture?: pulumi.Input<MongoDBArchitecture>;
  
  /** Custom password for MongoDB authentication (if not provided, a random one will be generated) */
  password?: pulumi.Input<string>;
  
  /** MongoDB database name (defaults to 'admin') */
  database?: pulumi.Input<string>;
  
  /** MongoDB username (defaults to 'root') */
  username?: pulumi.Input<string>;
  
  /** Storage configuration for MongoDB persistence (defaults to 8Gi) */
  storage?: StorageConfig;
  
  /** Memory limit for MongoDB container */
  memoryLimit?: pulumi.Input<string>;
  
  /** CPU limit for MongoDB container */
  cpuLimit?: pulumi.Input<string>;
  
  /** Memory request for MongoDB container */
  memoryRequest?: pulumi.Input<string>;
  
  /** CPU request for MongoDB container */
  cpuRequest?: pulumi.Input<string>;
  
  /** Custom Docker image to use for MongoDB */
  image?: pulumi.Input<string>;
  
  /** Number of replicas (only for replicaset architecture) */
  replicaCount?: pulumi.Input<number>;
  
  /** Enable arbiter (only for replicaset architecture) */
  arbiterEnabled?: pulumi.Input<boolean>;
  
  /** Replica set name (only for replicaset architecture) */
  replicaSetName?: pulumi.Input<string>;
  
  /** Replica set key for internal authentication (only for replicaset architecture) */
  replicaSetKey?: pulumi.Input<string>;
}

/**
 * BasicMongoDB component - provides NoSQL document database using official MongoDB image
 * 
 * @example
 * ```typescript
 * import { BasicMongoDB } from "../components/basic-mongodb";
 * 
 * const mongodb = new BasicMongoDB("database", {
 *   namespace: "mongodb-system",
 *   database: "myapp",
 *   architecture: MongoDBArchitecture.REPLICASET,
 *   replicaCount: 3,
 *   storage: {
 *     size: "20Gi",
 *     storageClass: "fast-ssd"
 *   },
 * });
 * 
 * // Access the generated password
 * const password = mongodb.password.result;
 * ```
 * 
 * @see https://www.mongodb.com/
 */
export class BasicMongoDB extends pulumi.ComponentResource {
  /** The StatefulSet deployment */
  public readonly statefulSet: k8s.apps.v1.StatefulSet;
  
  /** The Service for MongoDB */
  public readonly service: k8s.core.v1.Service;
  
  /** The generated or provided password for MongoDB authentication */
  public readonly password: ReturnType<typeof createConnectionSafePassword>;
  
  /** The generated or provided replica set key for internal authentication */
  public readonly replicaSetKey?: ReturnType<typeof createConnectionSafePassword>;

  /** Private connection configuration base - single source of truth */
  private readonly connectionConfigBase: {
    username: pulumi.Input<string>;
    database: pulumi.Input<string>;
    architecture: pulumi.Input<MongoDBArchitecture>;
    replicaSetName?: pulumi.Input<string>;
  };

  constructor(name: string, args: BasicMongoDBArgs, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:components:BasicMongoDB", name, args, opts);

    const architecture = args.architecture || MongoDBArchitecture.STANDALONE;
    const username = args.username || "root";
    const database = args.database || "admin";
    const replicaCount = args.replicaCount || 3;
    const replicaSetName = args.replicaSetName || "rs0";
    const image = args.image || DOCKER_IMAGES.MONGODB.image;

    // Store connection config base
    this.connectionConfigBase = {
      username,
      database,
      architecture,
      replicaSetName: pulumi.output(architecture).apply(arch => 
        arch === MongoDBArchitecture.REPLICASET ? replicaSetName : undefined
      ) as pulumi.Input<string> | undefined,
    };

    // Generate password if not provided
    this.password = args.password 
      ? { result: pulumi.output(args.password) } as any
      : createConnectionSafePassword(`${name}-password`, 32, { parent: this });

    // Generate replica set key if needed
    if (pulumi.output(architecture).apply(arch => arch === MongoDBArchitecture.REPLICASET)) {
      this.replicaSetKey = args.replicaSetKey
        ? { result: pulumi.output(args.replicaSetKey) } as any
        : createConnectionSafePassword(`${name}-replica-set-key`, 32, { parent: this });
    }

    // Create ConfigMap for initialization scripts
    const initConfigMap = new k8s.core.v1.ConfigMap(`${name}-init`, {
      metadata: {
        name: `${name}-init`,
        namespace: args.namespace,
      },
      data: {
        "init-mongo.sh": pulumi.all([
          architecture,
          this.password.result,
          username,
          database,
          replicaSetName,
          this.replicaSetKey?.result,
          replicaCount,
        ]).apply(([arch, password, user, _db, rsName, _rsKey, replicas]) => {
          if (arch === MongoDBArchitecture.STANDALONE) {
            return `#!/bin/bash
set -e

echo "Initializing standalone MongoDB..."

# Wait for MongoDB to be ready
until mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  echo "Waiting for MongoDB to be ready..."
  sleep 2
done

# Create root user
mongosh admin --eval "
  db.createUser({
    user: '${user}',
    pwd: '${password}',
    roles: [
      { role: 'root', db: 'admin' }
    ]
  })
"

echo "MongoDB initialization complete"
`;
          } else {
            return `#!/bin/bash
set -e

echo "Initializing MongoDB replica set..."

# Get pod ordinal from hostname
ORDINAL=\${HOSTNAME##*-}

# Wait for MongoDB to be ready
until mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  echo "Waiting for MongoDB to be ready..."
  sleep 2
done

# Only initialize on the first pod
if [ "\$ORDINAL" = "0" ]; then
  echo "Initializing replica set on primary..."
  
  # Initialize replica set
  mongosh --eval "
    rs.initiate({
      _id: '${rsName}',
      members: [
        ${Array.from({ length: replicas }, (_, i) => 
          `{ _id: ${i}, host: '${name}-${i}.${name}-headless:27017' }`
        ).join(',\n        ')}
      ]
    })
  "
  
  # Wait for replica set to be ready
  sleep 10
  
  # Create root user with replica set key
  mongosh admin --eval "
    db.createUser({
      user: '${user}',
      pwd: '${password}',
      roles: [
        { role: 'root', db: 'admin' }
      ]
    })
  "
  
  echo "Replica set initialization complete"
else
  echo "Waiting for primary to initialize replica set..."
  sleep 30
fi
`;
          }
        }),
      },
    }, { parent: this });

    // Create headless service for StatefulSet
    new k8s.core.v1.Service(`${name}-headless`, {
      metadata: {
        name: `${name}-headless`,
        namespace: args.namespace,
      },
      spec: {
        clusterIP: "None",
        selector: {
          app: name,
        },
        ports: [{
          port: 27017,
          targetPort: 27017,
          name: "mongodb",
        }],
      },
    }, { parent: this });

    // Create main service
    this.service = new k8s.core.v1.Service(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      spec: {
        selector: {
          app: name,
        },
        ports: [{
          port: 27017,
          targetPort: 27017,
          name: "mongodb",
        }],
      },
    }, { parent: this });

    // Create StatefulSet
    const replicas = pulumi.output(architecture).apply(arch => 
      arch === MongoDBArchitecture.STANDALONE ? 1 : replicaCount
    ) as pulumi.Input<number>;

    this.statefulSet = new k8s.apps.v1.StatefulSet(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
      spec: {
        serviceName: `${name}-headless`,
        replicas: replicas,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            containers: [{
              name: "mongodb",
              image: image,
              ports: [{
                containerPort: 27017,
                name: "mongodb",
              }],
              env: [
                {
                  name: "MONGO_INITDB_ROOT_USERNAME",
                  value: username,
                },
                {
                  name: "MONGO_INITDB_ROOT_PASSWORD",
                  value: this.password.result,
                },
                {
                  name: "MONGO_INITDB_DATABASE",
                  value: database,
                },
              ],
              volumeMounts: [
                {
                  name: "data",
                  mountPath: "/data/db",
                },
                {
                  name: "init-scripts",
                  mountPath: "/docker-entrypoint-initdb.d",
                },
              ],
              resources: {
                requests: {
                  memory: args.memoryRequest || "256Mi",
                  cpu: args.cpuRequest || "100m",
                },
                limits: {
                  memory: args.memoryLimit || "512Mi",
                  cpu: args.cpuLimit || "500m",
                },
              },
              livenessProbe: {
                tcpSocket: {
                  port: 27017,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
              },
              readinessProbe: {
                tcpSocket: {
                  port: 27017,
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 5,
              },
            }],
            volumes: [{
              name: "init-scripts",
              configMap: {
                name: initConfigMap.metadata.name,
                defaultMode: 0o755,
              },
            }],
          },
        },
        volumeClaimTemplates: [{
          metadata: {
            name: "data",
          },
          spec: createPVCSpec(args.storage || { size: "8Gi" }),
        }],
      },
    }, { parent: this });

    this.registerOutputs({
      statefulSet: this.statefulSet,
      service: this.service,
      password: this.password,
      replicaSetKey: this.replicaSetKey,
    });
  }

  /**
   * Returns connection configuration for MongoDB
   * @returns MongoDB connection configuration
   */
  public getConnectionConfig(): MongoDBConfig {
    const serviceName = this.service.metadata.name;
    const namespace = this.service.metadata.namespace;
    
    // For replica sets, we need to provide additional hosts
    const additionalHosts = pulumi.all([
      this.connectionConfigBase.architecture,
      this.statefulSet.spec.replicas || 3,
      this.statefulSet.metadata.name,
      serviceName,
      namespace
    ]).apply(([arch, replicas, statefulSetName, svcName, ns]) => {
      if (arch === MongoDBArchitecture.REPLICASET && replicas > 1) {
        const hosts: pulumi.Input<string>[] = [];
        for (let i = 1; i < replicas; i++) {
          hosts.push(pulumi.interpolate`${statefulSetName}-${i}.${svcName}-headless.${ns}.svc.cluster.local:27017`);
        }
        return hosts;
      }
      return undefined;
    });
    
    return {
      host: pulumi.interpolate`${serviceName}.${namespace}.svc.cluster.local`,
      port: 27017,
      username: this.connectionConfigBase.username,
      password: this.password.result,
      database: this.connectionConfigBase.database,
      authDatabase: "admin",
      replicaSet: this.connectionConfigBase.replicaSetName,
      additionalHosts: additionalHosts as any,
    };
  }
}