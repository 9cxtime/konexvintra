/*
# Create AI operator workspace data

1. New Tables
- `operator_items` stores shared workspace records for this single-tenant operator app.
- `id` is the generated record identifier.
- `kind` identifies conversations, documents, and activity items.
- `title` stores the human-readable label.
- `payload` stores the structured record content.
- `created_at` records when the item was created.
- `updated_at` records when the item was last changed.

2. Security
- Row level security is enabled.
- The app is intentionally single-tenant with no sign-in screen, so anon and authenticated clients can use the workspace.
- Separate CRUD policies are created for each operation.

3. Important Notes
- This table keeps the operator workspace persistent across reloads.
- JSON payloads allow conversations and documents to evolve without destructive schema changes.
*/

CREATE TABLE IF NOT EXISTS operator_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('conversation', 'document', 'activity')),
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_items_kind_updated_idx ON operator_items (kind, updated_at DESC);

ALTER TABLE operator_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shared workspace items can be read" ON operator_items;
CREATE POLICY "Shared workspace items can be read" ON operator_items FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Shared workspace items can be created" ON operator_items;
CREATE POLICY "Shared workspace items can be created" ON operator_items FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Shared workspace items can be updated" ON operator_items;
CREATE POLICY "Shared workspace items can be updated" ON operator_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Shared workspace items can be deleted" ON operator_items;
CREATE POLICY "Shared workspace items can be deleted" ON operator_items FOR DELETE TO anon, authenticated USING (true);
