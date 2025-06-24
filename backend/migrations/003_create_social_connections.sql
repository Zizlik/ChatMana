-- Create social_connections table for storing encrypted social media tokens
CREATE TABLE social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'whatsapp', 'instagram')),
    platform_account_id VARCHAR(255) NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    scopes TEXT[],
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, platform, platform_account_id)
);

-- Create indexes for performance
CREATE INDEX idx_social_connections_tenant_id ON social_connections(tenant_id);
CREATE INDEX idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX idx_social_connections_tenant_platform ON social_connections(tenant_id, platform);
CREATE INDEX idx_social_connections_platform_account ON social_connections(platform, platform_account_id);
CREATE INDEX idx_social_connections_active ON social_connections(is_active);
CREATE INDEX idx_social_connections_expires ON social_connections(expires_at) WHERE expires_at IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_social_connections_updated_at 
    BEFORE UPDATE ON social_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add row-level security (RLS) for tenant isolation
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY social_connections_tenant_isolation ON social_connections
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comments for documentation
COMMENT ON TABLE social_connections IS 'Social media platform connections with encrypted tokens';
COMMENT ON COLUMN social_connections.user_id IS 'User who created this connection';
COMMENT ON COLUMN social_connections.tenant_id IS 'Tenant this connection belongs to';
COMMENT ON COLUMN social_connections.platform IS 'Social media platform: facebook, whatsapp, or instagram';
COMMENT ON COLUMN social_connections.platform_account_id IS 'Platform-specific account identifier (page ID, phone number ID, etc.)';
COMMENT ON COLUMN social_connections.encrypted_access_token IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN social_connections.encrypted_refresh_token IS 'AES-256-GCM encrypted refresh token (if available)';
COMMENT ON COLUMN social_connections.scopes IS 'Array of OAuth scopes granted';
COMMENT ON COLUMN social_connections.expires_at IS 'Token expiration timestamp (if applicable)';
COMMENT ON COLUMN social_connections.is_active IS 'Whether this connection is active and should be used';