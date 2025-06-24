-- Create user_sessions table for managing user authentication sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_used_at ON user_sessions(last_used_at DESC);
CREATE INDEX idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add row-level security (RLS) for tenant isolation
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY user_sessions_tenant_isolation ON user_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Create RLS policy for user access (users can only see their own sessions)
CREATE POLICY user_sessions_user_access ON user_sessions
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID 
        AND user_id = current_setting('app.current_user_id', true)::UUID
    );

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'User authentication sessions with refresh tokens';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to the user this session belongs to';
COMMENT ON COLUMN user_sessions.tenant_id IS 'Tenant this session belongs to';
COMMENT ON COLUMN user_sessions.refresh_token_hash IS 'Hashed refresh token for session validation';
COMMENT ON COLUMN user_sessions.device_info IS 'Device information as JSON (browser, OS, etc.)';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address where session was created';
COMMENT ON COLUMN user_sessions.user_agent IS 'User agent string from the client';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether this session is currently active';
COMMENT ON COLUMN user_sessions.expires_at IS 'When this session expires';
COMMENT ON COLUMN user_sessions.last_used_at IS 'When this session was last used';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Function to clean up expired and inactive sessions';