# Project Brief: Backorder

## Overview
A modern, full-stack domain availability monitor designed for "Always-Free" cloud operations. It monitors target domains for availability changes and sends notifications when they become registerable.

## Core Goals
- **Cost Efficiency:** Run entirely on free tiers (Cloudflare Workers, D1, Pages).
- **Reliability:** Adaptive rate-limiting to prevent IP bans from RDAP servers.
- **Speed:** Faster signals than standard "change detection" tools.
- **Ease of Use:** A premium React-based dashboard for domain management.

## Success Criteria
- Deployment is fully automated via GitHub Actions.
- Zero-cost operational overhead.
- Scalable to hundreds of domains with intelligent backoff.
