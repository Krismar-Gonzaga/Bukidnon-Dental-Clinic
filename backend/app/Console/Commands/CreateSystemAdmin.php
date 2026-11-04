<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

// System administrators cannot self-register; create them from the server.
class CreateSystemAdmin extends Command
{
    protected $signature = 'app:create-system-admin {email} {--name=System Administrator}';

    protected $description = 'Create a system administrator account (prompts for the password)';

    public function handle(AuditLogger $audit): int
    {
        $email = strtolower(trim($this->argument('email')));
        $password = $this->secret('Password (min. 12 characters)');

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            [
                'email' => ['required', 'email', 'unique:users,email'],
                'password' => ['required', Password::min(12)->letters()->numbers()],
            ]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = new User([
            'name' => $this->option('name'),
            'email' => $email,
            'password' => $password,
        ]);
        $user->role = 'system_admin';
        $user->email_verified_at = now();
        $user->save();

        $audit->record('admin.system_admin_created', $user, ['via' => 'console'], actor: $user);
        $this->info("System administrator {$email} created.");

        return self::SUCCESS;
    }
}
