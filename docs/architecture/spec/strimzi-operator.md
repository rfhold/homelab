# Strimzi Operator Ownership

## Contract

- The platform MUST manage the Strimzi operator through a standalone Pulumi program.
- The operator program MUST install the operator into its own namespace and MUST NOT create application Kafka clusters or topics.
- A workload-owning stack MUST define and configure the Kafka clusters and topics used by that workload.
- A workload stack that creates Strimzi custom resources MUST require the operator to be available first, and the supported deployment documentation or automation MUST make that order explicit.

This ownership boundary keeps operator lifecycle separate from application Kafka sizing and topic policy.
