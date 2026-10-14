// Time-of-day greeting for the dashboard welcome banner.
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function countAppointmentsByStatus(appointments, status) {
  return appointments.filter((appointment) => appointment.status === status)
    .length;
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}
