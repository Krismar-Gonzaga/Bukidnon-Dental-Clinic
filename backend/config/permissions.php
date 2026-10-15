<?php

/*
|--------------------------------------------------------------------------
| Clinic role permissions
|--------------------------------------------------------------------------
|
| A user's access inside a clinic comes from their active row in
| `clinic_memberships`. Each membership has one role, and each role grants
| the permissions listed here. Permissions are checked server-side by the
| `clinic.permission` middleware and User::hasClinicPermission().
|
| Platform-wide administration is separate: it requires users.role =
| 'system_admin' and does NOT grant access to clinical records.
|
*/

return [

    'clinic_roles' => [

        // Owner / administrator. Runs the clinic but does not read or write
        // clinical records by default (records.* is deliberately absent).
        'clinic_admin' => [
            'clinic.profile.manage',
            'clinic.branches.manage',
            'clinic.services.manage',
            'clinic.dentists.manage',
            'clinic.schedules.manage',
            'clinic.staff.manage',
            'clinic.verification.submit',
            'appointments.view_all',
            'appointments.manage',
            'patients.view',
            'inventory.view',
            'inventory.manage',
            'feedback.view',
            'reports.view',
        ],

        // Treats patients: sees their own schedule and writes clinical records.
        'dentist' => [
            'appointments.view_assigned',
            'appointments.progress',
            'patients.view',
            'records.view',
            'records.write',
        ],

        // Receptionist: runs the schedule and patient registration, but
        // cannot read or change clinical treatment notes.
        'staff' => [
            'appointments.view_all',
            'appointments.manage',
            'patients.view',
            'patients.manage',
        ],

        'inventory_staff' => [
            'inventory.view',
            'inventory.manage',
        ],
    ],

];
