import { requireUser } from "@/lib/auth/guards";
import { getRewriteSession } from "@/lib/rewrite/rewrite-service";
import { RewriteClient } from "./rewrite-client";

type Props = { params: Promise<{ id: string }> };

export default async function RewritePage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const session = await getRewriteSession(user.id, id);

  return <RewriteClient initialSession={JSON.parse(JSON.stringify(session))} />;
}
