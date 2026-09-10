import { redirect } from "next/navigation";

export default async function ShortTapRedirect(props: {
  params: { deviceCode: string } | Promise<{ deviceCode: string }>;
}) {
  const resolvedParams = await Promise.resolve(props.params);
  const deviceCode = resolvedParams?.deviceCode;
  if (deviceCode) {
    redirect(`/tap/${deviceCode}`);
  }
  redirect("/");
}
