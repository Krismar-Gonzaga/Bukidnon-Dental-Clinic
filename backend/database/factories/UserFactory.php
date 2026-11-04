<?php

namespace Database\Factories;

use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    public function role(string $role): static
    {
        return $this->afterMaking(fn (User $user) => $user->role = $role);
    }

    public function suspended(): static
    {
        return $this->afterMaking(function (User $user) {
            $user->status = User::STATUS_SUSPENDED;
            $user->suspended_at = now();
        });
    }

    /**
     * Give the user an active membership in a clinic with the given role.
     */
    public function memberOf(Clinic $clinic, string $role, string $status = ClinicMembership::STATUS_ACTIVE): static
    {
        return $this->afterCreating(function (User $user) use ($clinic, $role, $status) {
            $membership = new ClinicMembership(['status' => $status]);
            $membership->clinic_id = $clinic->id;
            $membership->user_id = $user->id;
            $membership->role = $role;
            $membership->save();
        });
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
