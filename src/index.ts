import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Typesense from "typesense";
import axios from "axios";
import { z } from "zod";
import { SearchResponse } from "typesense/lib/Typesense/Documents.js";

// Create an MCP server
const server = new McpServer({
  name: "Hexdocs search",
  version: "1.0.0",
});

const hexdocs_search_url = "https://search.hexdocs.pm";
const hex_packages_url = "https://hex.pm/api/packages/";

// Queries hex.pm API to fetch latest packages version
//
// Necessary because hexdocs endpoint needs package version
async function getPackagesLatestVsn(packages: string[]): Promise<string[]> {
  const fetchPromises = packages.map(async (packageName) => {
    try {
      const response = await axios.get(`${hex_packages_url}/${packageName}`);
      const version = response.data && response.data.releases[0].version;

      if (version) {
        return `${packageName}-${version}`;
      } else {
        return null;
      }
    } catch (error) {
      // :)
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  return results.filter((result): result is string => result !== null);
}

async function searchRequest(query: string, packages: Array<string>) {
  try {
    let packagesWithVsn = (await getPackagesLatestVsn(packages)).join("&");
    const response = await axios.get(
      `${hexdocs_search_url}?q=${encodeURIComponent(query)}&query_by=doc,title&filter_by=package:=${encodeURIComponent(packagesWithVsn)}"&filter_by=type:=function&module`,
    );
    return response.data;
  } catch (error) {
    return null;
  }
}

function resultsAsString(results: SearchResponse<any>): string {
  let output = `Found ${results.found || 0} results for "${results.request_params?.q || "unknown query"}"\n\n`;

  if (!results.hits || results.hits.length === 0) {
    return output + "No results found.";
  }

  results.hits.forEach((hit, index) => {
    const doc = hit.document;

    output += `${index + 1}. ${doc.title} [${doc.package}]\n`;
    output += `   Ref: ${doc.ref}\n`;
    output += `   Type: ${doc.type}\n\n`;

    // Include the full document content
    if (doc.doc) {
      output += `${doc.doc}\n`;
    }

    output += "\n----------\n\n";
  });

  return output;
}

server.tool(
  "search",
  "Searches documentation from any existing elixir package. Expects a list of packages to search on, and a term to search for.",
  { packages: z.array(z.string()), query: z.string() },
  async ({ packages, query }) => {
    let searchResults = await searchRequest(query, packages);

    return {
      content: [{ type: "text", text: resultsAsString(searchResults) }],
    };
  },
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
