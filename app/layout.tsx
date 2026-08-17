import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "TaxAP | Sales and use tax rate monitoring",
    description:
      "Monitor official sales and use tax rate changes against A+ customer ship-to records.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "TaxAP",
      description: "Know which tax rates need attention.",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "TaxAP",
      description: "Know which tax rates need attention.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
