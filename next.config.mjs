const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://qzwatjcqttoequbftbrv.supabase.co';
const supabaseOrigin=new URL(supabaseUrl).origin;
const supabaseSocket=supabaseOrigin.replace('https://','wss://');
const csp=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self'",
 "script-src 'self' 'unsafe-inline'",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data:",
 `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`,
 "worker-src 'self' blob:",
 "manifest-src 'self'",
 "upgrade-insecure-requests"
].join('; ');

const securityHeaders=[
 {key:'Content-Security-Policy',value:csp},
 {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 {key:'Cross-Origin-Opener-Policy',value:'same-origin-allow-popups'},
 {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
 {key:'X-DNS-Prefetch-Control',value:'off'},
 {key:'X-Permitted-Cross-Domain-Policies',value:'none'}
];

/** @type {import('next').NextConfig} */
const nextConfig={
 poweredByHeader:false,
 async headers(){return [{source:'/:path*',headers:securityHeaders}]}
};
export default nextConfig;
