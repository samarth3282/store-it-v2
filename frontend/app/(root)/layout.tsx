"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNavigation from "@/components/MobileNavigation";
import Header from "@/components/Header";
import { Toaster } from "@/components/ui/toaster";
import { ChatInterface } from "@/components/AI/ChatInterface";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/sign-in");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Image
          src="/assets/icons/loader.svg"
          alt="Loading..."
          width={40}
          height={40}
          className="animate-spin"
        />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="flex h-screen">
      <Sidebar fullName={user.fullName} avatar={user.avatar} email={user.email} />

      <section className="flex h-full flex-1 flex-col">
        <MobileNavigation
          id={user.id}
          accountId={user.id}
          fullName={user.fullName}
          avatar={user.avatar}
          email={user.email}
        />
        <Header userId={user.id} accountId={user.id} />
        <div className="main-content">{children}</div>
      </section>
      <ChatInterface />

      <Toaster />
    </main>
  );
};
export default Layout;
