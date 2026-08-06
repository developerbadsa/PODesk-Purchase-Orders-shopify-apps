import { promises as fs } from "fs";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { shopifyApiProject, ApiType } from "@shopify/api-codegen-preset";
import type { IGraphQLConfig } from "graphql-config";

async function getConfig(): Promise<IGraphQLConfig> {
  const config: IGraphQLConfig = {
    projects: {
      default: shopifyApiProject({
        apiType: ApiType.Admin,
        apiVersion: ApiVersion.July26, // Align with shopify.app.toml
        documents: ["./app/**/*.{js,ts,jsx,tsx}", "./app/.server/**/*.{js,ts,jsx,tsx}"],
        outputDir: "./app/types",
      }),
    },
  };

  let extensions: string[] = [];
  try {
    extensions = await fs.readdir("./extensions");
  } catch {
    // ignore if no extensions
  }

  for (const entry of extensions) {
    const extensionPath = `./extensions/${entry}`;
    const schema = `${extensionPath}/schema.graphql`;
    try {
      await fs.access(schema);
      config.projects[entry] = {
        schema,
        documents: [`${extensionPath}/**/*.graphql`],
      };
    } catch {
      // schema file doesn't exist, so we skip this extension
    }
  }

  return config;
}

// As getConfig is now async, we need to export a promise
export default getConfig();
