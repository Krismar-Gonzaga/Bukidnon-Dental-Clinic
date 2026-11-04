import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { ClinicProfileTabs, Pill } from '../../components/clinic/ClinicUi';
import { Checkbox, ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { archiveClinicService, createClinicService, getClinicServices, getServiceCategories, updateClinicService } from '../../services/clinicPortalApi';
import { formatPriceRange } from '../../services/adapters';
import '../../components/clinic/ClinicAdminUi.css';

const EMPTY = { service_id: '', name: '', description: '', price: '', price_max: '', duration_minutes: '30', duration_max: '', is_available: true };

const durationLabel = ({ duration_minutes: from, duration_max: to }) => (to && Number(to) !== Number(from) ? `${from}–${to} min` : `${from} min`);

function ServiceModal({ service, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['services', 'catalog', 'raw'], queryFn: getServiceCategories, staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState(
    service
      ? {
          service_id: String(service.service_id),
          name: service.name,
          description: service.description,
          price: service.price,
          price_max: service.price_max ?? '',
          duration_minutes: String(service.duration_minutes),
          duration_max: service.duration_max ? String(service.duration_max) : '',
          is_available: service.is_available,
        }
      : EMPTY
  );
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        service_id: Number(form.service_id),
        price: Number(form.price),
        price_max: form.price_max === '' ? null : Number(form.price_max),
        duration_minutes: Number(form.duration_minutes),
        duration_max: form.duration_max === '' ? null : Number(form.duration_max),
      };
      return service ? updateClinicService(clinicId, service.id, body) : createClinicService(clinicId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'services'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={service ? 'Edit Service' : 'Add Service'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field
            label="Category"
            as="select"
            required
            options={[{ value: '', label: 'Choose…' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
            {...bind('service_id')}
          />
          <Field label="Name shown to patients" required {...bind('name')} />
          <Field label="Price from (PHP)" type="number" min="0" step="0.01" required {...bind('price')} />
          <Field label="Price up to (PHP, optional)" type="number" min="0" step="0.01" {...bind('price_max')} />
          <Field label="Duration (minutes)" type="number" min="5" max="480" step="5" required hint="Used to reserve the dentist's time." {...bind('duration_minutes')} />
          <Field label="Longest duration (optional)" type="number" min="5" max="480" step="5" hint="Shown to patients only." {...bind('duration_max')} />
          <Field label="Description" as="textarea" required className="is-wide" {...bind('description')} />
          <div className="is-wide">
            <Checkbox label="Available for booking" checked={form.is_available} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))} />
          </div>
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function Services({ query, editing, setEditing }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(null);
  const archive = useMutation({
    mutationFn: () => archiveClinicService(clinicId, removing.id),
    onSuccess: () => {
      setRemoving(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'services'] });
    },
  });

  return (
    <>
      <QueryState query={query} loadingLabel="Loading services…">
        {(services) => (
          <div className="clinic-data-card">
            <div className="clinic-data-scroll">
              <table className="clinic-data-table">
                <caption className="visually-hidden">Clinic services</caption>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price Range</th>
                    <th scope="col">Duration</th>
                    <th scope="col" className="is-end">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td data-label="Service">
                        <span className="clinic-cell-title">{service.name}</span>
                        {!service.is_available && <span className="clinic-cell-sub">Not available for booking</span>}
                      </td>
                      <td data-label="Category">
                        <Pill tone="info">{service.category}</Pill>
                      </td>
                      <td data-label="Price Range">{formatPriceRange(Number(service.price), Number(service.price_max ?? service.price))}</td>
                      <td data-label="Duration">{durationLabel(service)}</td>
                      <td data-label="" className="is-end">
                        <div className="clinic-row-actions">
                          <button type="button" className="clinic-icon-action" aria-label={`Edit ${service.name}`} onClick={() => setEditing(service)}>
                            <Icon name="pencil" size={18} />
                          </button>
                          <button
                            type="button"
                            className="clinic-icon-action is-danger"
                            aria-label={`Remove ${service.name}`}
                            onClick={() => {
                              archive.reset();
                              setRemoving(service);
                            }}
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={5} className="clinic-empty-row">
                        No services yet. Add one before publishing your clinic.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </QueryState>
      {editing && <ServiceModal service={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message="Patients can no longer book it. Past appointments keep their history."
          confirmLabel="Remove"
          danger
          isBusy={archive.isPending}
          error={archive.error}
          onConfirm={() => archive.mutate()}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}

function ClinicServicesPage() {
  const { clinicId, can } = useClinicAccess();
  const [editing, setEditing] = useState(null);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId), enabled: can('clinic.services.manage') });

  return (
    <ClinicLayout section="services" title="Clinic Profile" subtitle="Manage your clinic information" requires={['clinic.services.manage']} hideSearch>
      <ClinicProfileTabs clinicId={clinicId} can={can} active="services" />
      <div className="clinic-page-intro">
        <p className="clinic-admin-card-sub">Manage the services and pricing offered at your clinic.</p>
        <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Add Service
        </button>
      </div>
      <Services query={query} editing={editing} setEditing={setEditing} />
    </ClinicLayout>
  );
}

export default ClinicServicesPage;
