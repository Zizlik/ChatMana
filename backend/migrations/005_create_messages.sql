-- Create messages table for storing chat messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform_message_id VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'reaction')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    media_url VARCHAR(500),
    media_type VARCHAR(100),
    media_size INTEGER,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_messages_tenant_id ON messages(tenant_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_platform_message_id ON messages(platform_message_id) WHERE platform_message_id IS NOT NULL;
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_sender_type ON messages(sender_type);
CREATE INDEX idx_messages_sender_id ON messages(sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_messages_is_read ON messages(is_read) WHERE is_read = false;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_metadata ON messages USING GIN(metadata);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update chat's last_interaction when message is inserted
CREATE OR REPLACE FUNCTION update_chat_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats 
    SET last_interaction = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_last_interaction_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_last_interaction();

-- Add row-level security (RLS) for tenant isolation
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY messages_tenant_isolation ON messages
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comments for documentation
COMMENT ON TABLE messages IS 'Individual messages within chat conversations';
COMMENT ON COLUMN messages.chat_id IS 'Reference to the chat this message belongs to';
COMMENT ON COLUMN messages.tenant_id IS 'Tenant this message belongs to';
COMMENT ON COLUMN messages.platform_message_id IS 'Platform-specific message identifier';
COMMENT ON COLUMN messages.message_type IS 'Type of message content (text, image, video, etc.)';
COMMENT ON COLUMN messages.direction IS 'Message direction: inbound (from customer) or outbound (to customer)';
COMMENT ON COLUMN messages.sender_type IS 'Type of sender: customer, agent, or system';
COMMENT ON COLUMN messages.sender_id IS 'User ID if message was sent by an agent';
COMMENT ON COLUMN messages.content IS 'Text content of the message';
COMMENT ON COLUMN messages.media_url IS 'URL to media file if message contains media';
COMMENT ON COLUMN messages.media_type IS 'MIME type of media file';
COMMENT ON COLUMN messages.media_size IS 'Size of media file in bytes';
COMMENT ON COLUMN messages.metadata IS 'Additional platform-specific metadata as JSON';
COMMENT ON COLUMN messages.is_read IS 'Whether the message has been read by the recipient';
COMMENT ON COLUMN messages.delivered_at IS 'Timestamp when message was delivered';
COMMENT ON COLUMN messages.read_at IS 'Timestamp when message was read';