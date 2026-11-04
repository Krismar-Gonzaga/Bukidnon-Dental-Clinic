// Inventory (web: ClinicInventoryPage): what needs attention (low stock,
// expiring and expired batches), the item list with search and filters,
// adding items, and suppliers.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyState,
  Field,
  FormError,
  LoadState,
  Pager,
  SearchBox,
  SelectField,
  Sheet,
  StatGrid,
  ui,
  useLoader,
  useRefreshOnFocus,
} from '../../components/clinic/ClinicUi';
import {
  fetchStockHistory,
  formatDateTime,
  formatPeso,
  stockStatus,
  can,
  createInventoryCategory,
  createInventoryItem,
  createSupplier,
  fetchInventoryAlerts,
  fetchInventoryCategories,
  fetchInventoryItems,
  fetchSuppliers,
  InventoryItem,
  serverMessage,
} from '../../services/clinicPortal';
import { formatDateKey } from '../../services/booking';
import { palette } from '../../theme/tokens';

const SHOW = [
  { id: '', label: 'Active items' },
  { id: 'low_stock', label: 'Low stock only' },
  { id: 'inactive', label: 'Inactive items' },
];

type Tab = 'items' | 'suppliers';

function AddItemSheet({ clinicId, onClose, onSaved }: { clinicId: number; onClose: () => void; onSaved: (item: InventoryItem) => void }) {
  const categories = useLoader(() => fetchInventoryCategories(clinicId), [clinicId]);
  const [form, setForm] = useState({ name: '', unit: '', minimum_stock: '0', description: '' });
  const [categoryId, setCategoryId] = useState<number>(0);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // A new category name wins over the list choice, as on the web form.
      const category = newCategory.trim() ? await createInventoryCategory(clinicId, newCategory.trim()) : null;
      const item = await createInventoryItem(clinicId, {
        name: form.name.trim(),
        unit: form.unit.trim(),
        minimum_stock: Number(form.minimum_stock) || 0,
        description: form.description.trim() || null,
        category_id: category?.id ?? (categoryId || null),
      });
      onSaved(item);
    } catch (err) {
      setError(serverMessage(err, 'The item could not be added.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add inventory item" onClose={onClose}>
      <Field label="Name" required {...bind('name')} />
      <Field label="Unit" required hint="e.g. box, piece, ml" autoCapitalize="none" {...bind('unit')} />
      <Field label="Minimum stock" keyboardType="number-pad" {...bind('minimum_stock')} />
      <SelectField
        label="Category"
        value={categoryId}
        onChange={setCategoryId}
        options={[{ id: 0, label: 'No category' }, ...(categories.data ?? []).map((c) => ({ id: c.id, label: c.name }))]}
      />
      <Field label="…or new category" value={newCategory} onChangeText={setNewCategory} />
      <Field label="Description" multiline {...bind('description')} />
      <FormError message={error} />
      <Button label="Add item" style={ui.spacedTop} busy={busy} disabled={!form.name.trim() || !form.unit.trim()} onPress={save} />
    </Sheet>
  );
}

function AddSupplierSheet({ clinicId, onClose, onSaved }: { clinicId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await createSupplier(clinicId, Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])));
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The supplier could not be added.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add supplier" onClose={onClose}>
      <Field label="Name" required {...bind('name')} />
      <Field label="Contact person" autoCapitalize="words" {...bind('contact_person')} />
      <Field label="Phone" keyboardType="phone-pad" {...bind('phone')} />
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" {...bind('email')} />
      <FormError message={error} />
      <Button label="Add supplier" style={ui.spacedTop} busy={busy} disabled={!form.name.trim()} onPress={save} />
    </Sheet>
  );
}

const ClinicInventoryScreen = ({ route }: { route?: { params?: { lowStock?: boolean; addItem?: boolean } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const canManage = can(membership, 'inventory.manage');
  const [tab, setTab] = useState<Tab>('items');
  const [status, setStatus] = useState(route?.params?.lowStock ? 'low_stock' : '');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [sheet, setSheet] = useState<'item' | 'supplier' | 'history' | null>(route?.params?.addItem ? 'item' : null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const alerts = useLoader(() => fetchInventoryAlerts(clinicId), [clinicId], 'Stock alerts could not be loaded.');
  const items = useLoader(() => fetchInventoryItems(clinicId, { search: term || undefined, status: status || undefined }), [clinicId, term, status], 'Items could not be loaded.');
  const suppliers = useLoader(() => fetchSuppliers(clinicId), [clinicId], 'Suppliers could not be loaded.');
  const refreshAll = () => {
    alerts.sync();
    items.sync();
    suppliers.sync();
  };
  useRefreshOnFocus(refreshAll);

  const openItem = (itemId: number, receive = false) => navigation.navigate('ClinicInventoryItem', { itemId, receive });
  const a = alerts.data;
  const attention = a ? a.low_stock.length + a.near_expiry.length + a.expired.length : 0;

  return (
    <ClinicScreen title="Inventory" active="ClinicInventory">
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={items.refreshing} onRefresh={() => { items.refresh(); alerts.sync(); suppliers.sync(); }} colors={[palette.primary]} />}
      >
        {items.data && (
          <StatGrid
            stats={[
              { label: 'Total Items', value: items.data.length, icon: 'cube-outline' },
              { label: 'Low Stock', value: items.data.filter((i) => stockStatus(i) === 'low').length, icon: 'warning-outline' },
              { label: 'Critical', value: items.data.filter((i) => stockStatus(i) === 'critical').length, icon: 'alert-circle-outline' },
              { label: 'Total Value', value: formatPeso(items.data.reduce((sum, i) => sum + i.quantity_usable * Number(i.unit_cost ?? 0), 0)), icon: 'cash-outline' },
            ]}
          />
        )}
        <Button small variant="outline" icon="time-outline" label="Stock History" onPress={() => setSheet('history')} />
        <Card title="Needs attention" subtitle="Low stock counts only usable (unexpired) stock.">
          <LoadState loading={alerts.loading} error={alerts.error} onRetry={alerts.reload} />
          {a && attention === 0 && <Text style={ui.muted}>Nothing needs attention.</Text>}
          {a?.expired.map((row) => (
            <AlertRow key={`e-${row.batch_id}`} tone="danger" label="Expired" title={row.name} onPress={() => openItem(row.item_id)}
              detail={`Batch ${row.batch_number ?? row.batch_id}, ${row.quantity} ${row.unit}, expired ${row.expires_on ? formatDateKey(row.expires_on) : ''}. Dispose and record it.`} />
          ))}
          {a?.near_expiry.map((row) => (
            <AlertRow key={`n-${row.batch_id}`} tone="warning" label="Expiring" title={row.name} onPress={() => openItem(row.item_id)}
              detail={`${row.quantity} ${row.unit} expire ${row.expires_on ? formatDateKey(row.expires_on) : ''}`} />
          ))}
          {a?.low_stock.map((row) => (
            <AlertRow key={`l-${row.item_id}`} tone="warning" label="Low stock" title={row.name} onPress={() => openItem(row.item_id, canManage)}
              detail={`${row.quantity} ${row.unit} left (minimum ${row.minimum_stock})`} />
          ))}
        </Card>

        <Chips options={[{ id: 'items' as Tab, label: 'Items' }, { id: 'suppliers' as Tab, label: 'Suppliers' }]} value={tab} onChange={setTab} />

        {tab === 'items' ? (
          <Card title="Items" action={canManage ? <Button small variant="tonal" icon="add" label="Add item" onPress={() => setSheet('item')} /> : undefined}>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search items…" />
            <Chips options={SHOW} value={status} onChange={setStatus} />
            <LoadState loading={items.loading} error={items.error} onRetry={items.reload} />
            {items.data && items.data.length === 0 && <EmptyState icon="cube-outline" text="No items match." />}
            {(items.data ?? []).map((item) => (
              <TouchableOpacity key={item.id} style={ui.listItem} onPress={() => openItem(item.id)} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
                <View style={ui.between}>
                  <Text style={[ui.title, ui.flex]}>{item.name}</Text>
                  {!item.is_active ? <Badge status="inactive" label="Inactive" /> : item.is_low_stock ? <Badge status="low" label="Low stock" /> : <Badge tone="success" label="OK" />}
                </View>
                <Text style={ui.muted}>
                  {item.quantity_usable} {item.unit} usable · minimum {item.minimum_stock}
                </Text>
                {item.category ? <Text style={ui.small}>{item.category}</Text> : null}
              </TouchableOpacity>
            ))}
          </Card>
        ) : (
          <Card title="Suppliers" action={canManage ? <Button small variant="tonal" icon="add" label="Add supplier" onPress={() => setSheet('supplier')} /> : undefined}>
            <LoadState loading={suppliers.loading} error={suppliers.error} onRetry={suppliers.reload} />
            {suppliers.data && suppliers.data.length === 0 && <EmptyState icon="car-outline" text="No suppliers yet." />}
            {(suppliers.data ?? []).map((s) => (
              <View key={s.id} style={ui.listItem}>
                <Text style={ui.title}>{s.name}</Text>
                <Text style={ui.muted}>{[s.contact_person, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {sheet === 'item' && (
        <AddItemSheet
          clinicId={clinicId}
          onClose={() => setSheet(null)}
          onSaved={(item) => {
            setSheet(null);
            refreshAll();
            if (item?.id) openItem(item.id, true);
          }}
        />
      )}
      {sheet === 'history' && <StockHistorySheet clinicId={clinicId} onClose={() => setSheet(null)} />}
      {sheet === 'supplier' && (
        <AddSupplierSheet
          clinicId={clinicId}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            suppliers.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

function StockHistorySheet({ clinicId, onClose }: { clinicId: number; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useLoader(() => fetchStockHistory(clinicId, page), [clinicId, page], 'Stock history could not be loaded.');
  return (
    <Sheet title="Stock History" onClose={onClose}>
      <LoadState loading={history.loading} error={history.data ? null : history.error} onRetry={history.reload} />
      {history.data?.items.length === 0 && <EmptyState icon="time-outline" text="No stock changes yet." />}
      {history.data?.items.map((row) => (
        <View key={row.id} style={[ui.listItem, ui.spacedTop]}>
          <View style={ui.between}>
            <Text style={[ui.title, ui.flex]}>{row.item_name ?? row.item ?? 'Item'}</Text>
            <Text style={ui.title}>
              {row.quantity > 0 ? '+' : ''}
              {row.quantity}
            </Text>
          </View>
          <Text style={ui.muted}>Balance {row.balance_after}{row.reason ? ` · ${row.reason}` : ''}</Text>
          <Text style={ui.small}>{[formatDateTime(row.at), row.performed_by].filter(Boolean).join(' · ')}</Text>
        </View>
      ))}
      {history.data && <Pager page={page} lastPage={history.data.meta.last_page} onChange={setPage} />}
    </Sheet>
  );
}

function AlertRow({ tone, label, title, detail, onPress }: { tone: 'danger' | 'warning'; label: string; title: string; detail: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ui.listItem} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${title}. ${detail}`}>
      <View style={ui.between}>
        <Badge tone={tone} label={label} />
        <Icon name="chevron-forward" size={16} color={palette.outline} />
      </View>
      <Text style={ui.title}>{title}</Text>
      <Text style={ui.muted}>{detail}</Text>
    </TouchableOpacity>
  );
}

export default ClinicInventoryScreen;
