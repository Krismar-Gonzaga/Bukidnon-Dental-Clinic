<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VerificationDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a private verification document. Reachable only through a
 * short-lived signed link handed out to an authorized user
 * (route middleware: signed:relative).
 */
class DocumentDownloadController extends Controller
{
    public function __invoke(Request $request, VerificationDocument $document)
    {
        $disk = Storage::disk(VerificationDocument::DISK);
        abort_unless($disk->exists($document->path), 404);

        $headers = [
            'Content-Type' => $document->mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ];

        // `download` is covered by the link's signature, so it cannot be added afterwards.
        return $request->boolean('download')
            ? $disk->download($document->path, $document->original_name, $headers)
            : $disk->response($document->path, $document->original_name, $headers);
    }
}
