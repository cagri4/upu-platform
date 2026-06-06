const EN_MARKDOWN = `# Dealer Management — User Guide

## What the panel is for

The dealer panel is the **command center for your distributor business**. Manage dealers, products, orders and invoices from one screen; let the WhatsApp assistant handle the routine work.

Goal: stop taking phone orders and re-typing them into spreadsheets. Dealers order from their own storefront and the panel tracks everything.

## Managing dealers

Generate a **dealer invite** from the button above "Bayilerim" in the sidebar. The link goes to the dealer's phone via WhatsApp; they join with one tap.

- **Credit limit** is set on each dealer card. New orders auto-block when the limit is exceeded.
- **Payment term** in days (e.g. 30/45/60) is set on the dealer's profile.
- Deactivate a dealer with the "Active" toggle on their card.

## Adding and updating products

From "Ürünlerim" you can **add one by one** or **bulk import via Excel**. Each product carries:

- Stock count, unit, VAT
- Per-dealer-group pricing (optional)
- Image + description

When stock reaches 0 the panel raises a red warning; the storefront auto-marks it "Out of stock".

## Stock and visibility

You can expose some products only to specific dealers: product card > "Dealer Visibility" > select dealers. Others won't see the product on the storefront.

**Stock reservation**: when a dealer adds to cart, stock drops temporarily (15 min). If the order isn't confirmed it goes back. Two dealers can't claim the same unit simultaneously.

## Processing orders

"Siparişlerim" flow: **New → Confirmed → In transit → Delivered**.

- Tap a new order: dealer, line items, total, remaining credit limit are shown.
- "Confirm" → stock drops permanently + WA notification to the dealer.
- "Ship" → enter tracking number, share via WA.
- "Delivered" → invoice auto-generated.

## Invoicing and payments

When an order becomes "Delivered" the **invoice is automatic**. Manual invoice: "Fatura Aç" button.

When a dealer pays use "Ödeme Kaydet" to log it; the payment-term table refreshes. With Mollie the dealer can pay online (card/iDEAL) — the entry posts automatically and the invoice is closed.

## WhatsApp notifications

The dealer gets an automatic WA message for each event:

- Order confirmed / shipped / delivered
- Invoice issued
- Payment-term reminder (D-3, D-1, D-0)
- Restock notice

Use "Bildirimler" to toggle templates. All Meta UTILITY templates are ready in Dutch/Turkish/English.

## Credit limit and payment term

Each dealer has a **credit limit** + **payment term in days**. At order time:

- Open invoice total + new order must stay under the credit limit
- If exceeded the order is **auto-blocked** + the dealer gets a WA warning

The reminder cron runs **daily at 09:00 (TR time)**; D-3/D-1/D-0 reminders go out via WA automatically.

## Reports

Under "Raporlar":

- Revenue (daily / weekly / monthly)
- Top-selling products
- Most active dealers
- Outstanding payments
- Stock turnover

All exportable to PDF or email.

## FAQ

**Dealer forgot their password?** They send "giriş" to WA from their phone; a single-use link arrives.

**When can a new dealer not place an order?** When the credit limit is exceeded, the profile isn't approved, or the account is inactive.

**Wrong invoice issued?** Tap "Cancel" on the invoice card → a new one is generated. If Mollie payment was already taken, refund is processed separately.

**Does it work on mobile?** Yes, the panel is responsive. Basic operations (order confirm, payment log) also work directly from WhatsApp.

**Missing or incorrect topic?** Send "destek" via WA, we'll get back to you.
`;

export default EN_MARKDOWN;
