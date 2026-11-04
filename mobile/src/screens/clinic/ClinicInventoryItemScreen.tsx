// One inventory item (web: ClinicInventoryItemPage): batches, recording a
// stock movement (receive, use, adjust, dispose), the movement history and
// deactivating. "Reorder Now" on the dashboard opens it ready to receive stock.
import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, InfoRow, LoadState, SelectField, ui, useLoader } from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import {
  can,
  fetchInventoryItem,
  fetchSuppliers,
  formatDateTime,
  InventoryItem,
  InventoryMovement,
  recordMovement,
  serverMessage,
  updateInventoryItem,
} from '../../services/clinicPortal';
import { formatDateKey } from '../../services/booking';
import { palette } from '../../theme/tokens';

const MOVEMENT_TYPES: { id: InventoryMovement['type']; label: string; hint: string }[] = [
  { id: 'receipt', label: 'Receive', hint: 'Receive stock (new batch)' },
  { id: 'usage', label: 'Use', hint: 'Use stock (earliest expiry first)' },
  { id: 'adjustment', label: 'Adjust', hint: 'Adjust a batch after a count' },
  { id: 'disposal', label: 'Dispose', hint: 'Dispose from a batch (expired/damaged)' },
];
const MOVEMENT_LABELS: Record<InventoryMovement['type'], string> = { receipt: 'Received', usage: 'Used', adjustment: 'Adjusted', disposal: 'Disposed' };

const EMPTY = { quantity: '', reason: '', batch_number: '', expires_on: '' };

function MovementForm({ clinicId, item, onSaved }: { clinicId: number; item: InventoryItem; onSaved: () => void }) {
  const suppliers = useLoader(() => fetchSuppliers(clinicId), [clinicId]);
  const [type, setType] = useState<InventoryMovement['type']>('receipt');
  const [form, setForm] = useState(EMPTY);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsBatch = type === 'adjustment' || type === 'disposal';
  const batches = (item.batches ?? []).filter((b) => b.quantity_on_hand > 0 || type === 'adjustment');
  const bind = (name: keyof typeof EMPTY) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });
  const quantity = Number(form.quantity);
  const valid = Number.isInteger(quantity) && quantity !== 0 && (type === 'adjustment' || quantity > 0) && (!needsBatch || (batchId && form.reason.trim()));

  const save = async () => {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { type, quantity, reason: form.reason.trim() || undefined };
    if (needsBatch) body.batch_id = batchId;
    if (type === 'receipt') {
      Object.assign(body, {
        batch_number: form.batch_number.trim() || undefined,
        expires_on: form.expires_on || undefined,
        supplier_id: supplierId || undefined,
      });
    }
    try {
      await recordMovement(clinicId, item.id, body);
      setForm(EMPTY);
      onSaved();
      Alert.alert('Saved', 'The movement is recorded.');
    } catch (err) {
      setError(serverMessage(err, 'The movement could not be recorded.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Record stock movement" subtitle="Every change is kept in the movement history with your name and reason.">
      <Chips options={MOVEMENT_TYPES} value={type} onChange={(t) => { setType(t); setBatchId(null); setError(null); }} scroll={false} />
      <Text style={ui.small}>{MOVEMENT_TYPES.find((m) => m.id === type)?.hint}</Text>
      {needsBatch && (
        <SelectField
          label="Batch"
          required
          value={batchId}
          onChange={setBatchId}
          options={batches.map((b) => ({
            id: b.id,
            label: `${b.batch_number ?? `#${b.id}`} · ${b.quantity_on_hand} ${item.unit}${b.expires_on ? ` · exp ${b.expires_on}` : ''}`,
          }))}
        />
      )}
      <Field
        label={type === 'adjustment' ? 'Change (+ adds, − removes)' : 'Quantity'}
        required
        keyboardType={type === 'adjustment' ? 'numbers-and-punctuation' : 'number-pad'}
        {...bind('quantity')}
      />
      {type === 'receipt' && (
        <>
          <Field label="Batch / lot number" {...bind('batch_number')} />
          <DateField label="Expires on" value={form.expires_on} onChange={(v) => setForm((f) => ({ ...f, expires_on: v }))} clearable />
          <SelectField
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={[{ id: 0, label: 'None' }, ...(suppliers.data ?? []).map((s) => ({ id: s.id, label: s.name }))]}
          />
        </>
      )}
      <Field label={needsBatch ? 'Reason (required)' : 'Reason'} required={needsBatch} {...bind('reason')} />
      <FormError message={error} />
      <Button label="Record movement" style={ui.spacedTop} busy={busy} disabled={!valid} onPress={save} />
    </Card>
  );
}

const ClinicInventoryItemScreen = ({ route }: { route: { params: { itemId: number; receive?: boolean } } }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { itemId, receive } = route.params;
  const detail = useLoader(() => fetchInventoryItem(clinicId, itemId), [clinicId, itemId], 'This item could not be loaded.');
  const [toggling, setToggling] = useState(false);
  const item = detail.data;
  const canManage = can(membership, 'inventory.manage');

  const toggleActive = () => {
    if (!item) return;
    const deactivating = item.is_active;
    Alert.alert(deactivating ? 'Deactivate item?' : 'Reactivate item?', deactivating ? 'It stops counting toward low-stock alerts. History is kept.' : 'It will count toward stock alerts again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: deactivating ? 'Deactivate' : 'Reactivate',
        style: deactivating ? 'destructive' : 'default',
        onPress: async () => {
          setToggling(true);
          try {
            await updateInventoryItem(clinicId, item.id, { is_active: !item.is_active });
            await detail.sync();
          } catch (err) {
            Alert.alert('Not saved', serverMessage(err, 'Please try again.'));
          } finally {
            setToggling(false);
          }
        },
      },
    ]);
  };

  return (
    <ClinicScreen title={item?.name ?? 'Inventory item'} active="ClinicInventory" back>
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} colors={[palette.primary]} />}
      >
        <LoadState loading={detail.loading} error={item ? null : detail.error} onRetry={detail.reload} />
        {item && (
          <>
            <Card
              title={item.name}
              subtitle={`${item.quantity_usable} ${item.unit} usable · minimum ${item.minimum_stock}${item.category ? ` · ${item.category}` : ''}`}
              action={!item.is_active ? <Badge status="inactive" label="Inactive" /> : item.is_low_stock ? <Badge status="low" label="Low stock" /> : undefined}
            >
              {item.description ? <Text style={ui.muted}>{item.description}</Text> : null}
              {item.quantity_expired > 0 ? <InfoRow label="Expired stock" value={`${item.quantity_expired} ${item.unit}`} /> : null}
              {canManage && (
                <Button small variant={item.is_active ? 'danger' : 'outline'} label={item.is_active ? 'Deactivate' : 'Reactivate'} busy={toggling} onPress={toggleActive} />
              )}
            </Card>

            {receive && canManage && item.is_active && <Text style={ui.success}>Receive the new stock below.</Text>}
            {canManage && item.is_active && <MovementForm clinicId={clinicId} item={item} onSaved={detail.sync} />}

            <Card title="Batches">
              {(item.batches ?? []).length === 0 && <EmptyState icon="cube-outline" text="No stock received yet." />}
              {(item.batches ?? []).map((b) => (
                <View key={b.id} style={ui.listItem}>
                  <View style={ui.between}>
                    <Text style={[ui.title, ui.flex]}>{b.batch_number ?? `#${b.id}`}</Text>
                    {b.is_expired ? <Badge tone="danger" label="Expired" /> : b.is_near_expiry ? <Badge tone="warning" label="Expiring soon" /> : <Badge tone="success" label="Usable" />}
                  </View>
                  <Text style={ui.muted}>
                    {b.quantity_on_hand} {item.unit} on hand · expires {b.expires_on ? formatDateKey(b.expires_on) : '—'}
                  </Text>
                  {b.supplier ? <Text style={ui.small}>Supplier: {b.supplier}</Text> : null}
                </View>
              ))}
            </Card>

            <Card title="Movement history" subtitle="Most recent 100 movements">
              {(item.movements ?? []).length === 0 && <EmptyState icon="swap-vertical-outline" text="No movements yet." />}
              {(item.movements ?? []).map((m) => (
                <View key={m.id} style={ui.stackItem}>
                  <View style={ui.between}>
                    <Text style={ui.title}>
                      {MOVEMENT_LABELS[m.type] ?? m.type} {m.quantity > 0 && m.type === 'adjustment' ? `+${m.quantity}` : m.quantity} {item.unit}
                    </Text>
                    <Text style={ui.small}>Balance {m.balance_after}</Text>
                  </View>
                  <Text style={ui.small}>
                    {formatDateTime(m.at)} · {m.performed_by ?? '—'}
                  </Text>
                  {m.reason ? <Text style={ui.muted}>{m.reason}</Text> : null}
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

export default ClinicInventoryItemScreen;
