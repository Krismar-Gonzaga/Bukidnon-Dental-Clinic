import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { FilterSelect, InitialsTile } from '../../../components/clinic/ClinicUi';
import { Field, FormError } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getDentalChart, saveTooth } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { usePatientOptions } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const STATUSES = [
  { value: 'healthy', label: 'Healthy', mark: '' },
  { value: 'caries', label: 'Caries', mark: '^' },
  { value: 'filled', label: 'Filled', mark: '•' },
  { value: 'crown', label: 'Crown', mark: '▪' },
  { value: 'missing', label: 'Missing', mark: '×' },
  { value: 'planned', label: 'Planned', mark: '–' },
];

// Universal Numbering System, as a dentist faces the patient. The midline falls after the eighth.
const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);
const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);
const MIDLINE_POSITION = 7;

const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label ?? value;

function Tooth({ tooth, position, isSelected, onSelect }) {
  const status = STATUSES.find((s) => s.value === tooth.status);
  return (
    <button
      type="button"
      className={`dental-tooth${isSelected ? ' is-selected' : ''}${position === MIDLINE_POSITION ? ' is-midline' : ''}`}
      aria-pressed={isSelected}
      aria-label={`Tooth ${tooth.number}, ${statusLabel(tooth.status)}`}
      onClick={() => onSelect(tooth.number)}
    >
      {tooth.number}
      <span className={`dental-tooth-face is-${tooth.status}`}>
        <span className="dental-mark" aria-hidden="true">
          {status?.mark}
        </span>
      </span>
    </button>
  );
}

function ToothEditor({ clinicId, patientId, tooth, onSaved }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(tooth.status);
  const [notes, setNotes] = useState(tooth.notes ?? '');
  const save = useMutation({
    mutationFn: () => saveTooth(clinicId, patientId, tooth.number, { status, notes: notes.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dental-chart', patientId] });
      onSaved();
    },
  });

  useEffect(() => {
    setStatus(tooth.status);
    setNotes(tooth.notes ?? '');
  }, [tooth.number, tooth.status, tooth.notes]);

  // Only when another tooth is opened: the refresh after saving must not clear "Tooth saved".
  const resetSave = save.reset;
  useEffect(() => resetSave(), [tooth.number, resetSave]);

  return (
    <Card title={`Tooth #${tooth.number}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Status" as="select" value={status} onChange={(event) => setStatus(event.target.value)} options={STATUSES.map(({ value, label }) => ({ value, label }))} />
        <Field label="Clinical Notes" as="textarea" rows={4} maxLength={2000} placeholder="Add notes for this tooth…" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <FormError error={save.error} />
        {save.isSuccess && (
          <p className="clinic-saved-note is-navy" role="status">
            <Icon name="checkCircle" size={16} />
            Tooth saved
          </p>
        )}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </Card>
  );
}

function Chart({ clinicId, patient, query }) {
  const [selected, setSelected] = useState(null);
  useEffect(() => setSelected(null), [patient?.id]);

  return (
    <QueryState query={query} loadingLabel="Loading dental chart…">
      {(chart) => {
        const byNumber = new Map(chart.teeth.map((tooth) => [tooth.number, tooth]));
        const row = (numbers) => (
          <div className="dental-jaw">
            {numbers.map((number, position) => (
              <Tooth key={number} tooth={byNumber.get(number)} position={position} isSelected={selected === number} onSelect={setSelected} />
            ))}
          </div>
        );
        return (
          <div className="dentist-split is-chart">
            <Card>
              <div className="dentist-chart-card-head">
                <InitialsTile name={patient?.name} size="sm" tone="navy" />
                <div>
                  <p className="dentist-row-title">{patient?.name}</p>
                  <p className="dentist-row-sub">{chart.last_updated_at ? `Last updated: ${formatDate(chart.last_updated_at)}` : 'Not charted yet: every tooth shows as healthy until you record otherwise.'}</p>
                </div>
              </div>
              <p className="dental-jaw-title">Upper Jaw (Maxillary)</p>
              {row(UPPER)}
              <div className="dental-sides">
                <span>Patient&apos;s Right</span>
                <span>Patient&apos;s Left</span>
              </div>
              <div className="clinic-form-gap">{row(LOWER)}</div>
              <p className="dental-jaw-title">Lower Jaw (Mandibular)</p>
              <div className="dental-legend" aria-label="Legend">
                {STATUSES.map(({ value, label }) => (
                  <span key={value}>
                    <i className={`dental-swatch is-${value}`} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </Card>

            <div className="dentist-stack">
              {selected ? (
                <ToothEditor clinicId={clinicId} patientId={patient.id} tooth={byNumber.get(selected)} onSaved={() => {}} />
              ) : (
                <Card>
                  <div className="dental-prompt">
                    <Icon name="activity" size={32} />
                    <p className="dentist-row-title">Select a tooth</p>
                    <p className="dentist-row-sub">Click any tooth on the chart to view or edit its status.</p>
                  </div>
                </Card>
              )}
              <Card title="Chart Summary">
                {STATUSES.map(({ value, label }) => (
                  <div key={value} className="dental-summary-row">
                    <i className={`dental-swatch is-round is-${value}`} aria-hidden="true" />
                    {label}
                    <strong>{chart.summary[value] ?? 0}</strong>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}

/** Dental Chart: all 32 teeth of a patient, kept per clinic. */
function DentalChartPage() {
  const { clinicId } = useClinicAccess();
  const [params, setParams] = useSearchParams();
  const { patients, isPending } = usePatientOptions(clinicId);
  const requested = params.get('patient');
  const patient = patients.find((p) => String(p.id) === requested) ?? patients[0];
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'dental-chart', patient?.id],
    queryFn: () => getDentalChart(clinicId, patient.id),
    enabled: Boolean(patient),
  });

  return (
    <ClinicLayout
      section="dental-chart"
      title="Dental Chart"
      subtitle="Universal Numbering System (UNS)"
      requires={['records.view']}
      hideSearch
      headerActions={
        patients.length > 0 && (
          <FilterSelect
            label="Patient"
            value={String(patient?.id ?? '')}
            onChange={(value) => setParams({ patient: value }, { replace: true })}
            options={patients.map((p) => ({ value: String(p.id), label: p.name }))}
          />
        )
      }
    >
      {!isPending && patients.length === 0 ? <p className="portal-empty">Patients appear here once they have an appointment with you.</p> : patient && <Chart clinicId={clinicId} patient={patient} query={query} />}
    </ClinicLayout>
  );
}

export default DentalChartPage;
