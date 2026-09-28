import fs from "fs";

const filePath = "c:/Users/khush/Desktop/tapx/app/client/page.tsx";
let content = fs.readFileSync(filePath, "utf8");

const targetSnippet = `  todayRevenue: number;\r\n  completedRevenue: number;\r\n  enabledPaidFeatures: Feature[];\r\n}) {`;
const targetSnippetLF = `  todayRevenue: number;\n  completedRevenue: number;\n  enabledPaidFeatures: Feature[];\n}) {`;

const replacement = `      \`}</style>
    </div>
  );
}

function AnalyticsPage({
  orders,
  todayOrders,
  pendingOrders,
  completedOrders,
  todayRevenue,
  completedRevenue,
  enabledPaidFeatures,
  todayActionCounts,
}: {
  orders: Order[];
  todayOrders: Order[];
  pendingOrders: Order[];
  completedOrders: Order[];
  todayRevenue: number;
  completedRevenue: number;
  enabledPaidFeatures: Feature[];
  todayActionCounts?: {
    totalTaps: number;
    googleReviewClicks: number;
    instagramClicks: number;
    whatsappClicks: number;
    callClicks: number;
    locationClicks: number;
    paymentClicks: number;
  };
}) {`;

if (content.includes(targetSnippet)) {
  content = content.replace(targetSnippet, replacement);
  fs.writeFileSync(filePath, content, "utf8");
  console.log("Replaced targetSnippet (CRLF) successfully!");
} else if (content.includes(targetSnippetLF)) {
  content = content.replace(targetSnippetLF, replacement);
  fs.writeFileSync(filePath, content, "utf8");
  console.log("Replaced targetSnippetLF (LF) successfully!");
} else {
  // Use Regex fallback
  const regex = /^\s*todayRevenue: number;\s*completedRevenue: number;\s*enabledPaidFeatures: Feature\[\];\s*\}\) \{/m;
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, "utf8");
    console.log("Replaced via regex successfully!");
  } else {
    console.error("Snippet not found!");
  }
}
