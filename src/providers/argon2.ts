import * as pulumi from "@pulumi/pulumi";

export interface Argon2HashResourceInputs {
  password: pulumi.Input<string>;
  memoryCost?: pulumi.Input<number>;
  timeCost?: pulumi.Input<number>;
  parallelism?: pulumi.Input<number>;
  saltLength?: pulumi.Input<number>;
  hashLength?: pulumi.Input<number>;
  variant?: pulumi.Input<"id" | "i" | "d">;
  salt?: pulumi.Input<string>;
}

export interface Argon2HashInputs {
  password: string;
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  saltLength?: number;
  hashLength?: number;
  variant?: "id" | "i" | "d";
  salt?: string;
}

export class Argon2HashProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: Argon2HashInputs) {
    const argon2 = await import("argon2");
    const crypto = await import("crypto");

    const salt = inputs.salt || crypto.randomBytes(inputs.saltLength || 32).toString("base64");
    const argon2Type = this.getArgon2Type(inputs.variant || "id", argon2);

    const hash = await argon2.hash(inputs.password, {
      type: argon2Type as 0 | 1 | 2,
      memoryCost: inputs.memoryCost || 65540,
      timeCost: inputs.timeCost || 3,
      parallelism: inputs.parallelism || 4,
      hashLength: inputs.hashLength || 32,
      salt: Buffer.from(salt, "base64")
    });

    const outputs = {
      hash,
      salt,
      memoryCost: inputs.memoryCost || 65540,
      timeCost: inputs.timeCost || 3,
      parallelism: inputs.parallelism || 4,
      variant: inputs.variant || "id"
    };

    return {
      id: crypto.randomBytes(16).toString("hex"),
      outs: outputs
    };
  }

  async update(_id: string, _olds: any, news: Argon2HashInputs) {
    const createResult = await this.create(news);
    return { outs: createResult.outs };
  }

  async delete(_id: string, _props: any) {
    // Nothing to delete for password hashes
  }

  private getArgon2Type(variant: string, argon2: any): number {
    switch (variant) {
      case "d":
        return argon2.argon2d;
      case "i":
        return argon2.argon2i;
      case "id":
      default:
        return argon2.argon2id;
    }
  }
}

export class Argon2Hash extends pulumi.dynamic.Resource {
  public readonly hash!: pulumi.Output<string>;
  public readonly salt!: pulumi.Output<string>;
  public readonly memoryCost!: pulumi.Output<number>;
  public readonly timeCost!: pulumi.Output<number>;
  public readonly parallelism!: pulumi.Output<number>;
  public readonly variant!: pulumi.Output<string>;

  constructor(name: string, args: Argon2HashResourceInputs, opts?: pulumi.CustomResourceOptions) {
    super(new Argon2HashProvider(), name, {
      hash: undefined,
      salt: undefined,
      memoryCost: undefined,
      timeCost: undefined,
      parallelism: undefined,
      variant: undefined,
      ...args
    }, opts);
  }
}
