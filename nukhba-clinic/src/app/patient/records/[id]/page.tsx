import { redirect } from 'next/navigation';

/** Old links to a single visit open the record timeline at that visit */
export default async function VisitRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/patient/records#v-${id}`);
}
