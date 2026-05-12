-- Add test user
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt") 
VALUES (
  'test-user-id',
  'test@example.com',
  'Test User',
  '$2b$10$HvbUszPd.fR9x.OnXhJOMOai.rAG34hX7OaM07a4SKnparpncki..',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  "updatedAt" = NOW();

SELECT 'Test user created or already exists' as result;

-- Add MVP demo client, project, and activity
INSERT INTO "Client" (id, name, contact, email, phone, address, currency, status, "createdAt", "updatedAt")
VALUES (
  'demo-client-id',
  'Demo Client',
  NULL,
  'client@example.com',
  '+1 555 0100',
  'Demo address',
  'USD',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact = EXCLUDED.contact,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  "updatedAt" = NOW();

INSERT INTO "Project" (id, name, "clientId", description, "budgetHours", "budgetMoney", rate, status, "createdAt", "updatedAt")
VALUES (
  'demo-project-id',
  'MVP Project',
  'demo-client-id',
  'First project for time tracking MVP',
  120,
  12000,
  100,
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "clientId" = EXCLUDED."clientId",
  description = EXCLUDED.description,
  "budgetHours" = EXCLUDED."budgetHours",
  "budgetMoney" = EXCLUDED."budgetMoney",
  rate = EXCLUDED.rate,
  status = EXCLUDED.status,
  "updatedAt" = NOW();

INSERT INTO "Activity" (id, name, "projectId", rate, status, "createdAt")
VALUES (
  'demo-activity-id',
  'Development',
  'demo-project-id',
  120,
  'ACTIVE',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "projectId" = EXCLUDED."projectId",
  rate = EXCLUDED.rate,
  status = EXCLUDED.status;

INSERT INTO "Activity" (id, name, "projectId", rate, status, "createdAt")
VALUES (
  'global-general-activity-id',
  'General',
  NULL,
  NULL,
  'ACTIVE',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "projectId" = EXCLUDED."projectId",
  rate = EXCLUDED.rate,
  status = EXCLUDED.status;

INSERT INTO "_ProjectUsers" ("A", "B")
VALUES ('demo-project-id', 'test-user-id')
ON CONFLICT ("A", "B") DO NOTHING;

SELECT 'Demo client, project, and activity are ready' as result;

INSERT INTO "Organization" (id, name, inn, kpp, "createdAt", "updatedAt")
VALUES (
  'infolink-organization-id',
  'ООО «ИнфоЛинк»',
  '',
  '',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  inn = EXCLUDED.inn,
  kpp = EXCLUDED.kpp,
  "updatedAt" = NOW();

INSERT INTO "Department" (id, name, "organizationId", "createdAt", "updatedAt")
VALUES (
  'main-department-id',
  'Основное подразделение',
  'infolink-organization-id',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "organizationId" = EXCLUDED."organizationId",
  "updatedAt" = NOW();

INSERT INTO "Position" (id, title, "departmentId", "createdAt", "updatedAt")
VALUES (
  'admin-position-id',
  'Администратор системы',
  'main-department-id',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  "departmentId" = EXCLUDED."departmentId",
  "updatedAt" = NOW();

UPDATE "User"
SET "positionId" = 'admin-position-id'
WHERE email = 'test@example.com';

SELECT 'Organization structure is ready' as result;
