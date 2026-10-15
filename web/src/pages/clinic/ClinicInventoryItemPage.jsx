import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge, DataTable, Field, FormError, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getInventoryItem, getSuppliers, recordMovement, updateInventoryItem } from '../../services/clinicPortalApi';
import { formatDateTime } from '../../utils/dateTime';

const MOVEMENT_TYPES = [
  { value: 'receipt', label: 'Receive stock (new batch)' },
  { value: 'usage', label: 'Use stock (earliest expiry first)' },
  { value: 'adjustment', label: 'Adjust a batch after a count' },
  { value: 'disposal', label: 'Dispose from a batch (expired/damaged)' },
];

function MovementForm({ item }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const suppliers = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'suppliers'], queryFn: () => getSuppliers(clinicId) });
  const [form, setForm] = useState({ type: 'receipt', quantity: '', reason: '', batch_id: '', batch_number: '', expires_on: '', supplier_id: '' });
  const needsBatch = form.type === 'adjustment' || form.type === 'disposal';

  const save = useMutation({
    mutationFn: () => {
      const body = { type: form.type, quantity: Number(form.quantity), reason: form.reason || undefined };
      if (needsBatch) body.batch_id = Number(form.batch_id);
      if (form.type === 'receipt') {
        Object.assign(body, {
          batch_number: form.batch_number || undefined,
          expires_on: form.expires_on || undefined,
          supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
        });
      }
      return recordMovement(clinicId, item.id, body);
    },
    onSuccess: () => {
      setForm((f) => ({ ...f, quantity: '', reason: '', batch_number: '', expires_on: '' }));
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory'] });
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const batches = item.batches.filter((b) => b.quantity_on_hand > 0 || form.type === 'adjustment');

  return (
    <Section title="Record stock movement" subtitle="Every change is kept in the movement history with your name and reason.">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field label="Movement" as="select" options={MOVEMENT_TYPES} className="is-wide" {...bind('type')} />
          <Field
            label={form.type === 'adjustment' ? 'Change (+ adds, − removes)' : 'Quantity'}
            type="number"
            required
            min={form.type === 'adjustment' ? undefined : 1}
            {...bind('quantity')}
          />
          {needsBatch && (
            <Field
              label="Batch"
              as="select"
              required
              options={[{ value: '', label: 'Choose…' }, ...batches.map((b) => ({ value: String(b.id), label: `${b.batch_number ?? `#${b.id}`} · ${b.quantity_on_hand} ${item.unit}${b.expires_on ? ` · exp ${b.expires_on}` : ''}` }))]}
              {...bind('batch_id')}
            />
          )}
          {form.type === 'receipt' && (
            <>
              <Field label="Batch / lot number" {...bind('batch_number')} />
              <Field label="Expires on" type="date" {...bind('expires_on')} />
              <Field
                label="Supplier"
                as="select"
                options={[{ value: '', label: '—' }, ...(suppliers.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
                {...bind('supplier_id')}
              />
            </>
          )}
          <Field label={needsBatch ? 'Reason (required)' : 'Reason'} required={needsBatch} className="is-wide" {...bind('reason')} />
        </div>
        <FormError error={save.error} />
        {save.isSuccess && <p className="portal-success portal-spaced-top" role="status">Movement recorded.</p>}
        <div className="portal-form-actions">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || !form.quantity}>
            Record movement
          </button>
        </div>
      </form>
    </Section>
  );
}

function ItemDetail({ itemId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'item', itemId], queryFn: () => getInventoryItem(clinicId, itemId) });
  const toggle = useMutation({
    mutationFn: (isActive) => updateInventoryItem(clinicId, itemId, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory'] }),
  });

  return (
    <div className="portal-stack">
      <a href={getClinicHref(clinicId, 'inventory')} className="patient-back-link">
        <Icon name="chevronLeft" size={16} />
        Back to inventory
      </a>
      <QueryState query={query} loadingLabel="Loading item…">
        {(item) => (
          <>
            <Section
              title={item.name}
              subtitle={`${item.quantity_usable} ${item.unit} usable · minimum ${item.minimum_stock}${item.category ? ` · ${item.category}` : ''}`}
              actions={
                can('inventory.manage') && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => toggle.mutate(!item.is_active)}>
                    {item.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )
              }
            >
              <DataTable
                caption="Batches"
                rows={item.batches}
                emptyText="No stock received yet."
                columns={[
                  { key: 'batch_number', label: 'Batch', render: (b) => b.batch_number ?? `#${b.id}` },
                  { key: 'quantity_on_hand', label: 'On hand', render: (b) => `${b.quantity_on_hand} ${item.unit}` },
                  { key: 'expires_on', label: 'Expires', render: (b) => b.expires_on ?? '—' },
                  { key: 'supplier', label: 'Supplier', render: (b) => b.supplier ?? '—' },
                  {
                    key: 'state',
                    label: 'Status',
                    render: (b) =>
                      b.is_expired ? <Badge tone="danger">Expired</Badge> : b.is_near_expiry ? <Badge tone="warning">Expiring soon</Badge> : <Badge tone="success">Usable</Badge>,
                  },
                ]}
              />
              <FormError error={toggle.error} />
            </Section>

            {can('inventory.manage') && item.is_active && <MovementForm item={item} />}

            <Section title="Movement history" subtitle="Most recent 100 movements">
              <DataTable
                caption="Stock movements"
                rows={item.movements}
                emptyText="No movements yet."
                columns={[
                  { key: 'at', label: 'When', render: (m) => formatDateTime(m.at) },
                  { key: 'type', label: 'Type', render: (m) => <Badge>{m.type}</Badge> },
                  { key: 'quantity', label: 'Change', render: (m) => (m.quantity > 0 ? `+${m.quantity}` : m.quantity) },
                  { key: 'balance_after', label: 'Batch balance' },
                  { key: 'reason', label: 'Reason', render: (m) => m.reason ?? '—' },
                  { key: 'performed_by', label: 'By' },
                ]}
              />
            </Section>
          </>
        )}
      </QueryState>
    </div>
  );
}

function ClinicInventoryItemPage() {
  const { itemId } = useParams();
  return (
    <ClinicLayout section="inventory" title="Inventory item" requires={['inventory.view']}>
      <ItemDetail itemId={itemId} />
    </ClinicLayout>
  );
}

export default ClinicInventoryItemPage;
