# infra

What the console runs on. Not started yet.

## What belongs here

- Terraform for the managed environments
- networking, including the NetworkPolicy topology that makes the enforcement boundary real
- database provisioning
- secret storage wiring
- DNS and certificates

## Note

Multi-tenancy isolation is designed here, not in application code. A cross-tenant finding ends an enterprise evaluation, so the isolation model must be documented and tested at this layer.
