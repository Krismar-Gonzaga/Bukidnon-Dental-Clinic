import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../Icon';
import { ConfirmDialog, Field, FormError, Modal } from '../portal/PortalUi';
import { getClinicHref } from '../../config/clinicNavigation';
import { appointmentAction } from '../../services/clinicPortalApi';
import './ClinicUi.css';

// Building blocks of the clinic admin design's pages.

/** Soft icon, big value, label and note. `href` makes the whole tile a link. */
export function StatTile({ icon, tone = 'blue', value, label, note, noteIcon, href }) {
  const body = (
    <>
      <span className={`clinic-tile-icon is-${tone}`} aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <p className="clinic-tile-value">{value}</p>
      <p className="clinic-tile-label">{label}</p>
      {note && (
        <p className="clinic-tile-note">
          {noteIcon && <Icon name={noteIcon} size={14} />}
          {note}
        </p>
      )}
    </>
  );
  return href ? (
    <a href={href} className="clinic-tile">
      {body}
    </a>
  ) : (
    <div className="clinic-tile">{body}</div>
  );
}

/** Rounded label. tone: success | warning | danger | info | neutral | purple. */
export function Pill({ tone = 'neutral', children }) {
  return <span className={`clinic-pill is-${tone}`}>{children}</span>;
}

const AVATAR_TONES = ['blue', 'green', 'purple', 'orange', 'teal', 'pink'];

/** Initials on a colored tile; the color stays the same for the same id. */
export function InitialsTile({ name, id = 0, size = 'md', tone }) {
  const letters =
    String(name ?? '')
      .replace(/^(dr|dra|mr|mrs|ms)\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || '?';
  return (
    <span className={`clinic-initials is-${size} is-${tone ?? AVATAR_TONES[Number(id) % AVATAR_TONES.length]}`} aria-hidden="true">
      {letters}
    </span>
  );
}

export function SearchInput({ label, value, onChange, placeholder }) {
  return (
    <label className="clinic-search">
      <Icon name="search" size={18} />
      <span className="visually-hidden">{label}</span>
      <input type="search" value={value} maxLength={100} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="clinic-filter">
      <span className="visually-hidden">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={16} />
    </label>
  );
}

/** Pill-shaped page tabs. Items with `href` navigate; others call onChange. */
export function PageTabs({ tabs, value, onChange, label }) {
  return (
    <div className="clinic-tabs" role="group" aria-label={label}>
      {tabs.map((tab) =>
        tab.href ? (
          <a key={tab.value} href={tab.href} className={`clinic-tab${tab.value === value ? ' is-active' : ''}`} aria-current={tab.value === value ? 'page' : undefined}>
            {tab.label}
          </a>
        ) : (
          <button key={tab.value} type="button" className={`clinic-tab${tab.value === value ? ' is-active' : ''}`} aria-pressed={tab.value === value} onClick={() => onChange(tab.value)}>
            {tab.label}
          </button>
        )
      )}
    </div>
  );
}

/** Clinic Profile | Services & Pricing | Branches (only the tabs the member may open). */
export function ClinicProfileTabs({ clinicId, can, active }) {
  const tabs = [
    { value: 'settings', label: 'Clinic Profile', anyOf: ['clinic.profile.manage'] },
    { value: 'services', label: 'Services & Pricing', anyOf: ['clinic.services.manage'] },
    { value: 'branches', label: 'Branches', anyOf: ['clinic.branches.manage', 'clinic.schedules.manage'] },
  ].filter((tab) => can(...tab.anyOf));
  return <PageTabs label="Clinic profile sections" value={active} tabs={tabs.map((t) => ({ ...t, href: getClinicHref(clinicId, t.value) }))} />;
}

/**
 * Confirm or end an appointment from a list, with the same safeguards as its
 * detail page: a confirmation first, and a required reason to decline or cancel.
 * `decision` is { appointment, action } (action: confirm | reject | cancel).
 */
export function AppointmentDecision({ clinicId, decision, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const { appointment, action } = decision;
  const name = appointment.patient?.name ?? 'The patient';
  const run = useMutation({
    mutationFn: () => appointmentAction(clinicId, appointment.id, action, action === 'confirm' ? undefined : { reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });

  if (action === 'confirm') {
    return (
      <ConfirmDialog
        title="Confirm appointment"
        message={`Confirm this appointment? ${name} will be notified.`}
        confirmLabel="Confirm appointment"
        isBusy={run.isPending}
        error={run.error}
        onConfirm={() => run.mutate()}
        onCancel={onClose}
      />
    );
  }

  const isDecline = action === 'reject';
  return (
    <Modal title={isDecline ? 'Decline request' : 'Cancel appointment'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate();
        }}
      >
        <p className="portal-confirm-message">
          {name} will be told the reason{appointment.service ? ` for ${appointment.service}` : ''}.
        </p>
        <Field label="Reason" as="textarea" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FormError error={run.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Keep it
          </button>
          <button type="submit" className="btn btn-danger" disabled={!reason.trim() || run.isPending}>
            {run.isPending ? 'Saving…' : isDecline ? 'Decline request' : 'Cancel appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
