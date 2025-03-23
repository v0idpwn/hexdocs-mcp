 Hexdocs MCP

Unofficial, experimental MCP server for HexDocs, based in the search API.

Allows AI agents such as Claude or Cursor to search documentation in HexDocs.

## Prerequisites

- Node.js (v18 or later)
- npm

## Set up

1. Clone the repository:
   ```
   git clone https://github.com/v0idpwn/hexdocs-mcp.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the TypeScript code:
   ```
   npm run build
   ```

4. Set up the MCP in your agent. For claude code:
  ```
  claude mcp add hexdocs node /path/to/hexdocs-mcp/dist/index.js
  ```
