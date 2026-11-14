import '../index.css';

export const metadata = {
  title: 'eTMF Pro — Enterprise Clinical Trial Master File',
  description: 'ICH GCP E6(R2), 21 CFR Part 11, and ALCOA+ Compliant eTMF System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
