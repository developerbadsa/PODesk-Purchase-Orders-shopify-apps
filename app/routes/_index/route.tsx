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
          <div className={styles.badge}>Shopify purchase order workspace</div>
          <h1 className={styles.heading}>PODesk: Purchase Orders</h1>
          <p className={styles.text}>
            A focused purchasing app for Shopify merchants who need supplier
            records, SKU mappings, reorder planning, and purchase orders in one
            operational workspace.
          </p>
          <ul className={styles.assuranceList}>
            <li>Connects through Shopify&apos;s secure authorization flow.</li>
            <li>Uses read-only inventory access during the beta release.</li>
            <li>Does not write inventory levels back to your Shopify store.</li>
          </ul>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <img src="/brand/podesk-app-icon-small.png" alt="" className={styles.appIcon} />
            <div>
              <div className={styles.panelTitle}>Open PODesk</div>
              <div className={styles.panelText}>
                Enter your Shopify store domain to continue to app authorization.
              </div>
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
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  required
                />
                <button className={styles.button} type="submit">
                  Open app
                </button>
              </div>
            </Form>
          ) : null}

          <div className={styles.securityNote}>
            <div className={styles.securityTitle}>Before you continue</div>
            <p>
              Use your permanent Shopify domain, for example
              <span> your-store.myshopify.com</span>. Shopify will handle the
              login and permission approval screen.
            </p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>PODesk: Purchase Orders</span>
        <span>Support: podeskapp@gmail.com</span>
      </footer>
    </main>
  );
}
