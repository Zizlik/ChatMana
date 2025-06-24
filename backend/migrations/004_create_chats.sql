-- Create chats table for managing customer conversations
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform_chat_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(social_connection_id, platform_chat_id)
);

-- Create indexes for performance
CREATE INDEX idx_chats_tenant_id ON chats(tenant_id);
CREATE INDEX idx_chats_social_connection_id ON chats(social_connection_id);
CREATE INDEX idx_chats_tenant_status ON chats(tenant_id, status);
CREATE INDEX idx_chats_assigned_user ON chats(assigned_user_id);
CREATE INDEX idx_chats_last_interaction ON chats(last_interaction DESC);
CREATE INDEX idx_chats_platform_chat_id ON chats(platform_chat_id);
CREATE INDEX idx_chats_customer_email ON chats(customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX idx_chats_customer_phone ON chats(customer_phone) WHERE customer_phone IS NOT NULL;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add row-level security (RLS) for tenant isolation
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY chats_tenant_isolation ON chats
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comments for documentation
COMMENT ON TABLE chats IS 'Customer chat conversations from social media platforms';
COMMENT ON COLUMN chats.social_connection_id IS 'Reference to the social media connection this chat belongs to';
COMMENT ON COLUMN chats.tenant_id IS 'Tenant this chat belongs to';
COMMENT ON COLUMN chats.platform_chat_id IS 'Platform-specific chat/conversation identifier (customer ID, thread ID, etc.)';
COMMENT ON COLUMN chats.status IS 'Current status of the chat: open, closed, or pending';
COMMENT ON COLUMN chats.customer_name IS 'Customer display name (if available)';
COMMENT ON COLUMN chats.customer_phone IS 'Customer phone number (if available)';
COMMENT ON COLUMN chats.customer_email IS 'Customer email address (if available)';
COMMENT ON COLUMN chats.assigned_user_id IS 'User assigned to handle this chat';
COMMENT ON COLUMN chats.last_interaction IS 'Timestamp of the last message or activity in this chat';