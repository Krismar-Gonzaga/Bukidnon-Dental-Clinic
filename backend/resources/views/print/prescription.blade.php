@extends('print.layout')

@section('title', 'Prescription')

@section('content')
    <header class="head">
        <p class="clinic">{{ $prescription->clinic?->name }}</p>
        <p class="address">{{ $prescription->clinic?->full_address }}</p>
        <span class="badge">Prescription</span>
    </header>
    <section class="body">
        <p class="row"><strong>Patient:</strong> {{ $prescription->patient?->display_name }}</p>
        @if ($description)
            <p class="row">{{ ucfirst($description) }}</p>
        @endif
        <p class="row"><strong>Date:</strong> {{ $issuedOn }}</p>
    </section>
    <section class="body">
        <p class="rx">{{ $prescription->medication }} — {{ $prescription->dosage }}</p>
        <p class="row"><strong>Frequency:</strong> {{ $prescription->frequency }}</p>
        <p class="row"><strong>Duration:</strong> {{ $prescription->duration }}</p>
        @if ($prescription->instructions)
            <p class="row"><strong>Instructions:</strong> {{ $prescription->instructions }}</p>
        @endif
    </section>
    <footer class="sign">
        <div class="line"></div>
        <p class="name">{{ $prescription->dentist?->user?->name }}</p>
        @if ($prescription->dentist?->specialization)
            <p class="small">{{ $prescription->dentist->specialization->name }}</p>
        @endif
        <p class="small">PRC: {{ $prescription->dentist?->license_number }}</p>
        @if ($prescription->dentist?->ptr_number)
            <p class="small">PTR: {{ $prescription->dentist->ptr_number }}</p>
        @endif
        @if ($prescription->dentist?->s2_number)
            <p class="small">S2: {{ $prescription->dentist->s2_number }}</p>
        @endif
    </footer>
@endsection
