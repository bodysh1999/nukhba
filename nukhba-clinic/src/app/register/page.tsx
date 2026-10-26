import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile, homeFor } from '@/lib/session';
import { getSiteChrome, PageHero, SiteFrame } from '@/components/site/frame';
import { RegisterForm } from './form';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteChrome();
  return { title: c.t.registerTitle };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [sp, profile, c] = await Promise.all([searchParams, getCurrentProfile(), getSiteChrome()]);
  if (profile?.is_active) redirect(homeFor(profile.role));
  return (
    <SiteFrame c={c} solidHeader>
      <PageHero title={c.t.registerTitle} body={c.t.registerSub} />
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-xl rounded-[28px] border border-sand-200 bg-white p-6 shadow-card sm:p-8">
          <RegisterForm next={sp.next?.startsWith('/patient') ? sp.next : undefined} />
        </div>
      </section>
    </SiteFrame>
  );
}
