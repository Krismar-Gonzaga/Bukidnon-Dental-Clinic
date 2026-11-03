import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { getClinicHref } from '../../config/clinicNavigation';
import { getBranches, getClinicPatients, getMembers } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDropdown } from '../../hooks/useDropdown';

const MIN_CHARS = 2;
const LIMIT = 5;

const matches = (term, ...values) => values.some((v) => String(v ?? '').toLowerCase().includes(term));

/**
 * Clinic top-bar search across patients (server search), branches and staff
 * (filtered here). Each group only appears when the member may open it.
 * Enter opens the full patient search.
 */
function ClinicGlobalSearch({ clinicId, can }) {
  const navigate = useNavigate();
  const dropdown = useDropdown();
  const { isOpen, wrapperRef } = dropdown;
  const panelId = useId();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim());
  const query = debounced.toLowerCase();
  const ready = isOpen && debounced.length >= MIN_CHARS;

  const canPatients = can('patients.view');
  const canBranches = can('clinic.branches.manage', 'clinic.schedules.manage');
  const canStaff = can('clinic.staff.manage');

  const patients = useQuery({
    queryKey: ['clinic', clinicId, 'search', 'patients', debounced],
    queryFn: () => getClinicPatients(clinicId, { search: debounced, per_page: LIMIT }),
    enabled: ready && canPatients,
  });
  const branches = useQuery({
    queryKey: ['clinic', clinicId, 'branches'],
    queryFn: () => getBranches(clinicId),
    enabled: ready && canBranches,
  });
  const staff = useQuery({
    queryKey: ['clinic', clinicId, 'members'],
    queryFn: () => getMembers(clinicId),
    enabled: ready && canStaff,
  });

  const groups = [
    canPatients && {
      label: 'Patients',
      loading: patients.isFetching,
      items: (patients.data?.items ?? []).slice(0, LIMIT).map((p) => ({
        key: `p${p.id}`,
        href: `${getClinicHref(clinicId, 'patients')}/${p.id}`,
        title: p.name,
        detail: [p.phone, p.email].filter(Boolean).join(' · '),
        icon: 'users',
      })),
    },
    canBranches && {
      label: 'Branches',
      loading: branches.isFetching && !branches.data,
      items: (branches.data ?? [])
        .filter((b) => matches(query, b.name, b.city, b.address))
        .slice(0, LIMIT)
        .map((b) => ({ key: `b${b.id}`, href: getClinicHref(clinicId, 'branches'), title: b.name, detail: `${b.address}, ${b.city}`, icon: 'building' })),
    },
    canStaff && {
      label: 'Staff',
      loading: staff.isFetching && !staff.data,
      items: (staff.data ?? [])
        .filter((m) => matches(query, m.name, m.email))
        .slice(0, LIMIT)
        .map((m) => ({
          key: `s${m.id}`,
          href: `${getClinicHref(clinicId, 'staff')}?search=${encodeURIComponent(m.name)}`,
          title: m.name,
          detail: m.email,
          icon: 'userCheck',
        })),
    },
  ].filter(Boolean);

  if (groups.length === 0) return null;

  const isLoading = groups.some((g) => g.loading);
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
          const value = term.trim();
          if (canPatients) go(`${getClinicHref(clinicId, 'patients')}${value ? `?search=${encodeURIComponent(value)}` : ''}`);
          else {
            const first = groups.flatMap((g) => g.items)[0];
            if (first) go(first.href);
          }
        }}
      >
        <Icon name="search" size={18} />
        <label className="visually-hidden" htmlFor={`${panelId}-input`}>
          Search patients, branches, or staff
        </label>
        <input
          id={`${panelId}-input`}
          type="search"
          placeholder="Search patients, branches, or staff…"
          value={term}
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
            <p className="clinic-search-status" role="status">No matches for “{debounced}”.</p>
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
          {canPatients && (
            <button type="button" className="clinic-search-all" onClick={() => go(`${getClinicHref(clinicId, 'patients')}?search=${encodeURIComponent(term.trim())}`)}>
              See all patients matching “{term.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ClinicGlobalSearch;
