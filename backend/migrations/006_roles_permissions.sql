CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  system boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (role_id, permission)
);
INSERT INTO roles(id,name,description,system) VALUES
('owner','Owner','Full store administration',true),
('staff','Staff','Restricted store operations',false)
ON CONFLICT(id) DO NOTHING;
INSERT INTO role_permissions(role_id,permission)
SELECT 'owner', p FROM unnest(ARRAY[
  'dashboard:read','products:read','products:write','collections:write','inventory:write',
  'media:write','orders:read','orders:write','orders:refund','customers:read','content:write',
  'discounts:write','reviews:moderate','inquiries:respond','analytics:read','settings:write','staff:manage'
]) AS p
ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions(role_id);
