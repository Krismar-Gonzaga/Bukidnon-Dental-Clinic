// database/migrations/2026_07_19_124230_create_billing_transactions_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if table exists before creating
        if (!Schema::hasTable('billing_transactions')) {
            Schema::create('billing_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('appointment_id')->constrained()->onDelete('cascade');
                $table->foreignId('patient_id')->constrained()->onDelete('cascade');
                $table->foreignId('clinic_id')->constrained()->onDelete('cascade');
                $table->decimal('subtotal', 10, 2);
                $table->decimal('tax', 10, 2)->default(0);
                $table->decimal('total', 10, 2);
                $table->enum('status', ['pending', 'paid', 'cancelled', 'refunded'])->default('pending');
                $table->string('payment_method')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('billing_transactions');
    }
};