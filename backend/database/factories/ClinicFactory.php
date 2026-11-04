<?php

namespace Database\Factories;

use App\Models\Clinic;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Clinic>
 */
class ClinicFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company().' Dental Clinic';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'description' => fake()->sentence(),
            'address' => fake()->streetAddress(),
            'city' => fake()->randomElement(['Malaybalay City', 'Valencia City', 'Manolo Fortich']),
            'province' => 'Bukidnon',
            'contact_number' => '09'.fake()->numerify('#########'),
            'email' => fake()->unique()->safeEmail(),
            'rating' => 0,
            'is_featured' => false,
            'is_verified' => true,
            'opening_time' => '08:00:00',
            'closing_time' => '17:00:00',
        ];
    }
}
