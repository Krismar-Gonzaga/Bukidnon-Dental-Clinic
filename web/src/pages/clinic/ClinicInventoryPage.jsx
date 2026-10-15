import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import {
  createInventoryCategory,
  createInventoryItem,
  createSupplier,
  getInventoryAlerts,
  getInventoryCategories,
  getInventoryItems,
} from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

function Alerts() {
  const { clinicId } = useClinic();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'alerts'], queryFn: () => getInventoryAlerts(clinicId) });
  const itemHref = (id) => `${getClinicHref(clinicId, 'inventory')}/${id}`;

  return (
    <Section title="Needs attention" subtitle="Low stock counts only usable (unexpired) stock.">
      <QueryState query={query} loadingLabel="Checking stock…">
        {({ low_stock: low, near_expiry: near, expired }) =>
          low.length + near.length + expired.length === 0 ? (
            <p className="portal-empty">Nothing needs attention.</p>
          ) : (
            <ul className="portal-list">
              {expired.map((a) => (
                <li key={`e-${a.batch_id}`} className="portal-list-item">
                  <Badge tone="danger">Expired</Badge> <a href={itemHref(a.item_id)}>{a.name}</a> — batch {a.batch_number ?? a.batch_id}, {a.quantity} {a.unit}, expired {a.expires_on}. Dispose and record it.
                </li>
              ))}
              {near.map((a) => (
                <li key={`n-${a.batch_id}`} className="portal-list-item">
                  <Badge tone="warning">Expiring</Badge> <a href={itemHref(a.item_id)}>{a.name}</a> — {a.quantity} {a.unit} expire {a.expires_on}
                </li>
              ))}
              {low.map((a) => (
                <li key={`l-${a.item_id}`} className="portal-list-item">
                  <Badge tone="warning">Low stock</Badge> <a href={itemHref(a.item_id)}>{a.name}</a> — {a.quantity} {a.unit} left (minimum {a.minimum_stock})
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Section>
  );
}

function NewItemModal({ onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'categories'], queryFn: () => getInventoryCategories(clinicId) });
  const [form, setForm] = useState({ name: '', unit: 'box', minimum_stock: '0', category_id: '', description: '' });
  const [newCategory, setNewCategory] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      let categoryId = form.category_id || null;
      if (newCategory.trim()) categoryId = (await createInventoryCategory(clinicId, newCategory.trim())).data.id;
      return createInventoryItem(clinicId, { ...form, category_id: categoryId, minimum_stock: Number(form.minimum_stock) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title="Add inventory item" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field label="Name" required className="is-wide" {...bind('name')} />
          <Field label="Unit" required hint="e.g. box, piece, ml" {...bind('unit')} />
          <Field label="Minimum stock" type="number" min="0" {...bind('minimum_stock')} />
          <Field
            label="Category"
            as="select"
            options={[{ value: '', label: 'None' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
            {...bind('category_id')}
          />
          <Field label="…or new category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <Field label="Description" as="textarea" className="is-wide" {...bind('description')} />
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Add item</button>
        </div>
      </form>
    </Modal>
  );
}

function NewSupplierModal({ onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '' });
  const save = useMutation({
    mutationFn: () => createSupplier(clinicId, Object.fromEntries(Object.entries(form).filter(([, v]) => v))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory', 'suppliers'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title="Add supplier" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field label="Name" required className="is-wide" {...bind('name')} />
          <Field label="Contact person" {...bind('contact_person')} />
          <Field label="Phone" type="tel" {...bind('phone')} />
          <Field label="Email" type="email" className="is-wide" {...bind('email')} />
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Add supplier</button>
        </div>
      </form>
    </Modal>
  );
}

function Items() {
  const { clinicId, can } = useClinic();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const debounced = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'inventory', 'items', debounced, status],
    queryFn: () => getInventoryItems(clinicId, { search: debounced || undefined, status: status || undefined }),
  });

  return (
    <Section
      title="Items"
      actions={
        can('inventory.manage') && (
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal('supplier')}>Add supplier</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('item')}>Add item</button>
          </>
        )
      }
    >
      <div className="portal-toolbar">
        <Field label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Field
          label="Show"
          as="select"
          options={[
            { value: '', label: 'Active items' },
            { value: 'low_stock', label: 'Low stock only' },
            { value: 'inactive', label: 'Inactive items' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
      <QueryState query={query} loadingLabel="Loading inventory…">
        {(items) => (
          <DataTable
            caption="Inventory items"
            rows={items}
            emptyText="No items yet."
            columns={[
              { key: 'name', label: 'Item', render: (i) => <a href={`${getClinicHref(clinicId, 'inventory')}/${i.id}`}>{i.name}</a> },
              { key: 'category', label: 'Category', render: (i) => i.category ?? '—' },
              { key: 'quantity_usable', label: 'Usable stock', render: (i) => `${i.quantity_usable} ${i.unit}` },
              { key: 'minimum_stock', label: 'Minimum', render: (i) => `${i.minimum_stock} ${i.unit}` },
              {
                key: 'state',
                label: 'Status',
                render: (i) => (
                  <>
                    {i.is_low_stock && <Badge tone="warning">Low stock</Badge>}{' '}
                    {i.quantity_expired > 0 && <Badge tone="danger">{i.quantity_expired} expired</Badge>}
                    {!i.is_low_stock && i.quantity_expired === 0 && <Badge tone="success">OK</Badge>}
                  </>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      {modal === 'item' && <NewItemModal onClose={() => setModal(null)} />}
      {modal === 'supplier' && <NewSupplierModal onClose={() => setModal(null)} />}
    </Section>
  );
}

function ClinicInventoryPage() {
  return (
    <ClinicLayout section="inventory" title="Inventory" requires={['inventory.view']}>
      <div className="portal-stack">
        <Alerts />
        <Items />
      </div>
    </ClinicLayout>
  );
}

export default ClinicInventoryPage;
