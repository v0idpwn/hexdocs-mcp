import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { z } from "zod";
import {
  SearchResponse,
  DocumentSchema,
} from "typesense/lib/Typesense/Documents.js";

interface HexdocsDocument extends DocumentSchema {
  title: string;
  package: string;
  ref: string;
  type: string;
  doc?: string;
}

const server = new McpServer({
  name: "Hexdocs search",
  version: "1.0.0",
});

const HEXDOCS_SEARCH_URL = "https://search.hexdocs.pm";
const HEX_PACKAGES_URL = "https://hex.pm/api/packages/";

// Queries hex.pm API to fetch latest packages version
//
// Necessary because hexdocs endpoint needs package version
async function getPackagesLatestVsn(packages: string[]): Promise<string[]> {
  const fetchPromises = packages.map(async (packageName) => {
    try {
      const response = await axios.get(`${HEX_PACKAGES_URL}/${packageName}`);
      const version = response.data?.releases[0]?.version;

      if (version) {
        return `${packageName}-${version}`;
      } else {
        return null;
      }
    } catch (error) {
      // Silent fail for package not found
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  return results.filter((result): result is string => result !== null);
}

async function searchRequest(
  query: string,
  packages: string[],
): Promise<SearchResponse<HexdocsDocument> | null> {
  try {
    const packagesWithVsn = (await getPackagesLatestVsn(packages)).join("&");
    const response = await axios.get(
      `${HEXDOCS_SEARCH_URL}?q=${encodeURIComponent(query)}&query_by=doc,title&filter_by=package:=${encodeURIComponent(packagesWithVsn)}"`,
    );
    return response.data;
  } catch (error) {
    return null;
  }
}

function resultsAsString(
  results: SearchResponse<HexdocsDocument> | null,
): string {
  if (!results) {
    return "Error: Failed to retrieve search results.";
  }

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
    const searchResults = await searchRequest(query, packages);

    return {
      content: [{ type: "text", text: resultsAsString(searchResults) }],
    };
  },
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
