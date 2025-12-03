import { Router } from 'express';
import { getOAuthMetadata, getProtectedResourceMetadata } from '../config/env';

const router = Router();

// OAuth Authorization Server Metadata
// https://datatracker.ietf.org/doc/html/rfc8414
router.get('/.well-known/oauth-authorization-server', (_req, res) => {
  const metadata = getOAuthMetadata();
  res.json(metadata);
});

// OAuth Protected Resource Metadata
// Required by ChatGPT Apps SDK MCP authorization spec
router.get('/.well-known/oauth-protected-resource', (_req, res) => {
  const metadata = getProtectedResourceMetadata();
  res.json(metadata);
});

// OpenID Connect Discovery (optional, for broader compatibility)
router.get('/.well-known/openid-configuration', (_req, res) => {
  const metadata = getOAuthMetadata();
  res.json({
    ...metadata,
    // Additional OIDC fields
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
});

export { router as metadataRouter };
