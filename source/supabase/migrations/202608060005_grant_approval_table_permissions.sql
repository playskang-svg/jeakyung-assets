begin;

-- Grant table privileges to authenticated role so RLS policies can control row-level access.
grant select, insert, update, delete on public.approval_categories to authenticated;
grant select, insert, update, delete on public.approval_templates to authenticated;
grant select, insert, update, delete on public.approval_template_versions to authenticated;
grant select, insert, update, delete on public.approval_documents to authenticated;
grant select, insert, update, delete on public.approval_document_revisions to authenticated;
grant select, insert, update, delete on public.approval_lines to authenticated;
grant select, insert, update, delete on public.approval_line_assignees to authenticated;
grant select, insert, update, delete on public.approval_actions to authenticated;
grant select, insert, update, delete on public.approval_attachments to authenticated;
grant select, insert, update, delete on public.approval_comments to authenticated;
grant select, insert, update, delete on public.approval_references to authenticated;
grant select, insert, update, delete on public.approval_delegations to authenticated;
grant select, insert, update, delete on public.approval_credentials to authenticated;
grant select, insert, update, delete on public.approval_number_sequences to authenticated;

-- Revoke all table privileges from unauthenticated (anon/public) role
revoke all on public.approval_categories from anon, public;
revoke all on public.approval_templates from anon, public;
revoke all on public.approval_template_versions from anon, public;
revoke all on public.approval_documents from anon, public;
revoke all on public.approval_document_revisions from anon, public;
revoke all on public.approval_lines from anon, public;
revoke all on public.approval_line_assignees from anon, public;
revoke all on public.approval_actions from anon, public;
revoke all on public.approval_attachments from anon, public;
revoke all on public.approval_comments from anon, public;
revoke all on public.approval_references from anon, public;
revoke all on public.approval_delegations from anon, public;
revoke all on public.approval_credentials from anon, public;
revoke all on public.approval_number_sequences from anon, public;

-- Ensure RLS is active on all approval tables
alter table public.approval_categories enable row level security;
alter table public.approval_templates enable row level security;
alter table public.approval_template_versions enable row level security;
alter table public.approval_documents enable row level security;
alter table public.approval_document_revisions enable row level security;
alter table public.approval_lines enable row level security;
alter table public.approval_line_assignees enable row level security;
alter table public.approval_actions enable row level security;
alter table public.approval_attachments enable row level security;
alter table public.approval_comments enable row level security;
alter table public.approval_references enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.approval_credentials enable row level security;
alter table public.approval_number_sequences enable row level security;

commit;
