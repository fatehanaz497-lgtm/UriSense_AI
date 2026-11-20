import PDFDocument from 'pdfkit';
import {
  buildEducationalSummary,
  evaluateAllReadings,
  type PatientRecord,
  type UrinalysisTestRecord,
} from '../shared/urinalysis.ts';

export async function generateUrinalysisPdfBuffer(
  test: UrinalysisTestRecord,
  patient: PatientRecord | undefined
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // Top medical header bar
    doc.rect(0, 0, doc.page.width, 86).fill('#164B78');

    // Simple vector drop emblem
    doc.circle(64, 43, 16).fill('#2685D8');
    doc.circle(64, 46, 7).fill('#FFFFFF');

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('UriSense AI', 92, 26);

    doc
      .fillColor('#EAF5FF')
      .font('Helvetica')
      .fontSize(10)
      .text('Smart AIoT Urinalysis Clinical Report', 92, 50);

    const modeBadge = test.mode === 'demo' ? 'SIMULATED DEMO DATA' : 'VERIFIED IOT HARDWARE';
    doc
      .fillColor('#EAF5FF')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(modeBadge, 360, 38, { align: 'right', width: 185 });

    // Patient & Test Metadata Box
    const metaTop = 108;
    doc.roundedRect(48, metaTop, 499, 86, 6).fillAndStroke('#F4F9FF', '#D6E4F0');

    doc.fillColor('#164B78').font('Helvetica-Bold').fontSize(10).text('PATIENT INFORMATION', 64, metaTop + 14);
    doc.text('TEST METADATA', 310, metaTop + 14);

    doc.fillColor('#24364B').font('Helvetica').fontSize(9.5);
    doc.text(`Name: ${patient?.name ?? test.patientName}`, 64, metaTop + 32);
    doc.text(`Patient ID: ${test.patientId}`, 64, metaTop + 48);
    doc.text(
      `Age / Gender: ${patient ? `${patient.age} yrs · ${patient.gender}` : 'Not specified'}`,
      64,
      metaTop + 64
    );

    const formattedDate = new Date(test.timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Test ID: ${test.id}`, 310, metaTop + 32);
    doc.text(`Test Date: ${formattedDate}`, 310, metaTop + 48);
    doc.text(`Device ID: ${test.deviceId} (${test.source.toUpperCase()})`, 310, metaTop + 64);

    // Overall Status Strip
    const statusTop = 210;
    const statusColor =
      test.overallStatus === 'Normal'
        ? '#16A34A'
        : test.overallStatus === 'Needs Review'
          ? '#D97706'
          : '#DC2626';

    doc.roundedRect(48, statusTop, 499, 32, 6).fillAndStroke('#FFFFFF', '#D6E4F0');
    doc.fillColor('#24364B').font('Helvetica-Bold').fontSize(10).text('OVERALL SCREENING STATUS:', 64, statusTop + 10);
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(11).text(test.overallStatus.toUpperCase(), 235, statusTop + 9.5);

    // Parameter Table Header
    let y = 260;
    doc.rect(48, y, 499, 24).fill('#EAF5FF');
    doc.fillColor('#164B78').font('Helvetica-Bold').fontSize(9);
    doc.text('PARAMETER', 58, y + 7);
    doc.text('MEASURED VALUE', 185, y + 7);
    doc.text('REFERENCE RANGE', 325, y + 7);
    doc.text('STATUS', 465, y + 7);

    y += 24;
    const evaluated = evaluateAllReadings(test.readings);

    evaluated.forEach((item, index) => {
      if (index % 2 === 1) {
        doc.rect(48, y, 499, 24).fill('#F9FCFF');
      }
      doc.moveTo(48, y + 24).lineTo(547, y + 24).strokeColor('#E5EEF6').lineWidth(0.5).stroke();

      doc.fillColor('#24364B').font('Helvetica-Bold').fontSize(9).text(item.definition.name, 58, y + 7);
      doc
        .fillColor(item.status === 'Not Measured' ? '#64748B' : '#24364B')
        .font('Helvetica')
        .fontSize(9)
        .text(item.displayValue, 185, y + 7, { width: 132 });
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text(item.definition.referenceRange, 325, y + 7, { width: 130 });

      const badgeColor =
        item.status === 'Normal'
          ? '#16A34A'
          : item.status === 'Needs Review'
            ? '#D97706'
            : item.status === 'Abnormal'
              ? '#DC2626'
              : '#64748B';

      doc.fillColor(badgeColor).font('Helvetica-Bold').fontSize(8.5).text(item.status, 465, y + 7);
      y += 24;
    });

    // Educational Interpretation
    y += 18;
    doc.fillColor('#164B78').font('Helvetica-Bold').fontSize(10.5).text('Educational Interpretation', 48, y);
    y += 16;
    const summaryText = buildEducationalSummary(test.readings);
    doc.fillColor('#24364B').font('Helvetica').fontSize(9.5).text(summaryText, 48, y, {
      width: 499,
      lineGap: 3,
    });
    y = doc.y + 14;

    if (test.clinicianNotes.trim()) {
      doc.fillColor('#164B78').font('Helvetica-Bold').fontSize(10.5).text('Clinician Notes', 48, y);
      y += 15;
      doc.fillColor('#24364B').font('Helvetica').fontSize(9.5).text(test.clinicianNotes, 48, y, {
        width: 499,
        lineGap: 3,
      });
      y = doc.y + 16;
    }

    // Medical Disclaimer
    const disclaimerTop = Math.max(y + 8, 705);
    doc.roundedRect(48, disclaimerTop, 499, 58, 6).fillAndStroke('#F8FAFC', '#D6E4F0');
    doc.fillColor('#164B78').font('Helvetica-Bold').fontSize(8.5).text('MEDICAL DISCLAIMER', 60, disclaimerTop + 10);
    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8)
      .text(
        'This report is generated by UriSense AI for educational and preliminary screening support only. It does not constitute a medical diagnosis. Always consult a qualified physician or healthcare professional regarding test interpretations and clinical decisions.',
        60,
        disclaimerTop + 23,
        { width: 475, lineGap: 2 }
      );

    doc.end();
  });
}
