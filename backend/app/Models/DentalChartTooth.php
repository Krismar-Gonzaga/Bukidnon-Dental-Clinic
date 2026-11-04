<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One charted tooth of a patient at one clinic. A tooth with no row has not been charted. */
class DentalChartTooth extends Model
{
    public const STATUSES = ['healthy', 'caries', 'filled', 'crown', 'missing', 'planned'];

    public const TEETH = 32;

    protected $table = 'dental_chart_teeth';

    protected $fillable = ['status', 'notes'];

    protected $casts = ['tooth_number' => 'integer'];

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
