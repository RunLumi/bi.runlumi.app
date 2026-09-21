-- Dedicated-deployment fence: the serving D1 declares which customer deployment
-- it belongs to. Remote authorization (Control) and local identity must agree.
-- A serving database swapped from another environment or customer of the same
-- tenant fails the fence even when tenant_id and route_epoch happen to match.
CREATE TABLE serving_identity (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  customer_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  environment TEXT NOT NULL
) STRICT;