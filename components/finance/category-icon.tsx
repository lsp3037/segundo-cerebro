import type { ComponentType, CSSProperties } from "react";
import {
  BabyIcon,
  BanknoteIcon,
  BriefcaseIcon,
  CarIcon,
  CircleEllipsisIcon,
  CreditCardIcon,
  FilmIcon,
  GiftIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HeartPulseIcon,
  HouseIcon,
  LaptopIcon,
  MegaphoneIcon,
  PackageIcon,
  PawPrintIcon,
  PercentIcon,
  PiggyBankIcon,
  PlaneIcon,
  ReceiptIcon,
  ShieldIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UtensilsIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import { categoryIconKey, type CategoryIconKey } from "@/lib/finance/category-icons";

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;

export const CATEGORY_ICON_COMPONENTS: Record<CategoryIconKey, IconComponent> = {
  banknote: BanknoteIcon,
  house: HouseIcon,
  receipt: ReceiptIcon,
  zap: ZapIcon,
  gift: GiftIcon,
  "hand-heart": HandHeartIcon,
  "graduation-cap": GraduationCapIcon,
  "heart-pulse": HeartPulseIcon,
  "credit-card": CreditCardIcon,
  utensils: UtensilsIcon,
  car: CarIcon,
  "shopping-bag": ShoppingBagIcon,
  film: FilmIcon,
  "piggy-bank": PiggyBankIcon,
  "trending-up": TrendingUpIcon,
  briefcase: BriefcaseIcon,
  laptop: LaptopIcon,
  wrench: WrenchIcon,
  megaphone: MegaphoneIcon,
  percent: PercentIcon,
  package: PackageIcon,
  baby: BabyIcon,
  "paw-print": PawPrintIcon,
  plane: PlaneIcon,
  shield: ShieldIcon,
  "circle-ellipsis": CircleEllipsisIcon,
};

const DEFAULT_CATEGORY_COLOR = "#94a3b8";

interface CategoryIconProps {
  name: string;
  kind: "income" | "expense";
  icon?: string | null;
  color?: string | null;
  className?: string;
}

// Ícone pequeno na cor da categoria, sem caixinha em volta.
export function CategoryIcon({ name, kind, icon, color, className = "size-[17px]" }: CategoryIconProps) {
  const Icon = CATEGORY_ICON_COMPONENTS[categoryIconKey(name, kind, icon)];
  return (
    <Icon
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ color: color || DEFAULT_CATEGORY_COLOR }}
    />
  );
}
