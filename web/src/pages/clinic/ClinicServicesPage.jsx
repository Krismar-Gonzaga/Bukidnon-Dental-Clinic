import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, Checkbox, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { createClinicService, getClinicServices, getServiceCategories, updateClinicService } from '../../services/clinicPortalApi';
import { formatPriceRange } from '../../services/adapters';

const EMPTY = { service_id: '', name: '', description: '', price: '', duration_minutes: '30', is_available: true };

function ServiceModal({ service, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['services', 'catalog', 'raw'], queryFn: getServiceCategories, staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState(
    service
      ? { service_id: String(service.service_id), name: service.name, description: service.description, price: service.price, duration_minutes: String(service.duration_minutes), is_available: service.is_available }
      : EMPTY
  );
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, service_id: Number(form.service_id), price: Number(form.price), duration_minutes: Number(form.duration_minutes) };
      return service ? updateClinicService(clinicId, service.id, body) : createClinicService(clinicId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'services'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={service ? 'Edit service' : 'Add service'} onClose={onClose}>
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
          <Field label="Price (PHP)" type="number" min="0" step="0.01" required {...bind('price')} />
          <Field label="Duration (minutes)" type="number" min="5" max="480" step="5" required hint="Used to reserve the dentist's time." {...bind('duration_minutes')} />
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

function Services() {
  const { clinicId } = useClinic();
  const [editing, setEditing] = useState(null);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId) });

  return (
    <Section
      title="Services & prices"
      subtitle="Published on your clinic page. To retire a service, mark it unavailable so past appointments keep their history."
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>Add service</button>}
    >
      <QueryState query={query} loadingLabel="Loading services…">
        {(services) => (
          <DataTable
            caption="Clinic services"
            rows={services}
            emptyText="No services yet. Add one before publishing your clinic."
            columns={[
              { key: 'name', label: 'Service' },
              { key: 'category', label: 'Category' },
              { key: 'price', label: 'Price', render: (s) => formatPriceRange(Number(s.price), Number(s.price)) },
              { key: 'duration_minutes', label: 'Duration', render: (s) => `${s.duration_minutes} min` },
              { key: 'is_available', label: 'Status', render: (s) => <Badge tone={s.is_available ? 'success' : 'neutral'}>{s.is_available ? 'Available' : 'Unavailable'}</Badge> },
              { key: 'edit', label: '', render: (s) => <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(s)}>Edit</button> },
            ]}
          />
        )}
      </QueryState>
      {editing && <ServiceModal service={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function ClinicServicesPage() {
  return (
    <ClinicLayout section="services" title="Services & Prices" requires={['clinic.services.manage']}>
      <Services />
    </ClinicLayout>
  );
}

export default ClinicServicesPage;
