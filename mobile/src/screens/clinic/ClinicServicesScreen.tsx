// Services & prices (web: ClinicServicesPage). Retiring a service means
// marking it unavailable, so past appointments keep their history.
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { ClinicProfileTabs } from '../../components/clinic/ClinicAdminKit';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, EmptyState, Field, FormError, LoadState, SelectField, Sheet, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { createService, fetchServiceCatalog, fetchServices, formatPeso, serverMessage, ServiceRate, updateService, archiveService } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

const priceLabel = ({ price, price_max: max }: ServiceRate) =>
  max && Number(max) !== Number(price) ? `${formatPeso(Number(price))} – ${formatPeso(Number(max))}` : formatPeso(Number(price));
const durationLabel = ({ duration_minutes: from, duration_max: to }: ServiceRate) => (to && Number(to) !== Number(from) ? `${from}–${to} min` : `${from} min`);

function ServiceSheet({ clinicId, service, onClose, onSaved }: { clinicId: number; service: ServiceRate | null; onClose: () => void; onSaved: () => void }) {
  const catalog = useLoader(() => fetchServiceCatalog(), []);
  const [serviceId, setServiceId] = useState<number | null>(service?.service_id ?? null);
  const [form, setForm] = useState({
    name: service?.name ?? '',
    price: service ? String(service.price) : '',
    price_max: service?.price_max != null ? String(service.price_max) : '',
    duration_minutes: service ? String(service.duration_minutes) : '30',
    duration_max: service?.duration_max != null ? String(service.duration_max) : '',
    description: service?.description ?? '',
  });
  const [available, setAvailable] = useState(service?.is_available ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });
  const valid = serviceId && form.name.trim() && form.description.trim() && form.price !== '' && Number(form.duration_minutes) >= 5;

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      service_id: serviceId,
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      price_max: form.price_max === '' ? null : Number(form.price_max),
      duration_minutes: Number(form.duration_minutes),
      duration_max: form.duration_max === '' ? null : Number(form.duration_max),
      is_available: available,
    };
    try {
      if (service) await updateService(clinicId, service.id, body);
      else await createService(clinicId, body);
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The service could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={service ? 'Edit service' : 'Add service'} onClose={onClose}>
      <SelectField label="Category" required value={serviceId} onChange={setServiceId} options={(catalog.data ?? []).map((c) => ({ id: c.id, label: c.name }))} />
      <Field label="Name shown to patients" required {...bind('name')} />
      <Field label="Price from (PHP)" required keyboardType="decimal-pad" {...bind('price')} />
      <Field label="Price up to (PHP, optional)" keyboardType="decimal-pad" {...bind('price_max')} />
      <Field label="Duration (minutes)" required keyboardType="number-pad" hint="Used to reserve the dentist's time (5–480)." {...bind('duration_minutes')} />
      <Field label="Longest duration (optional)" keyboardType="number-pad" hint="Shown to patients only." {...bind('duration_max')} />
      <Field label="Description" required multiline {...bind('description')} />
      <Toggle label="Available for booking" value={available} onChange={setAvailable} />
      <FormError message={error} />
      <Button label={service ? 'Save service' : 'Add service'} style={ui.spacedTop} busy={busy} disabled={!valid} onPress={save} />
    </Sheet>
  );
}

const ClinicServicesScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const list = useLoader(() => fetchServices(clinicId), [clinicId], 'Services could not be loaded.');
  const [editing, setEditing] = useState<ServiceRate | 'new' | null>(null);
  const [removing, setRemoving] = useState<ServiceRate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await archiveService(clinicId, removing.id);
      setRemoving(null);
      list.sync();
    } catch (err) {
      setError(serverMessage(err, 'The service could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="Clinic Profile" active="ClinicServices">
      <FlatList
        data={list.data ?? []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <ClinicProfileTabs active="ClinicServices" />
            <Text style={ui.muted}>Manage the services and pricing offered at your clinic.</Text>
            <Button icon="add" label="Add Service" onPress={() => setEditing('new')} />
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="pricetags-outline" text="No services yet. Add your first service." />}
        renderItem={({ item }) => (
          <View style={ui.listItem}>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{item.name}</Text>
              {item.category ? <Badge tone="info" label={item.category} /> : null}
            </View>
            <Text style={ui.muted}>
              {priceLabel(item)} · {durationLabel(item)}
            </Text>
            {!item.is_available && <Text style={ui.small}>Not available for booking</Text>}
            {item.description ? <Text style={ui.small} numberOfLines={2}>{item.description}</Text> : null}
            <View style={ui.rowWrap}>
              <Button small variant="outline" icon="create-outline" label="Edit" onPress={() => setEditing(item)} />
              <Button
                small
                variant="danger"
                icon="trash-outline"
                label="Remove"
                onPress={() => {
                  setError(null);
                  setRemoving(item);
                }}
              />
            </View>
          </View>
        )}
      />
      {removing && (
        <Sheet title={`Remove ${removing.name}?`} onClose={() => setRemoving(null)}>
          <Text style={ui.muted}>Patients can no longer book it. Past appointments keep their history.</Text>
          <FormError message={error} />
          <Button label="Remove" variant="danger" style={ui.spacedTop} busy={busy} onPress={remove} />
        </Sheet>
      )}
      {editing && (
        <ServiceSheet
          clinicId={clinicId}
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

export default ClinicServicesScreen;
