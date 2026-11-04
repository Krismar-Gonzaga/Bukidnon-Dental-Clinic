@extends('print.layout')

@section('title', $document['title'])

@section('content')
    <header class="head">
        <p class="clinic">{{ $document['clinic']['name'] }}</p>
        <p class="address">{{ $document['clinic']['address'] }}</p>
        <span class="badge">{{ $document['title'] }}</span>
    </header>
    <section class="body">
        <p class="row">
            This is to certify that <strong>{{ $document['patient']['name'] }}</strong>@if ($document['patient']['description']), {{ $document['patient']['description'] }}@endif,
            {{ $document['statement'] }}
        </p>
        <p class="row"><strong>{{ $document['purpose'] }}</strong></p>
    </section>
    <footer class="sign">
        <div class="line"></div>
        <p class="name">{{ $document['dentist']['name'] }}</p>
        @if ($document['dentist']['specialization'])
            <p class="small">{{ $document['dentist']['specialization'] }}</p>
        @endif
        <p class="small">PRC: {{ $document['dentist']['license_number'] }}</p>
        <p class="small">Issued: {{ \Illuminate\Support\Carbon::parse($document['issued_at'])->format('F j, Y') }}</p>
    </footer>
@endsection
