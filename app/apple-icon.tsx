import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 42, background: '#e9f3ff' }}>
      <div style={{ position: 'relative', width: 124, height: 118, display: 'flex' }}>
        <div style={{ position: 'absolute', left: 20, top: 18, width: 84, height: 34, border: '20px solid #0870d8', borderBottom: 'none', borderRadius: '24px 24px 0 0' }} />
        <div style={{ position: 'absolute', left: 21, top: 48, width: 83, height: 32, border: '20px solid #07569f', borderTop: 'none', borderRadius: '0 0 24px 24px' }} />
        <div style={{ position: 'absolute', right: 6, top: 3, width: 25, height: 25, borderRadius: 20, background: '#78aff3', border: '7px solid #e9f3ff' }} />
        <div style={{ position: 'absolute', left: 4, bottom: 0, width: 23, height: 23, borderRadius: 20, background: '#064785', border: '7px solid #e9f3ff' }} />
      </div>
    </div>,
    size,
  );
}
