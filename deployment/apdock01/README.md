# TaxAP on apdock01

This deployment keeps TaxAP's read-only connector private inside a Docker network. Only the Nginx proxy publishes HTTPS on the host.

## Required before deployment

1. Atlantic IT approves an internal DNS name and provides read-only TLS certificate/key mount paths.
2. Create or obtain a non-interactive Microsoft Entra service principal with a certificate credential and the least Azure SQL/DWStage permissions required for TaxAP's existing SELECT-only queries. Store the combined PEM (public certificate and private key) only at `/var/atlanticapps/taxap/secrets/azure-sql-client-cert.pem`; Compose mounts it read-only at `/run/secrets/azure-sql-client-cert.pem`. Do not use a personal Azure CLI login, SQL password, or client secret.
3. The identity and Azure SQL firewall/private-link policy are validated in a supervised, read-only session.
4. Copy `.env.example` to `.env` on `apdock01`, fill only approved settings, and keep `.env` out of source control.

## Deploy after approval

```bash
cd /var/atlanticapps/taxap
docker compose -f deployment/apdock01/docker-compose.yml up -d --build
```

Verify the public web container and private connector health through the approved internal URL. Do not publish port 3001 or bypass the proxy.

## Authentication

This Compose configuration deliberately does not add Entra user sign-in yet. Before Ana or Liv receive broad access, place the existing approved OAuth2-proxy pattern in front of `taxap-proxy`, configure a single-tenant Entra app registration, and restrict access to Ana, Liv, and approved IT administrators.
