import { requireSupabase } from '../lib/supabase.js';

export const APPROVAL_STATE_CHANGED_EVENT = 'groupware:approval-state-changed';
const announceApprovalChange = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(APPROVAL_STATE_CHANGED_EVENT)); };

const rpc = async (name, parameters = {}) => {
  const { data, error } = await requireSupabase().rpc(name, parameters);
  if (error) throw error;
  return data;
};

const normalizeVersion = (version) => {
  if (!version) return version;
  const rawFields = Array.isArray(version.form_schema) ? version.form_schema : (version.form_schema?.fields ?? []);
  return { ...version, form_schema: rawFields.map((field) => ({ ...field, key: field.key ?? field.field_key })) };
};

const normalizeCatalog = (catalog) => ({
  ...(catalog ?? {}),
  templates: (catalog?.templates ?? []).map((template) => ({ ...template, version: normalizeVersion(template.version) })),
});

export const approvalService = {
  async getAuthoringCatalog() {
    return normalizeCatalog((await rpc('get_approval_authoring_catalog')) ?? { categories: [], templates: [], users: [] });
  },

  async getCategories() {
    return (await this.getAuthoringCatalog()).categories;
  },

  async getTemplates() {
    return (await this.getAuthoringCatalog()).templates;
  },

  async saveDraft({ documentId = null, templateId, title, bodyJson = {}, formData = {}, lineSchemaOverride = null }) {
    return rpc('save_approval_draft', {
      p_document_id: documentId,
      p_template_id: templateId,
      p_title: title,
      p_body_json: bodyJson,
      p_form_data: formData,
      p_line_schema_override: lineSchemaOverride,
    });
  },

  async createDraft(templateId, _versionId, title, bodyJson, formData) {
    const id = await this.saveDraft({ templateId, title, bodyJson, formData });
    return { id };
  },

  async submitDocument(documentId) {
    await rpc('submit_approval_document_v2', { p_document_id: documentId });
    announceApprovalChange();
  },

  async processAction(documentId, assigneeId, action, opinion = '') {
    const result = await rpc('process_approval_action_v2', { p_document_id: documentId, p_assignee_id: assigneeId, p_action: action, p_opinion: opinion });
    announceApprovalChange();
    return result;
  },

  async processSignedAction(documentId, assigneeId, action, opinion = '', credentialId = null) {
    const result = await rpc('process_signed_approval_action_v2', { p_document_id: documentId, p_assignee_id: assigneeId, p_action: action, p_opinion: opinion, p_credential_id: credentialId });
    announceApprovalChange();
    return result;
  },

  async getCredentials() {
    const client = requireSupabase();
    const { data, error } = await client.from('approval_credentials').select('*').is('archived_at', null).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(async (item) => {
      const { data: signed } = await client.storage.from('groupware-approval-credentials').createSignedUrl(item.storage_path, 3600);
      return { ...item, preview_url: signed?.signedUrl ?? '' };
    }));
  },

  async uploadCredential(file, { type, label, isDefault = false }) {
    const client = requireSupabase();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw userError ?? new Error('로그인이 필요합니다.');
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[file.type];
    if (!extension || file.size < 1 || file.size > 2097152) throw new Error('PNG·JPG·WEBP 이미지만 2MB 이하로 등록할 수 있습니다.');
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from('groupware-approval-credentials').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    try {
      return await rpc('register_approval_credential', { p_type: type, p_label: label, p_storage_path: path, p_mime_type: file.type, p_file_size: file.size, p_is_default: isDefault });
    } catch (error) {
      await client.storage.from('groupware-approval-credentials').remove([path]);
      throw error;
    }
  },

  async archiveCredential(id) {
    await rpc('archive_approval_credential', { p_credential_id: id });
  },

  async getHeaderState() {
    return (await rpc('get_groupware_header_state')) ?? { approval_pending: 0, unread_count: 0, notifications: [] };
  },

  async markNotificationRead(id = null) {
    await rpc('mark_groupware_notification_read', { p_notification_id: id });
  },

  async getDelegations() {
    return (await rpc('get_my_approval_delegations')) ?? [];
  },

  async setReferences(documentId, references) {
    await rpc('set_approval_references', { p_document_id: documentId, p_references: references });
  },

  async getReferences() {
    return (await rpc('get_my_approval_references')) ?? [];
  },

  async markReferenceRead(referenceId) {
    await rpc('mark_approval_reference_read', { p_reference_id: referenceId });
  },

  async addComment(documentId, content) {
    return rpc('add_approval_comment', { p_document_id: documentId, p_content: content });
  },

  async deleteComment(commentId) {
    await rpc('delete_approval_comment', { p_comment_id: commentId });
  },

  async uploadAttachment(documentId, file) {
    const client = requireSupabase();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw userError ?? new Error('로그인이 필요합니다.');
    if (!file || file.size < 1 || file.size > 20971520) throw new Error('파일 용량은 20MB 이하만 첨부할 수 있습니다.');
    // Supabase Storage only allows ASCII in storage paths.
    // Clean base and extension so Korean files (e.g. 자격증모아.png) map to clean ASCII names like attachment.png
    const dotIndex = file.name.lastIndexOf('.');
    const rawExt = dotIndex !== -1 ? file.name.slice(dotIndex).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
    const ext = (rawExt && rawExt.startsWith('.')) ? rawExt : (rawExt ? `.${rawExt}` : '');
    const rawBase = dotIndex !== -1 ? file.name.slice(0, dotIndex) : file.name;
    const cleanBase = rawBase.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    const base = cleanBase || 'attachment';
    const safeName = `${base}${ext}`;
    const path = `${documentId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
    const contentType = file.type || 'application/octet-stream';
    const { error: uploadError } = await client.storage.from('groupware-approval-attachments').upload(path, file, { contentType, upsert: false });
    if (uploadError) throw uploadError;
    try { return await rpc('register_approval_attachment', { p_document_id: documentId, p_storage_path: path, p_original_name: file.name, p_mime_type: contentType, p_file_size: file.size }); }
    catch (error) { await client.storage.from('groupware-approval-attachments').remove([path]); throw error; }
  },

  async deleteAttachment(attachmentId) {
    const path = await rpc('delete_approval_attachment', { p_attachment_id: attachmentId });
    if (path) await requireSupabase().storage.from('groupware-approval-attachments').remove([path]);
  },

  async adminCancelDocument(documentId, reason) {
    await rpc('admin_cancel_approval_document', { p_document_id: documentId, p_reason: reason });
    announceApprovalChange();
  },

  async createDelegation({ delegateUserId, scopeType, templateId = null, startsAt, endsAt, reason }) {
    return rpc('create_approval_delegation', { p_delegate_user_id: delegateUserId, p_scope_type: scopeType, p_template_id: scopeType === 'template' ? templateId : null, p_department_id: null, p_starts_at: startsAt, p_ends_at: endsAt, p_reason: reason });
  },

  async revokeDelegation(id, reason) {
    await rpc('revoke_approval_delegation', { p_delegation_id: id, p_reason: reason });
  },

  async recallDocument(documentId, opinion) {
    await rpc('recall_approval_document_v2', { p_document_id: documentId, p_opinion: opinion });
    announceApprovalChange();
  },

  async archiveDocument(documentId, reason) {
    await rpc('archive_approval_document', { p_document_id: documentId, p_reason: reason });
  },

  async getAvailableActions(documentId) {
    return (await rpc('get_available_approval_actions', { p_document_id: documentId })) ?? {};
  },

  async getHomeSummary() {
    return (await rpc('get_approval_home_summary')) ?? { inbox: 0, outbox: 0, drafts: 0, completed: 0, recent: [] };
  },

  async getInbox() {
    const data = await rpc('get_my_approval_inbox');
    return (data || []).map((row) => ({
      id: row.document_id,
      document_number: row.document_number,
      title: row.title,
      status: row.document_status,
      template_name: row.template_name,
      drafter_user_id: row.drafter_user_id,
      drafter_name: row.drafter_name,
      submitted_at: row.submitted_at,
      active_line_id: row.active_line_id,
      step_order: row.step_order,
      step_kind: row.step_kind,
      line_mode: row.line_mode,
      assignee_id: row.assignee_id,
      assignee_status: row.assignee_status,
      is_delegated: row.is_delegated,
    }));
  },

  async getDocument(documentId) {
    const client = requireSupabase();
    const [{ data, error }, availableActions] = await Promise.all([
      client.from('approval_documents').select(`
        *,
        template:template_id (*),
        template_version:template_version_id (*),
        revision:current_revision_id (*),
        lines:approval_lines (*, assignees:approval_line_assignees (*)),
        actions:approval_actions (*),
        attachments:approval_attachments (*),
        comments:approval_comments (*),
        references:approval_references (*)
      `).eq('id', documentId).single(),
      this.getAvailableActions(documentId),
    ]);
    if (error) throw error;
    const actions = await Promise.all((data.actions || []).map(async (action) => {
      const path = action.credential_snapshot?.storage_path;
      if (!path) return action;
      const { data: signed } = await client.storage.from('groupware-approval-credentials').createSignedUrl(path, 3600);
      return { ...action, credential_snapshot: { ...action.credential_snapshot, preview_url: signed?.signedUrl ?? '' } };
    }));
    const attachments = await Promise.all((data.attachments || []).filter((item) => !item.deleted_at).map(async (item) => {
      const { data: signed } = await client.storage.from('groupware-approval-attachments').createSignedUrl(item.storage_path, 3600);
      return { ...item, download_url: signed?.signedUrl ?? '' };
    }));
    return { ...data, template_version: normalizeVersion(data.template_version), actions, attachments, availableActions };
  },

  async getAdminCatalog() {
    return normalizeCatalog((await rpc('get_approval_admin_catalog')) ?? { categories: [], templates: [], users: [] });
  },

  async saveCategory(category) {
    return rpc('manage_approval_category', { p_category: category });
  },

  async saveTemplate(template, formSchema, lineSchema) {
    return rpc('manage_approval_template', { p_template: template, p_form_schema: formSchema, p_line_schema: lineSchema });
  },
};
