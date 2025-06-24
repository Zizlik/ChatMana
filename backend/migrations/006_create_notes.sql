-- Create notes table for internal notes about chats
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general' CHECK (note_type IN ('general', 'important', 'follow_up', 'escalation', 'resolution')),
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_notes_tenant_id ON notes(tenant_id);
CREATE INDEX idx_notes_chat_id ON notes(chat_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_chat_created ON notes(chat_id, created_at DESC);
CREATE INDEX idx_notes_note_type ON notes(note_type);
CREATE INDEX idx_notes_is_private ON notes(is_private);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add row-level security (RLS) for tenant isolation
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY notes_tenant_isolation ON notes
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Create RLS policy for private notes (only visible to creator)
CREATE POLICY notes_private_access ON notes
    FOR SELECT
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID 
        AND (
            is_private = false 
            OR user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- Add comments for documentation
COMMENT ON TABLE notes IS 'Internal notes about chat conversations for agents';
COMMENT ON COLUMN notes.chat_id IS 'Reference to the chat this note is about';
COMMENT ON COLUMN notes.tenant_id IS 'Tenant this note belongs to';
COMMENT ON COLUMN notes.user_id IS 'User who created this note';
COMMENT ON COLUMN notes.content IS 'Content of the note';
COMMENT ON COLUMN notes.note_type IS 'Type/category of the note';
COMMENT ON COLUMN notes.is_private IS 'Whether this note is private to the creator';