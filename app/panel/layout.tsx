import AdminShell from '../components/AdminShell';
import { serverSupabase } from '../../lib/supabase-server';
export const dynamic='force-dynamic';
export default async function PanelLayout({children}:{children:React.ReactNode}){
 const db=await serverSupabase();
 const {data:{user}}=await db.auth.getUser();
 const {data:profile}=user?await db.from('profiles').select('role,organizations(slug)').eq('id',user.id).maybeSingle():{data:null};
 const organization=profile?.organizations as unknown as {slug?:string}|null;
 return <AdminShell role={profile?.role} tenantSlug={organization?.slug}>{children}</AdminShell>
}
