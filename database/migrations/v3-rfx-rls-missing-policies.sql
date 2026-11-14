-- XPEND V3: Políticas RLS faltantes en tablas RFx (RLS activo sin policies = 0 filas visibles)
-- Ejecutar en proyecto vlyqrosqapwgzyovbqpg (o cualquier V3)

-- rfx_company_policies
DROP POLICY IF EXISTS "Users can view rfx policies from their company" ON rfx_company_policies;
CREATE POLICY "Users can view rfx policies from their company"
  ON rfx_company_policies FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage rfx company policies" ON rfx_company_policies;
CREATE POLICY "Admins manage rfx company policies"
  ON rfx_company_policies FOR ALL
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- rfx_template_variables (vía plantilla)
DROP POLICY IF EXISTS "Users can view rfx template variables" ON rfx_template_variables;
CREATE POLICY "Users can view rfx template variables"
  ON rfx_template_variables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfx_templates t
      WHERE t.id = rfx_template_variables.template_id
      AND t.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage rfx template variables" ON rfx_template_variables;
CREATE POLICY "Admins manage rfx template variables"
  ON rfx_template_variables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rfx_templates t
      WHERE t.id = rfx_template_variables.template_id
      AND t.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- rfx_project_versions
DROP POLICY IF EXISTS "Company users manage rfx project versions" ON rfx_project_versions;
CREATE POLICY "Company users manage rfx project versions"
  ON rfx_project_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_versions.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_versions.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- rfx_project_comments
DROP POLICY IF EXISTS "Users can view rfx project comments" ON rfx_project_comments;
CREATE POLICY "Users can view rfx project comments"
  ON rfx_project_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_comments.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert rfx project comments" ON rfx_project_comments;
CREATE POLICY "Users can insert rfx project comments"
  ON rfx_project_comments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_comments.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own rfx project comments" ON rfx_project_comments;
CREATE POLICY "Users can update own rfx project comments"
  ON rfx_project_comments FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_comments.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own rfx project comments" ON rfx_project_comments;
CREATE POLICY "Users can delete own rfx project comments"
  ON rfx_project_comments FOR DELETE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_comments.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- rfx_project_downloads
DROP POLICY IF EXISTS "Company users manage rfx project downloads" ON rfx_project_downloads;
CREATE POLICY "Company users manage rfx project downloads"
  ON rfx_project_downloads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_downloads.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_project_downloads.project_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- rfx_audit_log (columnas: entity_type, entity_id, action, changes, performed_by)
DROP POLICY IF EXISTS "Users can view rfx audit for company projects" ON rfx_audit_log;
CREATE POLICY "Users can view rfx audit for company projects"
  ON rfx_audit_log FOR SELECT
  USING (
    entity_type = 'project'
    AND EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_audit_log.entity_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert rfx audit for company projects" ON rfx_audit_log;
CREATE POLICY "Users can insert rfx audit for company projects"
  ON rfx_audit_log FOR INSERT
  WITH CHECK (
    performed_by = auth.uid()
    AND entity_type = 'project'
    AND EXISTS (
      SELECT 1 FROM rfx_projects p
      WHERE p.id = rfx_audit_log.entity_id
      AND p.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );
