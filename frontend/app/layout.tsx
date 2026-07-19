import type { Metadata } from "next";
import { Poppins } from 'next/font/google'

import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AccentColorProvider } from "@/contexts/AccentColorContext";
import { AuthProvider } from "@/contexts/AuthContext";

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: "StoreIt",
  description: "StoreIt - The only storage solution you need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} font-poppins antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AccentColorProvider>
            <AuthProvider>
              {/* {children} */}
              <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-2xl bg-white dark:bg-gray-900 p-10 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-7xl mb-6">💸😭</div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-6 text-brand">System Hibernating</h1>
                  <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6">
                    Welcome to StoreIt! Unfortunately, AWS decided my student bank account was looking a little too comfortable. 
                  </p>
                  <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
                    To prevent me from eating instant ramen for the rest of the year, I've had to temporarily power down the backend and AI servers to save costs.
                  </p>
                  
                  <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-md text-gray-500 mb-6">
                      Want a live demo? Are you hiring? Or just want to check out the project in action?
                    </p>
                    <a 
                      href="mailto:contact@samarth-patel.dev" 
                      className="inline-block bg-brand hover:bg-brand/90 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-transform hover:scale-105"
                    >
                      Shoot me an email! 🚀
                    </a>
                  </div>
                </div>
              </div>
            </AuthProvider>
          </AccentColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
