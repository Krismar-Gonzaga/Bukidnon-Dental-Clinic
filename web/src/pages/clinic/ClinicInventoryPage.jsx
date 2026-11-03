import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { FilterSelect, Pill, SearchInput, StatTile } from '../../components/clinic/ClinicUi';
import { ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState, QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import {
  createInventoryCategory,
  createInventoryItem,
  createSupplier,
  getInventoryAlerts,
  getInventoryCategories,
  getInventoryItems,
  getStockHistory,
  updateInventoryItem,
} from '../../services/clinicPortalApi';
import { dateFromKey, formatDateTime } from '../../utils/dateTime';
import './ClinicInventoryPage.css';

const peso = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount ?? 0);
const expiryLabel = (key) => (key ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(dateFromKey(key)) : '—');

/** Critical: none usable, or at most half the minimum. Low: at or under the minimum. */
export function stockStatus(item) {
  const quantity = item.quantity_usable;
  if (quantity === 0 || (item.minimum_stock > 0 && quantity <= item.minimum_stock / 2)) return 'critical';
  return quantity <= item.minimum_stock ? 'low' : 'good';
}

const STOCK_LABELS = {
  good: { label: 'Good', tone: 'success' },
  low: { label: 'Low', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'good', label: 'Good' },
  { value: 'low', label: 'Low' },
  { value: 'critical', label: 'Critical' },
  { value: 'archived', label: 'Archived' },
];

const MOVEMENT_LABELS = { receipt: 'Received', usage: 'Used', adjustment: 'Adjusted', disposal: 'Disposed' };

// Add or edit an item. Stock itself changes through movements on the item page.
function ItemModal({ item, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'categories'], queryFn: () => getInventoryCategories(clinicId) });
  const [form, setForm] = useState({
    name: item?.name ?? '',
    brand: item?.brand ?? '',
    unit: item?.unit ?? 'box',
    unit_cost: item?.unit_cost ?? '',
    minimum_stock: String(item?.minimum_stock ?? 0),
    category_id: item?.category_id ? String(item.category_id) : '',
    description: item?.description ?? '',
  });
  const [newCategory, setNewCategory] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      let categoryId = form.category_id ? Number(form.category_id) : null;
      if (newCategory.trim()) categoryId = (await createInventoryCategory(clinicId, newCategory.trim())).data.id;
      const body = {
        ...form,
        brand: form.brand.trim() || null,
        unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
        category_id: categoryId,
        minimum_stock: Number(form.minimum_stock),
      };
      return item ? updateInventoryItem(clinicId, item.id, body) : createInventoryItem(clinicId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add inventory item'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="portal-form-grid">
          <Field label="Name" required className="is-wide" maxLength={255} {...bind('name')} />
          <Field label="Brand" maxLength={100} {...bind('brand')} />
          <Field label="Unit" required hint="e.g. box, piece, ml" maxLength={30} {...bind('unit')} />
          <Field label="Unit cost (₱)" type="number" min="0" step="0.01" {...bind('unit_cost')} />
          <Field label="Minimum stock" type="number" min="0" {...bind('minimum_stock')} />
          <Field label="Category" as="select" options={[{ value: '', label: 'None' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]} {...bind('category_id')} />
          <Field label="…or new category" maxLength={100} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <Field label="Description" as="textarea" className="is-wide" {...bind('description')} />
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : item ? 'Save item' : 'Add item'}
          </button>
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

function StockHistoryModal({ onClose }) {
  const { clinicId } = useClinic();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'inventory', 'history', page],
    queryFn: () => getStockHistory(clinicId, { page, per_page: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <Modal title="Stock history" onClose={onClose} wide>
      <QueryState query={query} loadingLabel="Loading stock history…">
        {({ items, meta }) => (
          <>
            <div className="clinic-data-scroll">
              <table className="clinic-data-table">
                <caption className="visually-hidden">Stock movements</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Item</th>
                    <th scope="col">Change</th>
                    <th scope="col">Balance</th>
                    <th scope="col">By</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.at)}</td>
                      <td>{m.item}</td>
                      <td>
                        {MOVEMENT_LABELS[m.type] ?? m.type} {m.quantity > 0 ? '+' : ''}
                        {m.quantity} {m.unit}
                      </td>
                      <td>{m.balance_after}</td>
                      <td>{m.performed_by ?? '—'}</td>
                      <td>{m.reason || '—'}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="clinic-empty-row">
                        No stock movements yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TableFooter meta={meta} perPage={15} onPageChange={setPage} noun="movements" label="Stock history pages" />
          </>
        )}
      </QueryState>
    </Modal>
  );
}

function AlertsBanner({ items, alerts }) {
  const critical = items.filter((item) => stockStatus(item) === 'critical').length;
  const low = items.filter((item) => stockStatus(item) === 'low').length;
  const expired = alerts?.expired?.length ?? 0;
  const expiring = alerts?.near_expiry?.length ?? 0;
  if (critical + low + expired + expiring === 0) return null;

  return (
    <section className="clinic-inventory-alert" aria-label="Inventory alerts">
      <Icon name="alertTriangle" size={24} />
      <div>
        <h2 className="clinic-inventory-alert-title">Inventory Alerts</h2>
        <p className="clinic-inventory-alert-text">
          {critical > 0 && <strong>{critical} item(s) critically low. </strong>}
          {low > 0 && <>{low} item(s) below minimum stock level. </>}
          {expired > 0 && <strong>{expired} batch(es) expired: open the item to dispose of them. </strong>}
          {expiring > 0 && <>{expiring} batch(es) expiring soon. </>}
          Review and restock as soon as possible.
        </p>
      </div>
    </section>
  );
}

function Inventory({ showingAdd, setShowingAdd }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const canManage = can('inventory.manage');
  const showArchived = status === 'archived';

  const active = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'items', 'active'], queryFn: () => getInventoryItems(clinicId, {}) });
  const archived = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'items', 'archived'], queryFn: () => getInventoryItems(clinicId, { status: 'inactive' }), enabled: showArchived });
  const alerts = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'alerts'], queryFn: () => getInventoryAlerts(clinicId) });
  const archive = useMutation({
    mutationFn: () => updateInventoryItem(clinicId, archiving.id, { is_active: !archiving.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'inventory'] });
      setArchiving(null);
    },
  });

  const listQuery = showArchived ? archived : active;
  const items = active.data ?? [];
  const value = items.reduce((sum, item) => sum + item.quantity_usable * (item.unit_cost ?? 0), 0);
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
  const term = search.trim().toLowerCase();
  const visible = (listQuery.data ?? []).filter(
    (item) =>
      (!term || `${item.name} ${item.brand ?? ''}`.toLowerCase().includes(term)) &&
      (!category || item.category === category) &&
      (showArchived || !status || stockStatus(item) === status)
  );

  return (
    <div className="clinic-inventory">
      {active.isError ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : active.isPending ? (
        <LoadingState label="Loading inventory…" />
      ) : (
        <>
          <div className="clinic-inventory-stats">
            <StatTile icon="clipboardList" tone="blue" value={items.length} label="Total Items" note="Across all categories" />
            <StatTile icon="alertTriangle" tone="amber" value={items.filter((item) => stockStatus(item) === 'low').length} label="Low Stock" note="Below minimum level" />
            <StatTile icon="alertCircle" tone="red" value={items.filter((item) => stockStatus(item) === 'critical').length} label="Critical" note="Needs immediate restock" />
            <StatTile icon="barChart" tone="green" value={peso(value)} label="Total Value" note="Usable stock × unit cost" />
          </div>
          <AlertsBanner items={items} alerts={alerts.data} />
        </>
      )}

      <div className="clinic-toolbar clinic-inventory-toolbar">
        <SearchInput label="Search items" placeholder="Search items..." value={search} onChange={setSearch} />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={[{ value: '', label: 'All categories' }, ...categories.map((name) => ({ value: name, label: name }))]} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        {canManage && (
          <button type="button" className="clinic-mini-button is-positive clinic-inventory-supplier" onClick={() => setIsAddingSupplier(true)}>
            Add supplier
          </button>
        )}
      </div>

      {listQuery.isPending ? (
        <LoadingState label="Loading items…" />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
      ) : (
        <div className="clinic-data-card">
          <div className="clinic-data-scroll">
            <table className="clinic-data-table">
              <caption className="visually-hidden">Inventory items</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Brand</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Min.Stock</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Unit Cost</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-end">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const stock = STOCK_LABELS[stockStatus(item)];
                  return (
                    <tr key={item.id}>
                      <td>
                        <a href={`${getClinicHref(clinicId, 'inventory')}/${item.id}`} className="clinic-cell-title">
                          {item.name}
                        </a>
                      </td>
                      <td>{item.category ?? '—'}</td>
                      <td>{item.brand ?? '—'}</td>
                      <td>
                        <strong className={`clinic-stock-qty is-${stock.tone}`}>{item.quantity_usable}</strong>
                      </td>
                      <td>{item.unit}</td>
                      <td>{item.minimum_stock}</td>
                      <td>{expiryLabel(item.next_expiry)}</td>
                      <td>{item.unit_cost == null ? '—' : peso(item.unit_cost)}</td>
                      <td>{item.is_active ? <Pill tone={stock.tone}>{stock.label}</Pill> : <Pill>Archived</Pill>}</td>
                      <td className="is-end">
                        {canManage && (
                          <div className="clinic-row-actions">
                            <button type="button" className="clinic-icon-action" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
                              <Icon name="pencil" size={18} />
                            </button>
                            <button
                              type="button"
                              className="clinic-icon-action"
                              aria-label={`${item.is_active ? 'Archive' : 'Restore'} ${item.name}`}
                              onClick={() => {
                                archive.reset();
                                setArchiving(item);
                              }}
                            >
                              <Icon name={item.is_active ? 'download' : 'history'} size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={10} className="clinic-empty-row">
                      No items match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showingAdd && <ItemModal onClose={() => setShowingAdd(false)} />}
      {editing && <ItemModal item={editing} onClose={() => setEditing(null)} />}
      {isAddingSupplier && <NewSupplierModal onClose={() => setIsAddingSupplier(false)} />}
      {archiving && (
        <ConfirmDialog
          title={`${archiving.is_active ? 'Archive' : 'Restore'} ${archiving.name}?`}
          message={archiving.is_active ? 'It leaves the list and the stock alerts. Its batches and history are kept, and you can restore it.' : 'It returns to the list and the stock alerts.'}
          confirmLabel={archiving.is_active ? 'Archive item' : 'Restore item'}
          isBusy={archive.isPending}
          error={archive.error}
          onConfirm={() => archive.mutate()}
          onCancel={() => setArchiving(null)}
        />
      )}
    </div>
  );
}

function HistoryButton({ onClick }) {
  return (
    <button type="button" className="btn btn-outline clinic-header-button" onClick={onClick}>
      <Icon name="history" size={18} />
      Stock History
    </button>
  );
}

function ClinicInventoryPage() {
  const { can } = useClinicAccess();
  // ?new=1 (the dashboard's Add Inventory) opens the add-item form.
  const [searchParams] = useSearchParams();
  const [isAdding, setIsAdding] = useState(searchParams.get('new') === '1' && can('inventory.manage'));
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  return (
    <ClinicLayout
      section="inventory"
      title="Inventory Management"
      subtitle="Stock levels, costs and expiry across the clinic"
      requires={['inventory.view']}
      hideSearch
      headerActions={
        <>
          <HistoryButton onClick={() => setIsViewingHistory(true)} />
          {can('inventory.manage') && (
            <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsAdding(true)}>
              <Icon name="plus" size={18} />
              Add Item
            </button>
          )}
        </>
      }
    >
      <Inventory showingAdd={isAdding} setShowingAdd={setIsAdding} />
      {isViewingHistory && <StockHistoryModal onClose={() => setIsViewingHistory(false)} />}
    </ClinicLayout>
  );
}

export default ClinicInventoryPage;
