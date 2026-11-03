// Services & prices (web: ClinicServicesPage). Retiring a service means
// marking it unavailable, so past appointments keep their history.
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, EmptyState, Field, FormError, LoadState, SelectField, Sheet, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { createService, fetchServiceCatalog, fetchServices, formatPeso, serverMessage, ServiceRate, updateService } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

function ServiceSheet({ clinicId, service, onClose, onSaved }: { clinicId: number; service: ServiceRate | null; onClose: () => void; onSaved: () => void }) {
  const catalog = useLoader(() => fetchServiceCatalog(), []);
  const [serviceId, setServiceId] = useState<number | null>(service?.service_id ?? null);
  const [form, setForm] = useState({
    name: service?.name ?? '',
    price: service ? String(service.price) : '',
    duration_minutes: service ? String(service.duration_minutes) : '30',
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
      duration_minutes: Number(form.duration_minutes),
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
      <Field label="Price (PHP)" required keyboardType="decimal-pad" {...bind('price')} />
      <Field label="Duration (minutes)" required keyboardType="number-pad" hint="Used to reserve the dentist's time (5–480)." {...bind('duration_minutes')} />
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

  return (
    <ClinicScreen title="Services & Prices" active="ClinicServices">
      <FlatList
        data={list.data ?? []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <View style={ui.between}>
              <View style={ui.flex}>
                <Text style={ui.heading}>Services & prices</Text>
                <Text style={ui.muted}>Published on your clinic page. To retire a service, mark it unavailable.</Text>
              </View>
              <Button small variant="tonal" icon="add" label="Add" onPress={() => setEditing('new')} />
            </View>
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="pricetags-outline" text="No services yet. Add your first service." />}
        renderItem={({ item }) => (
          <View style={ui.listItem}>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{item.name}</Text>
              <Badge tone={item.is_available ? 'success' : 'neutral'} label={item.is_available ? 'Available' : 'Unavailable'} />
            </View>
            <Text style={ui.muted}>
              {formatPeso(Number(item.price))} · {item.duration_minutes} min{item.category ? ` · ${item.category}` : ''}
            </Text>
            {item.description ? <Text style={ui.small} numberOfLines={2}>{item.description}</Text> : null}
            <Button small variant="outline" icon="create-outline" label="Edit" onPress={() => setEditing(item)} />
          </View>
        )}
      />
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
