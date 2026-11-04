<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Laravel database notifications (in-app notification center).
| `notifications` previously existed only as an empty stub and is recreated
| with the schema Laravel's database channel expects.
*/
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notifications') && DB::table('notifications')->count() === 0) {
            Schema::drop('notifications');
        }

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // e.g. {"email": true}. Missing keys mean "enabled".
            $table->json('notification_preferences')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
        });

        Schema::dropIfExists('notifications');
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });
    }
};
