import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { metadataRouter } from './oauth/metadata';
import { dcrRouter } from './oauth/dcr';
import { authorizeRouter } from './oauth/authorize';
import { tokenRouter } from './oauth/token';
import { mcpRouter } from './mcp/server';

// Initialize database
import './db/index';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow OAuth redirects
}));

app.use(cors({
  origin: true, // Allow all origins for ChatGPT
  credentials: true,
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth metadata endpoints (/.well-known/*)
app.use(metadataRouter);

// OAuth endpoints
app.use(dcrRouter);      // POST /oauth/register
app.use(authorizeRouter); // GET /oauth/authorize, GET /oauth/callback
app.use(tokenRouter);     // POST /oauth/token

// MCP server endpoint
app.use(mcpRouter);       // POST /mcp

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'server_error',
    error_description: 'An unexpected error occurred',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'not_found',
    error_description: 'The requested resource was not found',
  });
});

// Start server
app.listen(config.port, () => {
  console.log('');
  console.log('========================================');
  console.log('  freee ChatGPT Apps SDK Server');
  console.log('========================================');
  console.log('');
  console.log(`Server running on port ${config.port}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('');
  console.log('OAuth Endpoints:');
  console.log(`  - Authorization:  ${config.baseUrl}/oauth/authorize`);
  console.log(`  - Token:          ${config.baseUrl}/oauth/token`);
  console.log(`  - DCR:            ${config.baseUrl}/oauth/register`);
  console.log('');
  console.log('Well-Known Endpoints:');
  console.log(`  - OAuth AS:       ${config.baseUrl}/.well-known/oauth-authorization-server`);
  console.log(`  - Protected Res:  ${config.baseUrl}/.well-known/oauth-protected-resource`);
  console.log('');
  console.log('MCP Endpoint:');
  console.log(`  - MCP Server:     ${config.baseUrl}/mcp`);
  console.log('');
  console.log('----------------------------------------');
  console.log('For testing with ngrok:');
  console.log('  1. Run: ngrok http 2091');
  console.log('  2. Update BASE_URL in .env with ngrok URL');
  console.log('  3. Update freee app callback URL');
  console.log('----------------------------------------');
  console.log('');
});

export default app;
