import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function ImportsPage() {
  return (
    <s-page heading="Stocky import">
      <s-section heading="Import strategy">
        <s-paragraph>
          The first import version will be deliberately conservative. It will
          accept Stocky exports or merchant CSVs, preview rows, and let the
          merchant map columns before anything is saved.
        </s-paragraph>
      </s-section>

      <s-section heading="Planned import types">
        <s-unordered-list>
          <s-list-item>Suppliers and vendor contacts</s-list-item>
          <s-list-item>Purchase order archive</s-list-item>
          <s-list-item>SKU to supplier mapping</s-list-item>
          <s-list-item>Manual reorder settings</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Current status">
        <s-paragraph>
          CSV upload is not enabled yet. The dashboard already supports Shopify
          inventory sync, suppliers, basic POs, and reorder attention based on
          recent sales velocity.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
