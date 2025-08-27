---
id: frontend-ui
title: Frontend Web Interface
sidebar_label: Frontend UI
---

# Frontend Web Interface

The OAS-MCP project includes a React-based web interface that provides a user-friendly way to configure OpenAPI specifications as MCP servers. The frontend eliminates the need for manual JSON configuration and credential management.

## Overview

The frontend UI is a single-page application built with React and Vite that allows you to:

- **Upload or paste OpenAPI specs** (JSON/YAML format)
- **Configure server settings** (base URL, schema URL, server name, etc.)
- **Manage authentication credentials** securely
- **Generate MCP server configurations** automatically
- **Track connected MCP servers** in your workspace

## Getting Started

### Running the Frontend

1. **Start the OAS-MCP server** (required for credential storage):
   ```bash
   npx oas-mcp serve --port 8080 --cred-store file
   ```

2. **Start the frontend development server**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Open the interface** at `http://localhost:5173`

### Production Build

To build the frontend for production deployment:

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/` and can be served by any static web server.

## Features

### 1. Spec Upload & Validation

The interface supports multiple ways to provide your OpenAPI specification:

- **Paste directly**: Copy/paste JSON or YAML spec content
- **File upload**: Upload `.json`, `.yaml`, or `.yml` files
- **Automatic validation**: Uses `@apidevtools/swagger-parser` for validation and dereferencing

### 2. Server Configuration

Configure your MCP server settings through an intuitive form:

| Setting | Description | Default |
|---------|-------------|---------|
| **Base URL** | API base URL (auto-detected from spec) | `https://api.example.com` |
| **Schema URL** | OpenAPI spec URL | Auto-generated suggestion |
| **Server Name** | MCP server identifier | `openapi` |
| **SSE Server URL** | OAS-MCP server endpoint | `http://127.0.0.1:8080` |

### 3. Authentication Management

Secure credential management with support for multiple authentication types:

#### Supported Auth Types
- **Bearer Token**: JWT or API tokens
- **API Key (Header)**: Custom header-based authentication
- **Basic Auth**: Username/password authentication
- **Raw Authorization Header**: Custom authorization values
- **Custom Headers**: JSON-based header configuration
- **None**: No authentication required

#### Credential Storage
- Credentials are stored **server-side** using the `/credentials` endpoint
- **Never included in URLs** for security
- Supports both memory and file-based credential stores
- File credentials can be **encrypted** with AES-GCM

### 4. Generated Configuration

The interface automatically generates MCP server configuration that you can:

- **Copy to clipboard**: Ready-to-use JSON snippet
- **Copy URL only**: Direct SSE connection string
- **Add to VS Code**: Paste into your `mcp.json` configuration

Example generated configuration:
```json
{
  "myapi": {
    "url": "http://127.0.0.1:8080/sse?s=https%3A%2F%2Fapi.example.com%2Fopenapi.json&u=https%3A%2F%2Fapi.example.com&n=myapi"
  }
}
```

### 5. Connected Servers Tracking

Keep track of configured MCP servers:

- **Local storage**: Persists server configurations across sessions
- **Server management**: View and remove connected servers
- **Metadata tracking**: Base URL, schema URL, and creation timestamps

## Security Considerations

### Credential Handling
- **No sensitive data in URLs**: Authentication tokens never appear in generated URLs
- **Server-side storage**: Credentials stored securely on the OAS-MCP server
- **Masked display**: Sensitive values are masked in the UI
- **Encryption support**: File-based credentials can be encrypted

### HTTPS Recommendations
For production use:
- Use HTTPS for both the OAS-MCP server and frontend
- Ensure OpenAPI schema URLs use HTTPS
- Configure proper CORS headers if hosting frontend separately

## File Structure

```
frontend/
├── src/
│   ├── modules/
│   │   ├── App.tsx              # Main application component
│   │   ├── ConfigForm.tsx       # Server configuration form
│   │   ├── GeneratedConfig.tsx  # Output configuration display
│   │   └── SpecUploader.tsx     # OpenAPI spec input component
│   ├── util/
│   │   ├── buildConfig.ts       # Configuration generation logic
│   │   └── parseSpec.ts         # OpenAPI spec parsing
│   ├── types.ts                 # TypeScript type definitions
│   └── main.tsx                # Application entry point
├── package.json
├── vite.config.ts
└── README.md
```

## Environment Setup

### Development Dependencies
- **React 18.3+**: UI framework
- **TypeScript 5.5+**: Type safety
- **Vite 5.3+**: Build tool and dev server
- **@apidevtools/swagger-parser**: OpenAPI validation
- **yaml**: YAML parsing support

### Browser Compatibility
Modern browsers with ES2020+ support required.

## Credential Store Integration

The frontend integrates with the OAS-MCP server's credential store system:

### File-based Credentials
When using `--cred-store file`, credentials are saved to:
```
.oas_mcps/creds.json
```

**⚠️ Important**: Add this directory to your `.gitignore`:
```gitignore
# OAS-MCP credential storage
.oas_mcps/
```

### Memory-based Credentials
When using `--cred-store memory`, credentials are lost when the server restarts.

## API Endpoints Used

The frontend communicates with these OAS-MCP server endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/credentials` | POST | Store authentication credentials |
| `/import-env-credentials` | POST | Import credentials from environment variables |
| `/sse` | GET | Establish MCP server connection |

## Troubleshooting

### Common Issues

**Spec validation fails**:
- Ensure your OpenAPI spec is valid JSON/YAML
- Check that the spec follows OpenAPI 3.x format
- Verify all `$ref` references can be resolved

**Credential save fails**:
- Ensure the OAS-MCP server is running
- Check that the SSE Server URL is correct
- Verify the server has write permissions for file storage

**Generated config doesn't work**:
- Ensure both schema URL and base URL are accessible
- Check that authentication credentials are properly saved
- Verify the MCP client can reach the SSE endpoint

### Debug Mode
Start the OAS-MCP server with `--debug` for detailed logging:
```bash
npx oas-mcp serve --debug --cred-store file
```

## Next Steps

After generating your MCP server configuration:

1. **Add to VS Code**: Copy the configuration to your `mcp.json` file
2. **Test the connection**: Verify the MCP server appears in your client
3. **Explore generated tools**: List and test the automatically generated tools
4. **Set up authentication**: Configure credentials for protected APIs

For more details on credential management, see [Adding Credentials](adding-credentials.md).
