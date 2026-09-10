export interface StudentIdCardData {
  student_name: string
  student_id: string
  batch_name: string
  batch_roll?: string | number | null
  subject?: string
  class_level?: string
  branch_name?: string
  student_phone?: string
  guardian_name?: string
  guardian_phone?: string
  blood_group?: string
  address?: string
  issue_date?: string
  valid_till?: string
  avatar_url?: string
  qr_data?: string
}

export function getStudentIdCardHtml(card: StudentIdCardData): string {
  const rollStr = card.batch_roll != null && String(card.batch_roll).trim() !== "" 
    ? String(card.batch_roll) 
    : "01"
  
  const qrData = card.qr_data || `MEDHASHIREE-ID:${card.student_id}|ROLL:${rollStr}|BATCH:${card.batch_name}|NAME:${card.student_name}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`
  const initial = card.student_name ? card.student_name.charAt(0).toUpperCase() : "S"

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Student ID Card - ${card.student_id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .print-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
    }
    .print-btn {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .cards-container {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: center;
    }
    /* ID Card Canvas (CR80 Standard Ratio approx 85.6mm x 54mm / 340px x 215px or Portrait 320px x 480px) */
    .id-card {
      width: 320px;
      height: 480px;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.06);
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
    }
    /* Front Card Header */
    .id-header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
      color: #ffffff;
      padding: 16px 14px 14px;
      text-align: center;
      position: relative;
    }
    .id-header::after {
      content: "";
      position: absolute;
      bottom: -10px;
      left: 0;
      right: 0;
      height: 20px;
      background: #ffffff;
      border-radius: 20px 20px 0 0;
    }
    .id-logo-text {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #fbbf24;
      text-transform: uppercase;
    }
    .id-sublogo {
      font-size: 10px;
      color: #c7d2fe;
      letter-spacing: 0.3px;
      margin-top: 2px;
      font-weight: 500;
    }
    .id-tagline {
      display: inline-block;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      font-size: 9px;
      font-weight: 700;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 9999px;
      margin-top: 5px;
      text-transform: uppercase;
    }
    /* Body & Avatar */
    .id-body {
      flex: 1;
      padding: 6px 18px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 2;
    }
    .avatar-wrap {
      position: relative;
      margin-top: 2px;
      margin-bottom: 10px;
    }
    .avatar {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff;
      font-size: 34px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(217, 119, 6, 0.35);
      border: 3.5px solid #ffffff;
    }
    .roll-pill {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
      padding: 2px 10px;
      border-radius: 9999px;
      white-space: nowrap;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .student-name {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      line-height: 1.25;
      margin-top: 4px;
    }
    .student-id-badge {
      display: inline-block;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: 800;
      color: #4338ca;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 2px 10px;
      border-radius: 6px;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }
    /* Info grid */
    .id-details {
      width: 100%;
      margin-top: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 11px;
    }
    .id-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .id-row:last-child { border-bottom: none; }
    .id-lbl { color: #64748b; font-weight: 600; font-size: 10px; }
    .id-val { font-weight: 700; color: #1e293b; text-align: right; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    
    /* Footer */
    .id-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .id-footer-text {
      font-size: 9px;
      color: #64748b;
      line-height: 1.3;
    }
    .id-qr {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 2px;
    }

    /* Back Card */
    .back-card {
      background: #ffffff;
      padding: 20px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .rules-title {
      font-size: 12px;
      font-weight: 800;
      color: #4338ca;
      text-transform: uppercase;
      border-bottom: 2px solid #4338ca;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .rules-list {
      font-size: 10.5px;
      color: #334155;
      line-height: 1.5;
      padding-left: 16px;
    }
    .rules-list li { margin-bottom: 6px; }
    .auth-sign-box {
      border-top: 1.5px dashed #cbd5e1;
      padding-top: 8px;
      text-align: center;
      margin-top: 10px;
    }
    .sign-title {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
    }
    .inst-contact {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 8px;
      font-size: 9.5px;
      color: #475569;
      text-align: center;
      margin-top: 8px;
      line-height: 1.4;
    }

    @media print {
      body { background: #ffffff; padding: 0; }
      .print-bar { display: none !important; }
      .cards-container { gap: 15px; }
      .id-card { box-shadow: none; border: 1px solid #94a3b8; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print Student ID Card</button>
  </div>

  <div class="cards-container">
    <!-- FRONT SIDE -->
    <div class="id-card">
      <div class="id-header">
        <div class="id-logo-text">মেধা সিঁড়ি কোচিং</div>
        <div class="id-sublogo">MedhaShiree Academic Care</div>
        <div class="id-tagline">STUDENT IDENTIFICATION CARD</div>
      </div>

      <div class="id-body">
        <div class="avatar-wrap">
          <div class="avatar">${initial}</div>
          <div class="roll-pill">রোল: #${rollStr}</div>
        </div>

        <div class="student-name">${card.student_name || "Student"}</div>
        <div class="student-id-badge">ID: ${card.student_id}</div>

        <div class="id-details">
          <div class="id-row">
            <span class="id-lbl">ব্যাচ (Batch):</span>
            <span class="id-val" style="color: #4338ca; font-weight: 800;">${card.batch_name}</span>
          </div>
          ${card.subject ? `
          <div class="id-row">
            <span class="id-lbl">বিষয় (Subject):</span>
            <span class="id-val">${card.subject}</span>
          </div>` : ''}
          ${card.branch_name ? `
          <div class="id-row">
            <span class="id-lbl">শাখা (Branch):</span>
            <span class="id-val">${card.branch_name}</span>
          </div>` : ''}
          ${card.student_phone ? `
          <div class="id-row">
            <span class="id-lbl">ফোন (Phone):</span>
            <span class="id-val">${card.student_phone}</span>
          </div>` : ''}
          ${card.guardian_phone ? `
          <div class="id-row">
            <span class="id-lbl">অভিভাবক:</span>
            <span class="id-val">${card.guardian_phone}</span>
          </div>` : ''}
          <div class="id-row">
            <span class="id-lbl">সেশন (Session):</span>
            <span class="id-val">${card.valid_till || new Date().getFullYear() + " - " + (new Date().getFullYear() + 1)}</span>
          </div>
        </div>
      </div>

      <div class="id-footer">
        <div class="id-footer-text">
          <b>Official Student Pass</b><br>
          Must be worn inside campus & exams.
        </div>
        <img class="id-qr" src="${qrUrl}" alt="Student QR" />
      </div>
    </div>

    <!-- BACK SIDE -->
    <div class="id-card back-card">
      <div>
        <div class="rules-title">নিয়মাবলী ও দিকনির্দেশনা (Instructions)</div>
        <ol class="rules-list">
          <li>ক্লাস ও সাপ্তাহিক পরীক্ষায় অংশগ্রহণের সময় আইডি কার্ড সাথে রাখা বাধ্যতামূলক।</li>
          <li>আইডি কার্ডটি হস্তান্তরযোগ্য নয়।</li>
          <li>আইডি কার্ড হারিয়ে গেলে অবিলম্বে প্রশাসনকে জানাতে হবে।</li>
          <li>কোচিং ক্যাম্পাসে শৃঙ্খলা ও নিয়মানুবর্তিতা বজায় রাখা আবশ্যক।</li>
        </ol>
      </div>

      <div>
        <div class="auth-sign-box">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 18px; color: #1e1b4b; height: 24px;">MedhaShiree</div>
          <div class="sign-title">কর্তৃপক্ষের স্বাক্ষর (Authorized Signatory)</div>
        </div>

        <div class="inst-contact">
          <b>মেধা সিঁড়ি কোচিং (MedhaShiree Coaching)</b><br>
          📞 হটলাইন: +880 1800-000000 | 🌐 www.medhashiree.com<br>
          যেকোনো প্রয়োজনে কোচিং রিসেপশনে যোগাযোগ করুন।
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Auto open print dialog if requested
      if (window.location.search.includes("autoprint=true")) {
        setTimeout(function() { window.print(); }, 400);
      }
    };
  </script>
</body>
</html>`
}

export function printStudentIdCard(data: StudentIdCardData, autoPrint = true) {
  const win = window.open("", "_blank", "width=750,height=800")
  if (!win) return
  win.document.write(getStudentIdCardHtml(data))
  win.document.close()
  win.focus()
  if (autoPrint) {
    setTimeout(() => { win.print() }, 400)
  }
}

export function printAdmissionAndIdCard(receipt: any, idCardData: StudentIdCardData) {
  const qrUrlReceipt = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(receipt.qr_data || receipt.student_id)}`
  const rollStr = idCardData.batch_roll != null && String(idCardData.batch_roll).trim() !== "" ? String(idCardData.batch_roll) : "01"
  const qrUrlCard = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(idCardData.qr_data || idCardData.student_id)}`
  const initial = idCardData.student_name ? idCardData.student_name.charAt(0).toUpperCase() : "S"

  const win = window.open("", "_blank", "width=900,height=900")
  if (!win) return

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Admission Memo & Student ID Card - ${receipt.student_id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 25px;
    }
    .print-bar {
      margin-bottom: 25px;
      display: flex;
      justify-content: center;
      gap: 12px;
    }
    .print-btn {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .page-layout {
      display: flex;
      flex-direction: column;
      gap: 30px;
      max-width: 800px;
      margin: 0 auto;
    }
    /* Section 1: Admission Memo */
    .receipt-sheet {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 24px 30px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 22px; color: #4338ca; text-transform: uppercase; letter-spacing: 1px; }
    .header p { margin: 3px 0; font-size: 12px; color: #64748b; }
    .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 9999px; font-weight: bold; font-size: 11px; margin-top: 5px; }
    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #4f46e5; margin: 12px 0 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; }
    .row { display: flex; justify-content: space-between; padding: 3.5px 0; font-size: 13px; }
    .label { color: #64748b; }
    .value { font-weight: 600; color: #0f172a; text-align: right; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 10px; }
    .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 5px 0; }
    .due-text { color: #dc2626; }
    .paid-text { color: #16a34a; }
    .cred-box { background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 8px; padding: 8px 12px; margin: 10px 0; }
    .qr-container { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px dashed #cbd5e1; margin-top: 12px; }

    /* Section 2: ID Card */
    .id-card-section {
      page-break-before: auto;
    }
    .section-header-title {
      font-size: 15px;
      font-weight: 800;
      color: #334155;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cards-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      justify-content: flex-start;
    }
    .id-card {
      width: 300px;
      height: 450px;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid #cbd5e1;
    }
    .id-header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
      color: #ffffff;
      padding: 14px 12px 12px;
      text-align: center;
      position: relative;
    }
    .id-logo-text { font-size: 15px; font-weight: 900; color: #fbbf24; text-transform: uppercase; }
    .id-sublogo { font-size: 9px; color: #c7d2fe; margin-top: 2px; }
    .id-tagline { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); font-size: 8.5px; font-weight: 700; color: #ffffff; padding: 2px 8px; border-radius: 9999px; margin-top: 4px; }
    .id-body { flex: 1; padding: 4px 16px 10px; display: flex; flex-direction: column; align-items: center; }
    .avatar-wrap { position: relative; margin-top: 2px; margin-bottom: 8px; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-size: 30px; font-weight: 900; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
    .roll-pill { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #dc2626; color: #fff; font-size: 10.5px; font-weight: 900; padding: 2px 9px; border-radius: 9999px; white-space: nowrap; border: 2px solid #fff; }
    .student-name { font-size: 15px; font-weight: 800; color: #0f172a; text-align: center; margin-top: 4px; }
    .student-id-badge { display: inline-block; font-family: monospace; font-size: 11px; font-weight: 800; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; padding: 2px 8px; border-radius: 6px; margin-top: 3px; }
    .id-details { width: 100%; margin-top: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; font-size: 10.5px; }
    .id-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #e2e8f0; }
    .id-row:last-child { border-bottom: none; }
    .id-lbl { color: #64748b; font-weight: 600; font-size: 9.5px; }
    .id-val { font-weight: 700; color: #1e293b; text-align: right; }
    .id-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; }
    .id-footer-text { font-size: 8.5px; color: #64748b; }
    .id-qr { width: 42px; height: 42px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff; padding: 2px; }

    .back-card { background: #fff; padding: 16px 14px; display: flex; flex-direction: column; justify-content: space-between; }
    .rules-title { font-size: 11px; font-weight: 800; color: #4338ca; text-transform: uppercase; border-bottom: 1.5px solid #4338ca; padding-bottom: 3px; margin-bottom: 8px; }
    .rules-list { font-size: 10px; color: #334155; line-height: 1.4; padding-left: 14px; }
    .rules-list li { margin-bottom: 4px; }
    .auth-sign-box { border-top: 1px dashed #cbd5e1; padding-top: 6px; text-align: center; }
    .sign-title { font-size: 9.5px; font-weight: 800; color: #0f172a; }
    .inst-contact { background: #f1f5f9; border-radius: 6px; padding: 6px; font-size: 8.5px; color: #475569; text-align: center; margin-top: 6px; line-height: 1.3; }

    @media print {
      body { background: #fff; padding: 0; }
      .print-bar { display: none !important; }
      .receipt-sheet { box-shadow: none; border: 1px solid #64748b; margin-bottom: 20px; page-break-after: always; }
      .id-card { box-shadow: none; border: 1px solid #64748b; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print Document & Student ID Card</button>
  </div>

  <div class="page-layout">
    <!-- 1. ADMISSION RECEIPT -->
    <div class="receipt-sheet">
      <div class="header">
        <h1>MedhaShiree Coaching</h1>
        <p>Enrollment & Fee Confirmation Slip (ভর্তি ও ফি রসিদ)</p>
        <span class="badge">Official Admission Copy</span>
      </div>
      
      <div class="section-title">Student Information (শিক্ষার্থীর তথ্য)</div>
      <div class="row"><span class="label">Student ID:</span><span class="value">${receipt.student_id}</span></div>
      <div class="row"><span class="label">Full Name:</span><span class="value">${receipt.student_name}</span></div>
      <div class="row"><span class="label">Batch Roll No:</span><span class="value" style="color: #dc2626; font-weight: 800;">#${rollStr}</span></div>
      ${receipt.student_phone ? `<div class="row"><span class="label">Phone:</span><span class="value">${receipt.student_phone}</span></div>` : ''}
      ${receipt.guardian_name ? `<div class="row"><span class="label">Guardian:</span><span class="value">${receipt.guardian_name}</span></div>` : ''}
      ${receipt.guardian_phone ? `<div class="row"><span class="label">Guardian Phone:</span><span class="value">${receipt.guardian_phone}</span></div>` : ''}

      ${receipt.password ? `
      <div class="cred-box">
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Student Portal Login ID:</span><span class="value">${receipt.student_id}</span></div>
        <div class="row"><span class="label" style="color: #4338ca; font-weight: 600;">Account Password:</span><span class="value font-mono" style="color: #4338ca;">${receipt.password}</span></div>
      </div>
      ` : ''}

      <div class="section-title">Enrolled Program (ভর্তিকৃত ব্যাচ)</div>
      <div class="row"><span class="label">Batch Name:</span><span class="value">${receipt.batch_name}</span></div>
      <div class="row"><span class="label">Subject/Class:</span><span class="value">${receipt.subject || "-"}</span></div>
      <div class="row"><span class="label">Enrollment Date:</span><span class="value">${receipt.date}</span></div>

      <div class="section-title">Payment Breakdown (ফি বিবরণ)</div>
      <div class="summary-box">
        <div class="row"><span class="label">Total Fee:</span><span class="value">৳${receipt.total_fee?.toLocaleString("en-BD") || 0}</span></div>
        <div class="row"><span class="label">Paid Amount:</span><span class="value paid-text">৳${receipt.paid_amount?.toLocaleString("en-BD") || 0}</span></div>
        <div class="total-row"><span class="label">Due Amount:</span><span class="value ${receipt.due_amount > 0 ? 'due-text' : 'paid-text'}">৳${receipt.due_amount?.toLocaleString("en-BD") || 0}</span></div>
        ${receipt.due_date ? `<div class="row"><span class="label">Due Date:</span><span class="value due-text">${receipt.due_date}</span></div>` : ''}
        <div class="row" style="margin-top: 5px; font-size: 11px; color: #64748b;"><span class="label">Receipt Ref:</span><span>${receipt.receipt_number}</span></div>
      </div>

      <div class="qr-container">
        <div>
          <p style="margin: 0; font-size: 11px; font-weight: bold; color: #334155;">Verification QR Code</p>
          <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">Scan to verify student admission status</p>
        </div>
        <img src="${qrUrlReceipt}" width="70" height="70" alt="Student QR Code" style="border-radius: 6px; border: 1px solid #cbd5e1;" />
      </div>
    </div>

    <!-- 2. STUDENT ID CARD -->
    <div class="id-card-section">
      <div class="section-header-title">
        <span>🪪 Student Identification Card (শিক্ষার্থী আইডি কার্ড)</span>
      </div>

      <div class="cards-container">
        <!-- Front -->
        <div class="id-card">
          <div class="id-header">
            <div class="id-logo-text">মেধা সিঁড়ি কোচিং</div>
            <div class="id-sublogo">MedhaShiree Academic Care</div>
            <div class="id-tagline">STUDENT ID CARD</div>
          </div>
          <div class="id-body">
            <div class="avatar-wrap">
              <div class="avatar">${initial}</div>
              <div class="roll-pill">রোল: #${rollStr}</div>
            </div>
            <div class="student-name">${idCardData.student_name}</div>
            <div class="student-id-badge">ID: ${idCardData.student_id}</div>
            <div class="id-details">
              <div class="id-row"><span class="id-lbl">ব্যাচ:</span><span class="id-val" style="color: #4338ca; font-weight: 800;">${idCardData.batch_name}</span></div>
              ${idCardData.subject ? `<div class="id-row"><span class="id-lbl">বিষয়:</span><span class="id-val">${idCardData.subject}</span></div>` : ''}
              ${idCardData.student_phone ? `<div class="id-row"><span class="id-lbl">ফোন:</span><span class="id-val">${idCardData.student_phone}</span></div>` : ''}
              ${idCardData.guardian_phone ? `<div class="id-row"><span class="id-lbl">অভিভাবক:</span><span class="id-val">${idCardData.guardian_phone}</span></div>` : ''}
              <div class="id-row"><span class="id-lbl">সেশন:</span><span class="id-val">${idCardData.valid_till || new Date().getFullYear() + " - " + (new Date().getFullYear() + 1)}</span></div>
            </div>
          </div>
          <div class="id-footer">
            <div class="id-footer-text"><b>Official Student Pass</b><br>Campus & Exam Entry</div>
            <img class="id-qr" src="${qrUrlCard}" alt="QR" />
          </div>
        </div>

        <!-- Back -->
        <div class="id-card back-card">
          <div>
            <div class="rules-title">নিয়মাবলী (Instructions)</div>
            <ol class="rules-list">
              <li>ক্লাস ও পরীক্ষায় কার্ড সাথে রাখা বাধ্যতামূলক।</li>
              <li>আইডি কার্ডটি হস্তান্তরযোগ্য নয়।</li>
              <li>হারিয়ে গেলে কর্তৃপক্ষকে অবহিত করুন।</li>
            </ol>
          </div>
          <div>
            <div class="auth-sign-box">
              <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 16px; color: #1e1b4b; height: 20px;">MedhaShiree</div>
              <div class="sign-title">কর্তৃপক্ষের স্বাক্ষর</div>
            </div>
            <div class="inst-contact">
              <b>মেধা সিঁড়ি কোচিং</b><br>
              📞 +880 1800-000000 | 🌐 medhashiree.com
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`)
  win.document.close()
  win.focus()
}

export async function downloadStudentIdCardPDF(data: StudentIdCardData) {
  try {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [54, 85.6] })
    const rollStr = data.batch_roll != null && String(data.batch_roll).trim() !== "" ? String(data.batch_roll) : "01"

    // Header Background
    doc.setFillColor(30, 27, 75)
    doc.rect(0, 0, 54, 18, "F")

    // Title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(251, 191, 36)
    doc.text("MEDHASHIREE COACHING", 27, 6, { align: "center" })

    doc.setFontSize(5.5)
    doc.setTextColor(199, 210, 254)
    doc.setFont("helvetica", "normal")
    doc.text("STUDENT IDENTIFICATION CARD", 27, 10, { align: "center" })

    doc.setFontSize(5)
    doc.setTextColor(255, 255, 255)
    doc.text(`Roll #${rollStr}`, 27, 14, { align: "center" })

    // Avatar Circle
    doc.setFillColor(245, 158, 11)
    doc.circle(27, 26, 6.5, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    const initial = data.student_name ? data.student_name.charAt(0).toUpperCase() : "S"
    doc.text(initial, 27, 29.5, { align: "center" })

    // Student Name & ID
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(15, 23, 42)
    doc.text(data.student_name || "Student", 27, 36, { align: "center" })

    doc.setFillColor(238, 242, 255)
    doc.roundedRect(12, 38, 30, 4.5, 1, 1, "F")
    doc.setFontSize(6)
    doc.setTextColor(67, 56, 202)
    doc.text(`ID: ${data.student_id}`, 27, 41.2, { align: "center" })

    // Details Box
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(4, 44, 46, 24, 1.5, 1.5, "F")
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(4, 44, 46, 24, 1.5, 1.5, "D")

    doc.setFontSize(5.5)
    let y = 48
    doc.setFont("helvetica", "bold")
    doc.setTextColor(100, 116, 139)
    doc.text("Batch:", 6, y)
    doc.setTextColor(15, 23, 42)
    doc.text(doc.splitTextToSize(data.batch_name || "Batch", 30)[0], 18, y)

    y += 4.5
    doc.setTextColor(100, 116, 139)
    doc.text("Batch Roll:", 6, y)
    doc.setTextColor(220, 38, 38)
    doc.text(`#${rollStr}`, 18, y)

    if (data.student_phone) {
      y += 4.5
      doc.setTextColor(100, 116, 139)
      doc.text("Phone:", 6, y)
      doc.setTextColor(15, 23, 42)
      doc.text(data.student_phone, 18, y)
    }

    if (data.guardian_phone) {
      y += 4.5
      doc.setTextColor(100, 116, 139)
      doc.text("Guardian:", 6, y)
      doc.setTextColor(15, 23, 42)
      doc.text(data.guardian_phone, 18, y)
    }

    // Footer
    doc.setFontSize(4.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text("Valid for Class & Examination Access", 27, 72, { align: "center" })
    doc.setFont("helvetica", "bold")
    doc.text("MedhaShiree Coaching • medhashiree.com", 27, 75, { align: "center" })

    doc.save(`StudentID_${data.student_id}_Roll${rollStr}.pdf`)
  } catch (e) {
    console.error("Failed to generate PDF:", e)
  }
}
