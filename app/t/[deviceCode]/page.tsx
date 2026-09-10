import { redirect } from "next/navigation";

export default async function ShortTapRedirect({
  params,
}: {
  params: Promise<{ deviceCode: string }>;
}) {
  const { deviceCode } = await params;
  redirect(`/tap/${deviceCode}`);
}
