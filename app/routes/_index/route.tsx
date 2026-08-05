import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const params = url.searchParams.toString();

  if (
    url.searchParams.has("shop") ||
    url.searchParams.has("host") ||
    url.searchParams.has("embedded") ||
    url.searchParams.has("id_token")
  ) {
    throw redirect(`/app${params ? `?${params}` : ""}`);
  }

  return { showForm: Boolean(login) };
};

export default function IndexRoute() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="PODesk home">
          <img
            src="/brand/podesk-logo-header.png"
            alt="PODesk"
            className={styles.logo}
          />
        </a>
        <nav className={styles.nav} aria-label="Public links">
          <a href="/support">Support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.badge}>Free beta for Shopify merchants</div>
          <h1 className={styles.heading}>Purchase order control for growing Shopify stores.</h1>
          <p className={styles.text}>
            PODesk helps teams sync inventory, map suppliers, create clean purchase
            orders, and spot reorder risk before top-selling SKUs run out.
          </p>
          <div className={styles.points} aria-label="PODesk highlights">
            <span>Read-only Shopify sync</span>
            <span>Supplier SKU mapping</span>
            <span>Reorder planning</span>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <img src="/brand/podesk-app-icon-small.png" alt="" className={styles.appIcon} />
            <div>
              <div className={styles.panelTitle}>Open PODesk</div>
              <div className={styles.panelText}>Enter your Shopify store domain to continue.</div>
            </div>
          </div>

          {showForm ? (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label} htmlFor="shop-domain">
                Shop domain
              </label>
              <div className={styles.inputRow}>
                <input
                  id="shop-domain"
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  autoComplete="organization"
                  inputMode="url"
                  required
                />
                <button className={styles.button} type="submit">
                  Open app
                </button>
              </div>
            </Form>
          ) : null}

          <div className={styles.preview} aria-label="PODesk workflow preview">
            <div className={styles.previewRow}>
              <span>Low stock SKUs</span>
              <strong>12</strong>
            </div>
            <div className={styles.previewRow}>
              <span>Open purchase orders</span>
              <strong>8</strong>
            </div>
            <div className={styles.previewRow}>
              <span>Mapped suppliers</span>
              <strong>24</strong>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>PODesk: Purchase Orders</span>
        <span>Read-only inventory planning during beta.</span>
      </footer>
    </main>
  );
}
