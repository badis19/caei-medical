<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Devis #{{ $quote->id }}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            font-size: 14px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header-flex {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }
        .logo {
            max-height: 60px;
        }
        .header h1 {
            margin: 0;
            font-size: 26px;
            color: #2c3e50;
        }
        .company-info {
            font-size: 13px;
            margin-top: 10px;
            line-height: 1.5;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            font-size: 18px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
            margin-bottom: 10px;
            color: #2980b9;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }
        th, td {
            border: 1px solid #ccc;
            padding: 8px 10px;
            text-align: left;
        }
        th {
            background-color: #f5f5f5;
        }
        .totals-table td {
            border: none;
        }
        .totals-table .label {
            font-weight: bold;
        }
        .grand-total {
            font-size: 18px;
            font-weight: bold;
            color: #c0392b;
        }
        .declaration, .banking, .notes {
            margin-top: 20px;
            font-size: 13px;
            line-height: 1.6;
        }
        .summary-highlight {
            background-color: #f9f9f9;
            padding: 15px;
            border: 2px dashed #ccc;
            margin-bottom: 30px;
        }
        .summary-highlight h2 {
            border: none;
            margin-top: 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="header-flex">
            <img src="{{ public_path('images/logo.png') }}" alt="Logo" class="logo">
            <h1>DEVIS ESTIMATIF</h1>
        </div>
        <div class="company-info">
            <div>CAEI COMPANY GROUP</div>
            <div>Siège social : 8, rue Claude Bernard, cité jardins 1002 - Tunis Belvédère - Tunisie</div>
            <div>Email : direction@caei-sfi.com | Site : https://www.caei-afri.com/Medicalservices/</div>
            <div>Tél : +216 55 332 888 | MF : 1821205 MAM 000</div>
        </div>
    </div>

    <div class="summary-highlight">
        <h2>Récapitulatif Financier</h2>
        <table class="totals-table">
            <tr>
                <td class="label">Total Assistance :</td>
                <td>{{ number_format($quote->total_assistance, 2) }} TND</td>
            </tr>
            <tr>
                <td class="label">Total Clinique :</td>
                <td>{{ number_format($quote->total_clinique, 2) }} TND</td>
            </tr>
            <tr>
                <td class="label grand-total">Total à Payer :</td>
                <td class="grand-total">{{ number_format($quote->total_quote, 2) }} TND</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>Détails du Devis</h2>
        <p><strong>Devis N° :</strong> DEV-MSK{{ $quote->id }}</p>
        <p><strong>Date :</strong> {{ $quote->created_at->format('d/m/Y') }}</p>
        <p><strong>Clinique :</strong> {{ $quote->appointment->clinique->name ?? 'N/A' }}</p>
        <p><strong>Responsable :</strong> N/A</p>
        <p><strong>Patient :</strong> {{ $quote->appointment->nom_du_prospect ?? '' }} {{ $quote->appointment->prenom_du_prospect ?? '' }}</p>
    </div>

    <div class="section">
        <h2>Détails de l'Assistance</h2>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Montant (TND)</th>
                </tr>
            </thead>
            <tbody>
                @foreach($quote->assistanceQuotes as $item)
                    <tr>
                        <td>{{ $item->label }}</td>
                        <td>{{ number_format($item->amount, 2) }} TND</td>
                    </tr>
                @endforeach
                <tr>
                    <td><strong>Total Assistance</strong></td>
                    <td><strong>{{ number_format($quote->total_assistance, 2) }} TND</strong></td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Frais de la Clinique</h2>
        <p><strong>Montant Clinique :</strong> {{ number_format($quote->total_clinique, 2) }} TND</p>
    </div>

    <div class="section declaration">
        <h2>Déclaration Médicale</h2>
        <p>Le coût global TTC s’élève à {{ number_format($quote->total_quote, 2) }} TND, hors extras, accompagnant, et complications éventuelles.</p>
    </div>

    <div class="section banking">
        <h2>Informations Bancaires</h2>
        <p>Sté : CAEI | Banque : BIAT | Agence : Lafayette 66 - B5</p>
        <p>IBAN : TN59 0800 6000 6651 0169 6525 | SWIFT : BIATTNTT</p>
        <p>Contact : Mme Ghofrane Ben Ali - Tél : +216 55 335 286</p>
    </div>

    <div class="section notes">
        <p><strong>NB :</strong> La validité du présent document expire dans (30) trente jours à compter de sa date d’émission.</p>
        <p><em>Ce devis est purement indicatif et ne peut être confirmé qu'après une évaluation personnelle du médecin en présentiel à l’hôpital.</em></p>
    </div>

    <div class="footer">
        <p>Merci pour votre confiance.</p>
    </div>

</body>
</html>
