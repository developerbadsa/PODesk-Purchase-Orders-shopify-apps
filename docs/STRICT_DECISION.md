# Strict Decision

Date: 2026-08-02

## Final Product Decision

Build:

> PODesk: Purchase Orders

Use as campaign:

> Stocky Rescue by PODesk

## Honest Reality

There are 29 days until the Stocky shutdown date of 2026-08-31.

A complete production-ready Shopify inventory app is not realistic in 29 days as a solo founder. A serious app needs OAuth, sync jobs, bulk operations, webhooks, CSV import, supplier data, PO workflows, billing, support, and careful handling of wrong inventory numbers.

So the correct move is not "launch full app before Stocky dies."

The correct move is:

> Sell and validate the migration pain now, while building the narrowest useful product in parallel.

## What We Are Betting On

We are betting that a subset of Shopify merchants:

- used Stocky or Stocky-like workflows
- have 300+ SKUs
- use Shopify POS or multiple locations
- create purchase orders
- manage suppliers
- dislike spreadsheets
- do not want Cin7, Katana, Brightpearl, or NetSuite complexity

This is a real pain category. But demand must be proven with conversations and payment.

## What We Are Not Betting On

We are not betting that:

- App Store launch alone will produce fast sales
- merchants will trust a new app without proof
- a simple reorder formula is enough for all stores
- Stocky migration is clean and easy
- small stores will pay $99-$299/month
- we can beat mature competitors by features alone

## Main Risks

### Risk 1: Low Trust

Inventory data affects revenue. If numbers look wrong, the merchant loses trust quickly.

Mitigation:

- show source data
- show formula
- allow override
- export everything
- avoid automatically changing inventory in MVP

### Risk 2: Support Load

CSV imports and supplier mapping will be messy.

Mitigation:

- offer manual audit first
- limit early customers
- document import formats
- turn repeated manual fixes into product features

### Risk 3: Competitors Are Already Campaigning

Prediko, Fabrikator, Inventory Planner, Cin7, Katana, and smaller apps already target this market.

Mitigation:

- do not claim to be better than all of them
- start with a very specific promise: Stocky workflow rescue + simple PO system
- win small merchants who want simple and guided migration

### Risk 4: Shopify Native Improvements

Shopify is improving inventory and PO workflows.

Mitigation:

- do not compete on basic inventory counts
- focus on suppliers, POs, reorder assumptions, migration, reporting, and workflow

## Kill Criteria

Stop or reposition if after 60-90 days:

- fewer than 5 merchants agree to a serious call
- no merchant shares real inventory/PO workflow data
- no merchant agrees to pay for audit, setup, or early access
- every prospect says native Shopify is enough
- support complexity is too high for a solo founder

## Continue Criteria

Continue if within 30-45 days:

- 5+ quality calls happen
- 2+ merchants send real CSV/export/workflow samples
- 1+ merchant pays for migration audit or setup
- repeated pain is around POs, suppliers, receiving, reorder decisions, or Stocky migration

## Strict Next Step

Before coding the full app:

> Get real merchant conversations.

Code without discovery is not progress here.
