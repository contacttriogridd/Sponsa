import { ImageResponse } from 'next/server';

export const runtime = 'edge';

// Brand primary (hsl(250 45% 62%) from globals.css) as hex for the image renderer.
const PRIMARY = '#8173C9';
const SIZES: Record<string, number> = { '192': 192, '512': 512, apple: 180, badge: 96 };

/**
 * App icons for the web manifest, iOS home screen and notification badge.
 * The text sits well inside the centre 80% so the 192/512 icons also work
 * as Android "maskable" icons (cropped to a circle or squircle).
 */
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = SIZES[params.size];
  if (!size) return new Response('Not found', { status: 404 });

  // Android renders the badge as a white silhouette, so it gets a transparent background.
  const isBadge = params.size === 'badge';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isBadge ? 'transparent' : PRIMARY,
          color: 'white',
          fontSize: size * 0.4,
          fontWeight: 700,
          letterSpacing: -size * 0.01,
        }}
      >
        VP
      </div>
    ),
    { width: size, height: size },
  );
}
