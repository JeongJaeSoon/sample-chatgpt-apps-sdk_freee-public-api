import { Router, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { tokenModel } from '../db/models/token';
import { FreeeClient } from '../freee/client';
import { config } from '../config/env';
import { invoiceTools } from './tools/invoices';
import { accountingTools } from './tools/accounting';

const router = Router();

// JWT secret as Uint8Array
const jwtSecretKey = new TextEncoder().encode(config.jwtSecret);

// Tool registry
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (client: FreeeClient, companyId: number, args: Record<string, unknown>) => Promise<unknown>;
}

const tools: Tool[] = [...invoiceTools, ...accountingTools];

// Tool map for quick lookup
const toolMap = new Map(tools.map(t => [t.name, t]));

/**
 * MCP Server endpoint
 * Handles JSON-RPC 2.0 requests from ChatGPT
 */
router.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendMcpError(res, null, -32001, 'Unauthorized: Missing or invalid Authorization header', {
        'WWW-Authenticate': `Bearer realm="${config.baseUrl}"`,
      });
    }

    const accessToken = authHeader.slice(7);

    // Verify JWT
    let payload;
    try {
      const result = await jwtVerify(accessToken, jwtSecretKey, {
        issuer: config.baseUrl,
        audience: config.baseUrl,
      });
      payload = result.payload;
    } catch {
      return sendMcpError(res, null, -32001, 'Unauthorized: Invalid access token', {
        'WWW-Authenticate': `Bearer realm="${config.baseUrl}", error="invalid_token"`,
      });
    }

    // Find token mapping to get freee credentials
    const token = tokenModel.findByAccessToken(accessToken);
    if (!token || !tokenModel.isValid(token)) {
      return sendMcpError(res, null, -32001, 'Unauthorized: Token not found or expired');
    }

    // Create freee client
    const freeeClient = new FreeeClient(token);

    // Parse JSON-RPC request
    const rpcRequest = req.body;
    const { jsonrpc, method, params, id } = rpcRequest;

    if (jsonrpc !== '2.0') {
      return sendMcpError(res, id, -32600, 'Invalid Request: jsonrpc must be "2.0"');
    }

    console.log(`[MCP] Received request: ${method}`);

    // Handle MCP methods
    switch (method) {
      case 'initialize':
        return handleInitialize(res, id);

      case 'tools/list':
        return handleToolsList(res, id);

      case 'tools/call':
        return handleToolsCall(res, id, params, freeeClient, token.company_id || 0);

      default:
        return sendMcpError(res, id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    console.error('[MCP] Error:', error);
    return sendMcpError(res, null, -32603, 'Internal error');
  }
});

function handleInitialize(res: Response, id: unknown): void {
  const response = {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'freee-chatgpt-apps-sdk',
        version: '1.0.0',
      },
    },
  };
  res.json(response);
}

function handleToolsList(res: Response, id: unknown): void {
  const toolList = tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  const response = {
    jsonrpc: '2.0',
    id,
    result: {
      tools: toolList,
    },
  };
  res.json(response);
}

async function handleToolsCall(
  res: Response,
  id: unknown,
  params: { name: string; arguments?: Record<string, unknown> },
  freeeClient: FreeeClient,
  companyId: number
): Promise<void> {
  const { name, arguments: args = {} } = params;

  const tool = toolMap.get(name);
  if (!tool) {
    return sendMcpError(res, id, -32602, `Unknown tool: ${name}`);
  }

  try {
    // Use company_id from args if provided, otherwise use from token
    const effectiveCompanyId = (args.company_id as number) || companyId;

    if (!effectiveCompanyId) {
      return sendMcpError(res, id, -32602, 'company_id is required');
    }

    const result = await tool.handler(freeeClient, effectiveCompanyId, args);

    const response = {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
    res.json(response);
  } catch (error) {
    console.error(`[MCP] Tool ${name} error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return sendMcpError(res, id, -32603, `Tool execution failed: ${errorMessage}`);
  }
}

function sendMcpError(
  res: Response,
  id: unknown,
  code: number,
  message: string,
  headers?: Record<string, string>
): void {
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }

  const status = code === -32001 ? 401 : 200;
  res.status(status).json({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  });
}

export { router as mcpRouter };
