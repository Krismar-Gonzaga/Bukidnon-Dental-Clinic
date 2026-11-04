import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { ActionDialog, StatusTag } from '../../components/admin/AdminUi';
import { QueryState } from '../../components/StatusMessage';
import {
  ADMIN_ANNOUNCEMENTS_HREF,
  ADMIN_ANNOUNCEMENT_NEW_HREF,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_STATUS,
  getAdminAnnouncementEditHref,
} from '../../config/adminNavigation';
import { archiveAnnouncement, getAnnouncements, publishAnnouncement } from '../../services/adminApi';
import { formatDate } from '../../utils/dateTime';

const PER_PAGE = 20;
const audienceLabel = (value) => ANNOUNCEMENT_AUDIENCES.find((audience) => audience.value === value)?.label ?? value;

function AnnouncementCard({ announcement, onAct }) {
  const status = ANNOUNCEMENT_STATUS[announcement.status] ?? ANNOUNCEMENT_STATUS.draft;
  const date = announcement.published_at ?? announcement.created_at;

  return (
    <li className="admin-announcement">
      <div className="admin-announcement-head">
        <div>
          <h2 className="admin-announcement-title">
            {announcement.title}
            <StatusTag tone={status.tone}>{status.label}</StatusTag>
          </h2>
          <p className="admin-announcement-meta">
            Target: {audienceLabel(announcement.audience)} · {formatDate(date)}
          </p>
        </div>
        <div className="admin-row-actions">
          {announcement.status === 'published' && (
            <button type="button" className="admin-outline-chip" aria-label={`Archive ${announcement.title}`} onClick={() => onAct('archive', announcement)}>
              <Icon name="package" size={16} />
              Archive
            </button>
          )}
          {announcement.status === 'draft' && (
            <>
              <a href={getAdminAnnouncementEditHref(announcement.id)} className="admin-outline-chip" aria-label={`Edit ${announcement.title}`}>
                <Icon name="pencil" size={16} />
                Edit
              </a>
              <button type="button" className="admin-soft-button is-primary" aria-label={`Publish ${announcement.title}`} onClick={() => onAct('publish', announcement)}>
                <Icon name="send" size={16} />
                Publish
              </button>
            </>
          )}
        </div>
      </div>
      <p className="admin-announcement-content">{announcement.content}</p>
    </li>
  );
}

function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState(null); // { kind, announcement }
  const query = useQuery({
    queryKey: ['admin', 'announcements', page],
    queryFn: () => getAnnouncements({ page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const act = useMutation({
    mutationFn: () => (acting.kind === 'publish' ? publishAnnouncement(acting.announcement.id) : archiveAnnouncement(acting.announcement.id)),
    onSuccess: () => {
      setActing(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  const isPublish = acting?.kind === 'publish';

  return (
    <AdminLayout
      title="System Notifications"
      subtitle="Platform announcements and notices"
      activeHref={ADMIN_ANNOUNCEMENTS_HREF}
      headerActions={
        <a href={ADMIN_ANNOUNCEMENT_NEW_HREF} className="btn btn-primary">
          <Icon name="plus" size={18} />
          Create Announcement
        </a>
      }
    >
      <QueryState query={query} loadingLabel="Loading announcements…">
        {({ items, meta }) => (
          <div className="admin-announcements">
            {items.length === 0 ? (
              <p className="admin-empty-card">No announcements yet.</p>
            ) : (
              <ul>
                {items.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    onAct={(kind, next) => {
                      act.reset();
                      setActing({ kind, announcement: next });
                    }}
                  />
                ))}
              </ul>
            )}
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={setPage} noun="announcements" label="Announcement pages" />}
          </div>
        )}
      </QueryState>

      {acting && (
        <ActionDialog
          title={isPublish ? 'Publish Announcement' : 'Archive Announcement'}
          message={
            isPublish ? (
              <>
                Send <strong>{acting.announcement.title}</strong> to {audienceLabel(acting.announcement.audience).toLowerCase()} now? It cannot be edited afterwards.
              </>
            ) : (
              <>
                Archive <strong>{acting.announcement.title}</strong>? People who received it keep their notification.
              </>
            )
          }
          isBusy={act.isPending}
          error={act.error}
          onConfirm={() => act.mutate()}
          onCancel={() => setActing(null)}
        />
      )}
    </AdminLayout>
  );
}

export default AdminAnnouncementsPage;
