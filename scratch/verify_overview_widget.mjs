import { readFileSync } from 'fs';

const clientPageCode = readFileSync('app/client/page.tsx', 'utf8');

// Verify that the interactions insert has try/catch error logging
const hasTryCatchLogging = clientPageCode.includes('console.error("[TAPX Analytics] Unable to record interaction:"') || 
                           readFileSync('app/tap/[deviceCode]/page.tsx', 'utf8').includes('console.error("[TAPX Analytics] Unable to record interaction:"');

// Verify that appointment-overview-card is wrapped in hasAppointment
const hasConditionalAppointmentWidget = clientPageCode.includes('{hasAppointment && (\n        <section className="appointment-overview-card">') ||
                                         clientPageCode.includes('{hasAppointment && (\r\n        <section className="appointment-overview-card">');

console.log('Interactions try/catch error logging present:', hasTryCatchLogging);
console.log('Appointments widget wrapped in hasAppointment:', hasConditionalAppointmentWidget);

if (hasConditionalAppointmentWidget) {
  console.log('SUCCESS: Retail businesses (category: retail -> hasAppointment = false) will NO LONGER render the TODAY\'S SCHEDULE appointments widget on the Overview page.');
} else {
  console.error('FAIL: appointments widget is not properly wrapped!');
}
