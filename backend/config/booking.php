<?php

return [

    // Timezone clinic hours and appointment times are expressed in.
    'timezone' => env('BUSINESS_TIMEZONE', 'Asia/Manila'),

    // Appointment start times are offered on this grid (minutes).
    'slot_minutes' => (int) env('BOOKING_SLOT_MINUTES', 30),

    // Earliest booking: this many minutes from now.
    'minimum_notice_minutes' => (int) env('BOOKING_MINIMUM_NOTICE_MINUTES', 60),

    // Latest booking: this many days ahead.
    'max_days_ahead' => (int) env('BOOKING_MAX_DAYS_AHEAD', 90),

    // Patients may cancel or reschedule until this many hours before the start.
    'patient_change_cutoff_hours' => (int) env('BOOKING_PATIENT_CHANGE_CUTOFF_HOURS', 24),

    // Reminders go out this many hours before the appointment.
    'reminder_hours_before' => (int) env('BOOKING_REMINDER_HOURS_BEFORE', 24),

    // Inventory batches expiring within this many days are flagged.
    'near_expiry_days' => (int) env('INVENTORY_NEAR_EXPIRY_DAYS', 30),
];
