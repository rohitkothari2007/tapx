import type { Metadata } from "next";
import PublicBillClient from "./PublicBillClient";

export const metadata: Metadata = {
  title: "Bill",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicBillPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicBillClient token={token} />;
}
