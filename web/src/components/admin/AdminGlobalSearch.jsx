import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import {
  ADMIN_APPLICATIONS_HREF,
  ADMIN_AUDIT_HREF,
  ADMIN_CLINICS_HREF,
  ADMIN_USERS_HREF,
  APPLICATION_STATUS_LABELS,
  getAdminApplicationHref,
  USER_ROLE_LABELS,
} from '../../config/adminNavigation';
import { getAdminClinics, getApplications, getUsers } from '../../services/adminApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDropdown } from '../../hooks/useDropdown';

const MIN_CHARS = 2;
const LIMIT = 4;

/**
 * Admin top-bar search across clinics, clinic applications and user
 * accounts (server-side searches), plus a jump to the audit log filtered by
 * action. Enter opens the first result.
 */
function AdminGlobalSearch() {
  const navigate = useNavigate();
  const dropdown = useDropdown();
  const { isOpen, wrapperRef } = dropdown;
  const panelId = useId();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim());
  const ready = isOpen && debounced.length >= MIN_CHARS;
  const params = { search: debounced, per_page: LIMIT };

  const clinics = useQuery({ queryKey: ['admin', 'search', 'clinics', debounced], queryFn: () => getAdminClinics(params), enabled: ready });
  const applications = useQuery({ queryKey: ['admin', 'search', 'applications', debounced], queryFn: () => getApplications(params), enabled: ready });
  const users = useQuery({ queryKey: ['admin', 'search', 'users', debounced], queryFn: () => getUsers(params), enabled: ready });
  const encoded = encodeURIComponent(debounced);

  const groups = [
    {
      label: 'Clinics',
      query: clinics,
      items: (clinics.data?.items ?? []).map((c) => ({
        key: `c${c.id}`,
        href: `${ADMIN_CLINICS_HREF}?search=${encodeURIComponent(c.name)}`,
        title: c.name,
        detail: [c.city, c.status].filter(Boolean).join(' · '),
        icon: 'building',
      })),
    },
    {
      label: 'Registration queue',
      query: applications,
      items: (applications.data?.items ?? []).map((a) => ({
        key: `a${a.id}`,
        href: getAdminApplicationHref(a.id),
        title: a.clinic_name,
        detail: [a.city, APPLICATION_STATUS_LABELS[a.status] ?? a.status].filter(Boolean).join(' · '),
        icon: 'userCheck',
      })),
    },
    {
      label: 'Users',
      query: users,
      items: (users.data?.items ?? []).map((u) => ({
        key: `u${u.id}`,
        href: `${ADMIN_USERS_HREF}?search=${encodeURIComponent(u.email)}`,
        title: u.name,
        detail: `${u.email} · ${USER_ROLE_LABELS[u.role] ?? u.role}`,
        icon: 'users',
      })),
    },
  ];

  const isLoading = groups.some((g) => g.query.isFetching);
  const hasResults = groups.some((g) => g.items.length > 0);
  const go = (href) => {
    dropdown.close();
    setTerm('');
    navigate(href);
  };

  return (
    <div className="clinic-topbar-search clinic-global-search" ref={wrapperRef}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const first = groups.flatMap((g) => g.items)[0];
          if (first) go(first.href);
          else if (term.trim()) go(`${ADMIN_APPLICATIONS_HREF}?search=${encodeURIComponent(term.trim())}`);
        }}
      >
        <Icon name="search" size={18} />
        <label className="visually-hidden" htmlFor={`${panelId}-input`}>
          Search clinics, logs, or users
        </label>
        <input
          id={`${panelId}-input`}
          type="search"
          placeholder="Search clinics, logs, or users…"
          value={term}
          maxLength={100}
          autoComplete="off"
          aria-controls={panelId}
          onFocus={() => !isOpen && dropdown.toggle()}
          onChange={(e) => {
            setTerm(e.target.value);
            if (!isOpen) dropdown.toggle();
          }}
        />
      </form>

      {isOpen && term.trim().length >= MIN_CHARS && (
        <div id={panelId} className="clinic-search-panel" role="region" aria-label="Search results">
          {!ready || (isLoading && !hasResults) ? (
            <p className="clinic-search-status" role="status">Searching…</p>
          ) : !hasResults ? (
            <p className="clinic-search-status" role="status">No clinics, applications or users match “{debounced}”.</p>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.label} className="clinic-search-group">
                  <p className="clinic-search-group-label">{g.label}</p>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item.key}>
                        <a
                          href={item.href}
                          className="clinic-search-result"
                          onClick={(e) => {
                            e.preventDefault();
                            go(item.href);
                          }}
                        >
                          <Icon name={item.icon} size={18} />
                          <span>
                            <span className="clinic-search-result-title">{item.title}</span>
                            {item.detail && <span className="clinic-search-result-detail">{item.detail}</span>}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
          {ready && (
            <button type="button" className="clinic-search-all" onClick={() => go(`${ADMIN_AUDIT_HREF}?action=${encoded}`)}>
              Audit log actions starting with “{debounced}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminGlobalSearch;
