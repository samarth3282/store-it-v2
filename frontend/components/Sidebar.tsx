"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/constants";
import { DynamicLogo } from "@/components/DynamicLogo";
import { useAccentColor, accentColors } from "@/contexts/AccentColorContext";

interface Props {
  fullName: string;
  avatar: string;
  email: string;
}

const Sidebar = ({ fullName, avatar, email }: Props) => {
  const pathname = usePathname();
  const { accentColor } = useAccentColor();
  const currentColor = accentColors[accentColor];

  return (
    <aside className="sidebar">
      <Link href="/">
        <DynamicLogo showText={true} className="hidden h-auto lg:block" />
        <DynamicLogo showText={false} className="lg:hidden" />
      </Link>

      <nav className="sidebar-nav">
        <ul className="flex flex-1 flex-col gap-6">
          {navItems.map(({ url, name, icon }) => (
            <Link key={name} href={url} className="lg:w-full">
              <li
                className={cn(
                  "sidebar-nav-item",
                  pathname === url && "shad-active",
                )}
              >
                <Image
                  src={icon}
                  alt={name}
                  width={24}
                  height={24}
                  className={cn(
                    "nav-icon",
                    pathname === url && "nav-icon-active",
                  )}
                />
                <p className="hidden lg:block">{name}</p>
              </li>
            </Link>
          ))}
        </ul>
      </nav>

      <div className="relative h-[250px] w-full">
        <div
          className="absolute inset-x-0 bottom-0 h-[140px] rounded-[30px] transition-colors duration-300"
          style={{ backgroundColor: currentColor.hex }}
        />
        <div className="relative flex size-full items-end justify-center pb-4">
          <Image
            src="/assets/images/files.png"
            alt="logo"
            width={513}
            height={513}
            className="h-auto w-[75%] object-contain"
            quality={100}
          />
        </div>
      </div>

      <div className="sidebar-user-info">
        <Image
          src={avatar}
          alt="Avatar"
          width={44}
          height={44}
          className="sidebar-user-avatar"
        />
        <div className="hidden overflow-hidden lg:block">
          <p className="subtitle-2 truncate capitalize">{fullName}</p>
          <p className="caption truncate">{email}</p>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
