import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 42, background: 'linear-gradient(145deg,#5f73ff,#2949d9)' }}>
        <div style={{ position: 'relative', width: 112, height: 80, display: 'flex', alignItems: 'center', borderRadius: 16, background: 'white' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 18 }}>
          <div style={{ width: 38, height: 7, borderRadius: 7, background: '#c7d1ff' }} />
          <div style={{ width: 28, height: 7, borderRadius: 7, background: '#c7d1ff' }} />
        </div>
        <div style={{ position: 'absolute', right: -12, bottom: -12, width: 58, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 29, background: '#ff8060' }}>
          <div style={{ position: 'absolute', width: 5, height: 19, left: 27, top: 12, borderRadius: 4, background: 'white' }} />
          <div style={{ position: 'absolute', width: 17, height: 5, left: 27, top: 28, borderRadius: 4, background: 'white', transform: 'rotate(28deg)', transformOrigin: 'left center' }} />
          <div style={{ position: 'absolute', width: 7, height: 7, left: 25, top: 26, borderRadius: 4, background: 'white' }} />
        </div>
      </div>
    </div>,
    size,
  );
}
