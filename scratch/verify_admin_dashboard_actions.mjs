import { readFileSync } from 'fs';

const mainPage = readFileSync('app/page.tsx', 'utf8');
const clientsPage = readFileSync('app/clients/page.tsx', 'utf8');
const devicesPage = readFileSync('app/devices/page.tsx', 'utf8');
const globalsCss = readFileSync('app/globals.css', 'utf8');

const mainQueriesIntact = mainPage.includes('.from("businesses")') && mainPage.includes('.from("devices")');
const clientsQueriesIntact = clientsPage.includes('.from("businesses")') && clientsPage.includes('.from("devices")');
const devicesQueriesIntact = devicesPage.includes('.from("devices")');

const hasShimmerCSS = globalsCss.includes('tapx-skeleton') && globalsCss.includes('tapxShimmer');
const hasCountUp = mainPage.includes('AnimatedNumber') && clientsPage.includes('displayValue');
const hasStagger = mainPage.includes('tapx-stagger-item') && clientsPage.includes('tapx-stagger-item') && devicesPage.includes('tapx-stagger-item');
const hasPageEnter = mainPage.includes('tapx-page-enter') && clientsPage.includes('tapx-page-enter') && devicesPage.includes('tapx-page-enter');

console.log("=== Surface 1: Admin Dashboard Verification ===");
console.log("1. Data fetching logic untouched:", mainQueriesIntact && clientsQueriesIntact && devicesQueriesIntact);
console.log("2. Skeleton shimmer CSS added:", hasShimmerCSS);
console.log("3. Count-up animations applied:", hasCountUp);
console.log("4. Staggered item entrance applied:", hasStagger);
console.log("5. Page enter transitions applied:", hasPageEnter);
