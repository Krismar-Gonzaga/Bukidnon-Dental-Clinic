import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { ADMIN_ANNOUNCEMENTS_HREF, ANNOUNCEMENT_AUDIENCES } from '../../config/adminNavigation';
import { createAnnouncement, getAnnouncement, updateAnnouncement } from '../../services/adminApi';
import { getFieldErrors } from '../../services/apiErrors';

const EMPTY = { title: '', audience: 'all', content: '' };

/** New announcement, or a draft being edited (what was sent cannot change). */
function AdminAnnouncementFormPage() {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const existing = useQuery({
    queryKey: ['admin', 'announcement', announcementId],
    queryFn: () => getAnnouncement(announcementId),
    enabled: Boolean(announcementId),
  });

  useEffect(() => {
    if (existing.data) setForm({ title: existing.data.title, audience: existing.data.audience, content: existing.data.content });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (publish) => {
      const body = { title: form.title.trim(), audience: form.audience, content: form.content.trim(), publish };
      return announcementId ? updateAnnouncement(announcementId, body) : createAnnouncement(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      navigate(ADMIN_ANNOUNCEMENTS_HREF);
    },
  });
  const errors = getFieldErrors(save.error);
  const bind = (name) => ({
    value: form[name],
    error: errors[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });
  const ready = form.title.trim() && form.content.trim();

  return (
    <AdminLayout title={announcementId ? 'Edit Announcement' : 'Create Announcement'} activeHref={ADMIN_ANNOUNCEMENTS_HREF}>
      <BackLink href={ADMIN_ANNOUNCEMENTS_HREF}>Back to Announcements</BackLink>
      {announcementId && existing.isPending ? (
        <LoadingState label="Loading announcement…" />
      ) : announcementId && existing.isError ? (
        <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
      ) : (
        <Card className="admin-form-card">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(true);
            }}
          >
            <Field label="Title" required maxLength={150} placeholder="Announcement title" {...bind('title')} />
            <Field label="Target Audience" as="select" options={ANNOUNCEMENT_AUDIENCES} {...bind('audience')} />
            <Field label="Content" as="textarea" required rows={6} maxLength={5000} placeholder="Write your announcement..." {...bind('content')} />
            <FormError error={save.error} />
            <div className="admin-form-actions">
              <button type="button" className="btn btn-outline" disabled={!ready || save.isPending} onClick={() => save.mutate(false)}>
                Save as Draft
              </button>
              <button type="submit" className="btn btn-primary" disabled={!ready || save.isPending}>
                <Icon name="send" size={18} />
                {save.isPending ? 'Saving…' : 'Publish Now'}
              </button>
            </div>
          </form>
        </Card>
      )}
    </AdminLayout>
  );
}

export default AdminAnnouncementFormPage;
