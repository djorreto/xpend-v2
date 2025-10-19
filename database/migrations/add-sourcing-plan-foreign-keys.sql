-- Migration: Add sourcing_plan_id to licitaciones and projects
-- Date: 2025-10-19
-- Description: Add foreign key columns to link licitaciones and projects with sourcing plans

-- Add sourcing_plan_id to licitaciones table
ALTER TABLE licitaciones
ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_licitaciones_sourcing_plan
ON licitaciones(sourcing_plan_id)
WHERE sourcing_plan_id IS NOT NULL;

-- Add sourcing_plan_id to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_sourcing_plan
ON projects(sourcing_plan_id)
WHERE sourcing_plan_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN licitaciones.sourcing_plan_id IS 'Link to the sourcing plan initiative (optional)';
COMMENT ON COLUMN projects.sourcing_plan_id IS 'Link to the sourcing plan initiative (optional)';

