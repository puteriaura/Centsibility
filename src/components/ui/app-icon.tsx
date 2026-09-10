import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bird,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Cat,
  CheckCircle2,
  Coffee,
  Compass,
  Crown,
  Dog,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  House,
  IdCard,
  Image as ImageIcon,
  KeyRound,
  Leaf,
  LogOut,
  type LucideIcon,
  type LucideProps,
  Minus,
  Moon,
  Music,
  Palette,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Sun,
  Target,
  TrendingUp,
  TreePine,
  User,
  Users,
  Eye,
  EyeOff,
  Handshake,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
} from "lucide-react";

/** Temporary icon map — swap assets later without chasing string placeholders. */
const ICONS: Record<string, LucideIcon> = {
  home: Home,
  wallet: Wallet,
  back: ArrowLeft,
  book: BookOpen,
  bookopen: BookOpen,
  camera: Camera,
  image: ImageIcon,
  user: User,
  users: Users,
  parent: Users,
  kid: Smile,
  smiley: Smile,
  smile: Smile,
  cat: Cat,
  dog: Dog,
  bird: Bird,
  butterfly: Sparkles,
  crown: Crown,
  rocket: Rocket,
  star: Star,
  planet: Globe,
  gamecontroller: Gamepad2,
  heart: Heart,
  musicnote: Music,
  music: Music,
  palette: Palette,
  lightning: Zap,
  moon: Moon,
  sun: Sun,
  dark: Moon,
  light: Sun,
  identificationcard: IdCard,
  shieldcheck: ShieldCheck,
  briefcase: Briefcase,
  coffee: Coffee,
  house: House,
  tree: TreePine,
  mosque: Building2,
  graduationcap: GraduationCap,
  handheart: HandHeart,
  quest: Compass,
  reward: Gift,
  gift: Gift,
  approve: CheckCircle2,
  reports: BarChart3,
  settings: Settings,
  soundon: Volume2,
  soundoff: VolumeX,
  exit: LogOut,
  logout: LogOut,
  bell: Bell,
  penny: Rocket,
  key: KeyRound,
  trend: TrendingUp,
  target: Target,
  leaf: Leaf,
  loan: Handshake,
  plus: Plus,
  minus: Minus,
  show: Eye,
  hide: EyeOff,
  deposit: Plus,
  withdrawal: Minus,
  hibah: Gift,
  sadaqah: HandHeart,
  investin: Leaf,
  investreturn: Leaf,
  transaction: Wallet,
  trust: ShieldCheck,
};

function normalize(name: string) {
  return name
    .trim()
    .replace(/^phosphor:/i, "")
    .replace(/^lucide:/i, "")
    .replace(/^icon:\s*/i, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

export function AppIcon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 2,
  className,
  "aria-hidden": ariaHidden = true,
  ...props
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
} & Omit<LucideProps, "size" | "color" | "ref">) {
  const Icon = ICONS[normalize(name)] ?? Sparkles;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
}

/** Soft branded stand-in for missing illustrations / hero art. */
export function MediaPlaceholder({
  label = "Image",
  height = 160,
  className = "",
}: {
  label?: string;
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      className={`media-placeholder ${className}`}
      style={{ minHeight: height }}
      role="img"
      aria-label={label}
    >
      <AppIcon name="image" size={28} color="var(--lavender-purple)" />
      <span>{label}</span>
    </div>
  );
}
