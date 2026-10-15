<?php

namespace App\Services;

use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\User;
use App\Notifications\ClinicMembershipInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Adding people to a clinic.
 * - Unknown email: a new account is created (role from the membership) and
 *   the person gets a link to set their own password. Active immediately.
 * - Existing account: an invitation they must accept.
 * A dentist membership always has a dentist profile.
 */
class MembershipService
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function invite(Clinic $clinic, string $email, string $name, string $role, User $inviter): ClinicMembership
    {
        $email = strtolower(trim($email));

        [$membership, $setupUrl] = DB::transaction(function () use ($clinic, $email, $name, $role, $inviter) {
            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
            $setupUrl = null;

            if ($user) {
                if ($user->role === 'system_admin') {
                    throw new ConflictHttpException('System administrator accounts cannot join a clinic.');
                }
                if (ClinicMembership::where('clinic_id', $clinic->id)->where('user_id', $user->id)->exists()) {
                    throw new ConflictHttpException('This person is already a member of the clinic.');
                }
                $status = ClinicMembership::STATUS_INVITED;
            } else {
                $user = new User(['name' => $name, 'email' => $email, 'password' => Str::password(32)]);
                $user->role = $role === ClinicMembership::ROLE_INVENTORY_STAFF ? 'staff' : $role;
                $user->save();
                $status = ClinicMembership::STATUS_ACTIVE;
                $setupUrl = rtrim(config('app.frontend_url'), '/')
                    .'/reset-password?token='.urlencode(Password::createToken($user)).'&email='.urlencode($email);
            }

            $membership = new ClinicMembership(['status' => $status]);
            $membership->clinic_id = $clinic->id;
            $membership->user_id = $user->id;
            $membership->role = $role;
            $membership->invited_by = $inviter->id;
            $membership->save();

            if ($role === ClinicMembership::ROLE_DENTIST) {
                $this->ensureDentistProfile($user, $clinic);
            }

            return [$membership, $setupUrl];
        });

        $this->audit->record('membership.invited', $membership, ['role' => $role], $clinic->id, $inviter);
        $membership->user->notify(new ClinicMembershipInvitation($membership->load('clinic'), $setupUrl));

        return $membership;
    }

    public function update(ClinicMembership $membership, array $changes, User $actor): ClinicMembership
    {
        $demotesAdmin = $membership->role === ClinicMembership::ROLE_CLINIC_ADMIN
            && ((isset($changes['role']) && $changes['role'] !== ClinicMembership::ROLE_CLINIC_ADMIN)
                || (isset($changes['status']) && $changes['status'] !== ClinicMembership::STATUS_ACTIVE));

        if ($demotesAdmin) {
            $otherAdmins = ClinicMembership::where('clinic_id', $membership->clinic_id)
                ->where('role', ClinicMembership::ROLE_CLINIC_ADMIN)
                ->active()
                ->whereKeyNot($membership->id)
                ->exists();
            if (! $otherAdmins) {
                throw new ConflictHttpException('A clinic must keep at least one active clinic administrator.');
            }
        }

        DB::transaction(function () use ($membership, $changes) {
            if (isset($changes['role'])) {
                $membership->role = $changes['role'];
            }
            if (isset($changes['status'])) {
                $membership->status = $changes['status'];
            }
            $membership->save();

            if ($membership->role === ClinicMembership::ROLE_DENTIST) {
                $this->ensureDentistProfile($membership->user, $membership->clinic);
            }
        });

        $this->audit->record('membership.updated', $membership, $changes, $membership->clinic_id, $actor);

        return $membership;
    }

    private function ensureDentistProfile(User $user, Clinic $clinic): Dentist
    {
        $dentist = Dentist::firstWhere('user_id', $user->id);

        if (! $dentist) {
            $dentist = new Dentist(['years_experience' => 0, 'is_active' => true]);
            $dentist->user_id = $user->id;
            $dentist->clinic_id = $clinic->id;
            $dentist->save();
        }

        return $dentist;
    }
}
