import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export const secretValue = config.requireSecret("secret-value");
