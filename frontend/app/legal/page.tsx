import { redirect } from "next/navigation";

/** /legal opens on the first tab. */
export default function LegalIndex() {
  redirect("/legal/terms");
}
