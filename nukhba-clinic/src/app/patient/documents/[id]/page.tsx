import { redirect } from 'next/navigation';

export default async function DocRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/print/document/${id}`);
}
