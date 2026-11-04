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

        // Owner / administrator. Runs the clinic and may read and write clinical
        // records; every read and change of a record is written to the audit log.
        'clinic_admin' => [
            'clinic.view',
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
            'patients.manage',
            'inventory.view',
            'inventory.manage',
            'feedback.view',
            'feedback.respond',
            'reports.view',
            'records.view',
            'records.write',
            'clinic.settings.manage',
            'clinic.permissions.manage',
            'clinic.audit.view',
            'subscription.manage',
        ],

        // Treats patients: sees their own schedule, answers requests made to them, writes
        // clinical records, and is the only one who issues prescriptions and certificates.
        'dentist' => [
            'clinic.view',
            'appointments.view_assigned',
            'appointments.review_assigned',
            'appointments.progress',
            'patients.view',
            'records.view',
            'records.write',
            'documents.issue',
        ],

        // Front desk: runs the schedule, check-in and patient registration. Sees a
        // patient's allergy and condition alerts (every view is logged), but cannot
        // read or change clinical records and notes.
        'staff' => [
            'clinic.view',
            'appointments.view_all',
            'appointments.manage',
            'patients.view',
            'patients.manage',
            'patients.medical_alerts',
        ],

        'inventory_staff' => [
            'clinic.view',
            'inventory.view',
            'inventory.manage',
        ],
    ],

    /*
    | Positions of "staff" members, and what each module of the clinic's permission table
    | grants. clinic_admin keeps its own list above. records.*, clinic.permissions.manage
    | and clinic.audit.view are deliberately in no module: they cannot be handed out.
    */
    'staff_positions' => [
        'office_manager' => ['label' => 'Office Manager', 'modules' => ['appointments', 'patients', 'inventory', 'reports', 'staff']],
        'receptionist' => ['label' => 'Receptionist', 'modules' => ['appointments', 'patients']],
        'dental_assistant' => ['label' => 'Dental Assistant', 'modules' => ['appointments', 'patients', 'inventory']],
        'dental_hygienist' => ['label' => 'Dental Hygienist', 'modules' => ['appointments', 'patients']],
    ],

    'staff_modules' => [
        'appointments' => ['appointments.view_all', 'appointments.manage'],
        'patients' => ['patients.view', 'patients.manage', 'patients.medical_alerts'],
        'inventory' => ['inventory.view', 'inventory.manage'],
        'reports' => ['reports.view'],
        'dentists' => ['clinic.dentists.manage', 'clinic.schedules.manage'],
        'staff' => ['clinic.staff.manage'],
        'reviews' => ['feedback.view', 'feedback.respond'],
        'subscription' => ['subscription.manage'],
        'settings' => ['clinic.profile.manage', 'clinic.settings.manage'],
    ],

    // What the Add Staff form may choose for one person, instead of their position's defaults.
    'staff_assignable' => [
        'appointments.view_all',
        'appointments.manage',
        'patients.view',
        'patients.manage',
        'patients.medical_alerts',
        'inventory.view',
        'inventory.manage',
        'reports.view',
        'clinic.staff.manage',
    ],

];
