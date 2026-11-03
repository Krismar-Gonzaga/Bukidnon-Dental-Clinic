import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge, Checkbox, Field, Section } from '../../components/portal/PortalUi';
import NewRecordModal from '../../components/portal/NewRecordModal';
import Pagination from '../../components/Pagination';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { getClinicHref, getRecordTypeLabel, RECORD_TYPES } from '../../config/clinicNavigation';
import { getClinicRecords } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatShortDate, formatTime } from '../../utils/dateTime';

const PAGE_SIZE = 15;
const RECORD_FIELDS = [
  ['Chief complaint', 'chief_complaint'],
  ['Findings', 'findings'],
  ['Procedures', 'procedures'],
  ['Teeth', 'tooth_numbers'],
  ['Care instructions', 'care_instructions'],
  ['Internal notes', 'notes'],
];

function RecordItem({ record }) {
  const { clinicId } = useClinic();
  const fields = RECORD_FIELDS.filter(([, key]) => record[key]);

  return (
    <li className="portal-list-item">
      <div className="portal-section-header">
        <div>
          <a href={`${getClinicHref(clinicId, 'patients')}/${record.patient_id}`}>
            <strong>{record.patient?.name ?? 'Patient'}</strong>
          </a>{' '}
          <Badge tone="info">{getRecordTypeLabel(record.record_type)}</Badge>{' '}
          {record.amends_record_id && <Badge tone="warning">correction</Badge>}{' '}
          {record.is_patient_visible && <Badge tone="success">shared</Badge>}
          <p className="portal-table-muted">
            {formatShortDate(record.created_at)}, {formatTime(record.created_at)} · {record.dentist ?? record.author}
          </p>
        </div>
        <a href={`${getClinicHref(clinicId, 'patients')}/${record.patient_id}`} className="btn btn-outline btn-sm">
          Open patient
        </a>
      </div>
      <dl className="portal-details">
        {fields.map(([label, key]) => (
          <div key={key} className="portal-details-row">
            <dt>{label}</dt>
            <dd>{record[key]}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/** Clinical records across the dentist's patients, newest first. */
function RecordsList() {
  const { clinicId, can } = useClinic();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(searchParams.get('mine') === '1');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['clinic', clinicId, 'records', debouncedSearch, type, mine, page],
    queryFn: () =>
      getClinicRecords(clinicId, {
        search: debouncedSearch || undefined,
        record_type: type || undefined,
        mine: mine ? 1 : undefined,
        page,
        per_page: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <Section
      title="Clinical records"
      subtitle="Current versions only; corrected originals stay on each patient's page. Viewing is logged."
      actions={
        can('records.write') && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            New record
          </button>
        )
      }
    >
      <div className="portal-toolbar">
        <Field
          label="Patient"
          type="search"
          placeholder="Patient name"
          maxLength={100}
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
        />
        <Field
          label="Type"
          as="select"
          options={[{ value: '', label: 'All types' }, ...RECORD_TYPES]}
          value={type}
          onChange={(e) => resetPage(setType)(e.target.value)}
        />
        <Checkbox label="Only records I wrote" checked={mine} onChange={(e) => resetPage(setMine)(e.target.checked)} />
      </div>

      {saved && (
        <p className="portal-success" role="status">
          Record saved for {saved.name}.
        </p>
      )}

      {query.isPending ? (
        <LoadingState label="Loading records…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="portal-empty">
          {debouncedSearch || type || mine ? 'No records match these filters.' : 'No clinical records yet.'}
        </p>
      ) : (
        <>
          <ul className="portal-list">
            {query.data.items.map((record) => (
              <RecordItem key={record.id} record={record} />
            ))}
          </ul>
          <Pagination currentPage={page} pageCount={query.data.meta?.last_page ?? 1} onPageChange={setPage} label="Record pages" />
        </>
      )}

      {adding && <NewRecordModal clinicId={clinicId} title="New clinical record" onClose={() => setAdding(false)} onSaved={setSaved} />}
    </Section>
  );
}

function ClinicRecordsPage() {
  return (
    <ClinicLayout section="records" title="Records" requires={['records.view']}>
      <RecordsList />
    </ClinicLayout>
  );
}

export default ClinicRecordsPage;
