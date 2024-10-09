import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

// Import Poppins font with the desired styles (e.g., 400, 700)
const poppins = Inter({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "August AI",
  description: "August AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.className} antialiased bg-[#f9fffc]`}>
        {children}
      </body>
    </html>
  );
}
