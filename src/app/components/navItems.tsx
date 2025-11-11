import React from "react";
import {
  Home,
  List,
  Trophy,
  Settings,
  Award,
  Palette,
  Gift,
  Users,
} from "lucide-react";

export interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

export const parentNavItems: NavItem[] = [
  {
    to: "/parent/dashboard",
    icon: <Home size={24} />,
    label: "Home",
  },
  {
    to: "/parent/lists",
    icon: <List size={24} />,
    label: "Lists",
  },
  {
    to: "/parent/children",
    icon: <Users size={24} />,
    label: "Children",
  },
  {
    to: "/parent/rewards-management",
    icon: <Gift size={24} />,
    label: "Rewards",
  },
  {
    to: "/parent/settings",
    icon: <Settings size={24} />,
    label: "Settings",
  },
];

export const childNavItems: NavItem[] = [
  {
    to: "/child/home",
    icon: <Home size={32} />,
    label: "Home",
  },
  {
    to: "/child/rewards",
    icon: <Trophy size={32} />,
    label: "Rewards",
  },
  {
    to: "/child/stickers",
    icon: <Award size={32} />,
    label: "Stickers",
  },
  {
    to: "/child/theme",
    icon: <Palette size={32} />,
    label: "Colors",
  },
];
