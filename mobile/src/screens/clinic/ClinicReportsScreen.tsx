// Appointment report (web: ClinicReportsPage): counts for a date range in
// Philippine time. Aggregate figures only, no patient-level details.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Card, EmptyState, FormError, InfoRow, LoadState, StatGrid, ui, useLoader } from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import { fetchAppointmentReport, statusLabel } from '../../services/clinicPortal';
import { toBusinessDateKey } from '../../services/booking';
import { palette } from '../../theme/tokens';

const ClinicReportsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const validRange = Boolean(from && to && from <= to);
  const report = useLoader(
    () => (validRange ? fetchAppointmentReport(clinicId, from, to) : Promise.resolve(null)),
    [clinicId, from, to, validRange],
    'The report could not be built.',
  );
  const data = report.data;

  return (
    <ClinicScreen title="Reports" active="ClinicReports">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={report.refreshing} onRefresh={report.refresh} colors={[palette.primary]} />}>
        <Card title="Appointment report" subtitle="Counts for the chosen dates (Philippine time).">
          <View style={ui.row}>
            <DateField label="From" value={from} onChange={(v) => v && setFrom(v)} />
            <DateField label="To" value={to} onChange={(v) => v && setTo(v)} />
          </View>
          {!validRange && <FormError message="The start date must be on or before the end date." />}
        </Card>

        <LoadState loading={report.loading} error={data ? null : report.error} onRetry={report.reload} />
        {data && (
          <>
            <StatGrid
              stats={[
                ...Object.entries(data.by_status).map(([status, total]) => ({ label: statusLabel(status), value: total })),
                { label: 'New patients', value: data.new_patients, icon: 'person-add-outline' },
                { label: 'Reviews', value: data.reviews.count, icon: 'chatbox-outline' },
                { label: 'Average rating', value: data.reviews.count ? data.reviews.average : '—', icon: 'star-outline' },
              ]}
            />
            <Card title="By service">
              {data.by_service.length === 0 ? <EmptyState text="No appointments." /> : data.by_service.map((r) => <InfoRow key={r.service} label={r.service} value={r.total} />)}
            </Card>
            <Card title="By dentist">
              {data.by_dentist.length === 0 ? <EmptyState text="No appointments." /> : data.by_dentist.map((r) => <InfoRow key={r.dentist} label={r.dentist} value={r.total} />)}
            </Card>
            <Text style={ui.small}>
              Report for {data.from} to {data.to}.
            </Text>
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

export default ClinicReportsScreen;
