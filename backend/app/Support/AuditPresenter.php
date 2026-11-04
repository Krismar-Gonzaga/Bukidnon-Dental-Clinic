<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\SubscriptionPayment;
use App\Models\SystemAnnouncement;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Readable audit entries for the admin web and mobile apps: label, category,
 * outcome, actor and a one-line detail. Names are looked up for clinics,
 * registrations and accounts only; patients stay "Patient #id".
 */
class AuditPresenter
{
    /** Category => [label, action prefixes]. */
    public const CATEGORIES = [
        'security' => ['Security / Sign-in', ['auth.', 'admin.password_']],
        'verification' => ['Clinic verification', ['clinic_application.']],
        'clinics' => ['Clinic management', ['clinic.', 'branch.', 'service.', 'dentist.', 'schedule.', 'membership.', 'inventory.']],
        'accounts' => ['Account administration', ['admin.user_updated', 'admin.system_admin_created']],
        'records' => ['Patient records', ['records.', 'patient.']],
        'subscription' => ['Subscription', ['subscription.']],
        'appointments' => ['Appointments', ['appointment.']],
        'reviews' => ['Reviews', ['review.']],
        'audit' => ['Audit log', ['audit.']],
        'notifications' => ['System notifications', ['announcement.']],
        'settings' => ['System settings', ['settings.', 'report.']],
    ];

    /** High-impact administrative actions (the "Critical Actions" count). */
    public const CRITICAL_ACTIONS = [
        'clinic_application.approved',
        'clinic_application.rejected',
        'clinic_application.documents_requested',
        'clinic_application.exported',
        'clinic.suspended',
        'clinic.reactivated',
        'admin.user_updated',
        'admin.system_admin_created',
        'review.moderated',
        'records.amended',
        'audit.exported',
        'subscription.plan_changed',
        'settings.updated',
        'announcement.published',
    ];

    private const OUTCOMES = [
        'auth.login_failed' => 'failed',
        'admin.password_confirm_failed' => 'failed',
        'auth.login_blocked' => 'blocked',
        'subscription.payment_submitted' => 'pending',
    ];

    private const LABELS = [
        'auth.login' => 'Signed in',
        'auth.logout' => 'Signed out',
        'auth.login_failed' => 'Failed sign-in attempt',
        'auth.login_blocked' => 'Blocked sign-in (suspended account)',
        'auth.registered' => 'Account registered',
        'auth.password_changed' => 'Password changed',
        'auth.password_reset' => 'Password reset',
        'auth.password_reset_requested' => 'Password reset requested',
        'admin.password_confirmed' => 'Admin password confirmed',
        'admin.password_confirm_failed' => 'Admin password check failed',
        'admin.user_updated' => 'Updated user account',
        'admin.system_admin_created' => 'System administrator created',
        'clinic_application.created' => 'Registration started',
        'clinic_application.submitted' => 'Registration submitted',
        'clinic_application.document_uploaded' => 'Verification document uploaded',
        'clinic_application.document_accessed' => 'Verification document opened',
        'clinic_application.review_started' => 'Registration review started',
        'clinic_application.note_added' => 'Internal note added',
        'clinic_application.approved' => 'Approved clinic registration',
        'clinic_application.rejected' => 'Returned clinic registration',
        'clinic_application.documents_requested' => 'Requested more documents',
        'clinic_application.exported' => 'Exported registrations (CSV)',
        'clinic.suspended' => 'Suspended clinic',
        'clinic.reactivated' => 'Reactivated clinic',
        'clinic.published' => 'Clinic listed in directory',
        'clinic.unpublished' => 'Clinic hidden from directory',
        'clinic.profile_updated' => 'Clinic profile updated',
        'review.moderated' => 'Moderated review',
        'review.reported' => 'Review reported',
        'review.created' => 'Review posted',
        'records.viewed' => 'Viewed patient record',
        'records.listed' => 'Listed patient records',
        'records.created' => 'Created patient record',
        'records.amended' => 'Amended patient record',
        'appointment.created' => 'New appointment request',
        'appointment.walk_in' => 'Walk-in registered',
        'appointment.rescheduled' => 'Appointment rescheduled',
        'appointment.status_changed' => 'Appointment status changed',
        'patient.registered' => 'Patient registered',
        'patient.updated' => 'Patient details updated',
        'patient.viewed' => 'Viewed patient',
        'membership.invited' => 'Team member invited',
        'membership.accepted' => 'Invitation accepted',
        'membership.declined' => 'Invitation declined',
        'membership.updated' => 'Team member updated',
        'inventory.item_created' => 'Inventory item added',
        'inventory.item_updated' => 'Inventory item updated',
        'service.created' => 'Service added',
        'service.updated' => 'Service updated',
        'branch.created' => 'Branch added',
        'branch.updated' => 'Branch updated',
        'branch.hours_updated' => 'Branch hours updated',
        'dentist.updated' => 'Dentist profile updated',
        'dentist.schedule_updated' => 'Dentist schedule updated',
        'schedule.block_added' => 'Schedule block added',
        'schedule.block_removed' => 'Schedule block removed',
        'schedule.holiday_added' => 'Holiday added',
        'schedule.holiday_removed' => 'Holiday removed',
        'contact.message_received' => 'Contact form message received',
        'auth.two_factor_enabled' => 'Turned on two-factor sign-in',
        'auth.two_factor_disabled' => 'Turned off two-factor sign-in',
        'auth.two_factor_failed' => 'Failed two-factor sign-in',
        'auth.two_factor_recovery_used' => 'Used a two-factor recovery code',
        'clinic.settings_updated' => 'Updated clinic settings',
        'clinic.permissions_updated' => 'Updated role permissions',
        'membership.password_reset_sent' => 'Sent a staff password reset link',
        'records.file_uploaded' => 'Uploaded a patient file',
        'records.file_downloaded' => 'Downloaded a patient file',
        'records.summary_viewed' => 'Viewed patient medical summaries',
        'records.finalized' => 'Finalized a clinical note',
        'records.draft_updated' => 'Updated a draft clinical note',
        'records.visit_notes_updated' => 'Updated treatment notes on a visit',
        'records.visit_notes_listed' => 'Listed appointments with treatment notes',
        'records.chart_viewed' => 'Viewed a dental chart',
        'records.chart_updated' => 'Updated a dental chart',
        'records.checklist_updated' => 'Updated a pre-procedure checklist',
        'records.prescriptions_listed' => 'Listed prescriptions',
        'records.prescription_issued' => 'Issued a prescription',
        'records.prescription_printed' => 'Printed a prescription',
        'records.certificate_issued' => 'Issued a dental certificate',
        'records.follow_up_created' => 'Scheduled a follow-up',
        'records.follow_up_updated' => 'Updated a follow-up',
        'records.files_listed' => 'Listed patient files',
        'dentist.schedule_change_requested' => 'Requested a schedule change',
        'dentist.schedule_change_submitted' => 'Sent a schedule change for approval',
        'dentist.schedule_change_cancelled' => 'Cancelled a schedule change request',
        'dentist.schedule_change_approved' => 'Approved a schedule change',
        'dentist.schedule_change_rejected' => 'Declined a schedule change',
        'auth.session_revoked' => 'Signed out of a device',
        'auth.other_sessions_revoked' => 'Signed out of all other devices',
        'auth.two_factor_codes_regenerated' => 'Created new two-factor recovery codes',
        'records.alerts_viewed' => 'Viewed patient medical alerts',
        'appointment.front_desk_notes_updated' => 'Updated front-desk notes',
        'membership.contact_updated' => 'Updated own contact details',
        'review.replied' => 'Replied to a review',
        'service.removed' => 'Removed a service',
        'branch.removed' => 'Removed a branch',
        'subscription.payment_submitted' => 'Submitted proof of payment',
        'subscription.payment_verified' => 'Verified a subscription payment',
        'subscription.payment_rejected' => 'Rejected a subscription payment',
        'subscription.renewal_requested' => 'Requested a subscription renewal',
        'patient.health_profile_updated' => 'Patient updated their health profile',
        'patient.consents_changed' => 'Patient changed their consents',
        'subscription.proof_opened' => 'Opened a payment proof',
        'subscription.plan_changed' => 'Changed a clinic\'s plan',
        'announcement.created' => 'Created an announcement',
        'announcement.updated' => 'Updated an announcement',
        'announcement.published' => 'Published an announcement',
        'announcement.archived' => 'Archived an announcement',
        'settings.updated' => 'Updated system settings',
        'report.exported' => 'Exported a report (CSV)',
        'audit.exported' => 'Exported audit log (CSV)',
        'audit.integrity_checked' => 'Ran audit integrity check',
    ];

    private const DETAIL_KEYS = ['reason' => 'Reason', 'note' => 'Note', 'email' => 'Email', 'role' => 'Role', 'status' => 'Status', 'to' => 'To', 'rows' => 'Rows'];

    /** Stored as identifiers (system_admin, under_review): shown with spaces. */
    private const CODE_KEYS = ['role', 'status', 'to'];

    public static function label(string $action): string
    {
        return self::LABELS[$action] ?? Str::ucfirst(str_replace(['_', '.'], [' ', ': '], $action));
    }

    public static function category(string $action): ?string
    {
        foreach (self::CATEGORIES as $key => [, $prefixes]) {
            foreach ($prefixes as $prefix) {
                if (str_starts_with($action, $prefix)) {
                    return $key;
                }
            }
        }

        return null;
    }

    public static function outcome(string $action): string
    {
        return self::OUTCOMES[$action] ?? 'success';
    }

    /** Restricts a query to one category. */
    public static function whereCategory(Builder $query, string $category): Builder
    {
        return $query->where(function ($q) use ($category) {
            foreach (self::CATEGORIES[$category][1] as $prefix) {
                $q->orWhere('action', 'like', $prefix.'%');
            }
        });
    }

    /** Actor and subject names for a page of entries: one query per table. */
    public static function lookups(Collection $logs): array
    {
        $ids = fn (string $type) => $logs->where('subject_type', $type)->pluck('subject_id')->filter()->unique()->values();
        $userIds = $logs->pluck('user_id')->filter()->merge($ids('User'))->unique()->values();
        $users = $userIds->isEmpty() ? collect() : User::whereIn('id', $userIds)->get(['id', 'name', 'role'])->keyBy('id');
        $names = fn (string $model, string $column, Collection $keys) => $keys->isEmpty() ? collect() : $model::whereIn('id', $keys)->pluck($column, 'id');

        return [
            'users' => $users,
            'labels' => [
                'ClinicApplication' => $names(ClinicApplication::class, 'clinic_name', $ids('ClinicApplication')),
                'Clinic' => $names(Clinic::class, 'name', $ids('Clinic')),
                'User' => $users->map->name,
                'SubscriptionPayment' => self::paymentClinicNames($ids('SubscriptionPayment')),
                'SystemAnnouncement' => $names(SystemAnnouncement::class, 'title', $ids('SystemAnnouncement')),
            ],
        ];
    }

    /** Audit entries for a payment show the clinic it came from. */
    private static function paymentClinicNames(Collection $paymentIds): Collection
    {
        if ($paymentIds->isEmpty()) {
            return collect();
        }

        return SubscriptionPayment::with('clinic:id,name')->whereIn('id', $paymentIds)->get(['id', 'clinic_id'])
            ->mapWithKeys(fn (SubscriptionPayment $payment) => [$payment->id => $payment->clinic?->name]);
    }

    /** Action codes whose readable label contains the words typed in the search box. */
    public static function actionsMatching(string $term): array
    {
        $term = mb_strtolower($term);

        return array_keys(array_filter(self::LABELS, fn (string $label) => str_contains(mb_strtolower($label), $term)));
    }

    public static function present(AuditLog $log, array $lookups): array
    {
        $actor = $lookups['users'][$log->user_id] ?? null;
        $subject = $log->subject_type ? ($lookups['labels'][$log->subject_type][$log->subject_id] ?? null) : null;

        return [
            'id' => $log->id,
            'action' => $log->action,
            'label' => self::label($log->action),
            'category' => self::category($log->action),
            'module' => self::CATEGORIES[self::category($log->action)][0] ?? null,
            'outcome' => self::outcome($log->action),
            'user_id' => $log->user_id,
            'user_name' => $actor?->name,
            'user_role' => $actor?->role,
            'clinic_id' => $log->clinic_id,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'subject_label' => $subject ?? ($log->subject_type ? Str::headline($log->subject_type).' #'.$log->subject_id : null),
            'detail' => self::detail($log->metadata ?? []),
            'metadata' => $log->metadata,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'sealed' => $log->hash !== null,
            'created_at' => BusinessTime::iso($log->created_at),
        ];
    }

    private static function detail(array $metadata): ?string
    {
        $parts = [];
        foreach (self::DETAIL_KEYS as $key => $label) {
            if (isset($metadata[$key]) && is_scalar($metadata[$key]) && $metadata[$key] !== '') {
                $value = (string) $metadata[$key];
                $parts[] = $label.': '.Str::limit(in_array($key, self::CODE_KEYS, true) ? str_replace('_', ' ', $value) : $value, 120);
            }
        }
        if (! empty($metadata['download'])) {
            $parts[] = 'Downloaded';
        }

        return $parts ? implode(' · ', $parts) : null;
    }
}
