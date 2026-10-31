import {
  BriefcaseIcon,
  CalendarIcon,
  CalendarRangeIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  InboxIcon,
  LibraryIcon,
  LightbulbIcon,
  LinkIcon,
  ListChecksIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  PiggyBankIcon,
  SettingsIcon,
  RepeatIcon,
  StoreIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WorkflowIcon,
  WrenchIcon,
} from "lucide-react";

// Ícones guardados por nome no banco (áreas, pastas) e usados nas abas.
const ICONS: Record<string, LucideIcon> = {
  briefcase: BriefcaseIcon,
  calendar: CalendarIcon,
  "calendar-range": CalendarRangeIcon,
  "clipboard-check": ClipboardCheckIcon,
  "file-text": FileTextIcon,
  folder: FolderIcon,
  "graduation-cap": GraduationCapIcon,
  inbox: InboxIcon,
  library: LibraryIcon,
  lightbulb: LightbulbIcon,
  link: LinkIcon,
  "list-checks": ListChecksIcon,
  "message-square-text": MessageSquareTextIcon,
  "piggy-bank": PiggyBankIcon,
  repeat: RepeatIcon,
  settings: SettingsIcon,
  store: StoreIcon,
  sun: SunIcon,
  user: UserIcon,
  users: UsersIcon,
  wallet: WalletIcon,
  workflow: WorkflowIcon,
  wrench: WrenchIcon,
};

export function Icon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Component = (name && ICONS[name]) || FolderIcon;
  return <Component className={className} aria-hidden="true" />;
}
