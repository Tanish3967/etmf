"use client";

import dynamic from 'next/dynamic';

// Dynamically import the main eTMF App with client-side rendering
const ETMFApp = dynamic(() => import('../App'), { ssr: false });

export default function HomePage() {
  return <ETMFApp />;
}
