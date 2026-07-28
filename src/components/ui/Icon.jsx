import {
  LayoutAlt01, Stars01, Users01, Settings01, Folder, Award01, Gift01, Clipboard,
  TrendUp01, Lock01, Home01, File01, ClockRewind, Umbrella01, MessageSquare01, Target01,
  Calendar, CurrencyDollar, BarChart01, User01, Heart, Pin01, Paperclip, Shield01, Bell01,
  AlertTriangle, Clock, Plus, Grid01, Building02, CheckCircle, Circle, Key01, LogOut01,
  Activity, Zap, BarChartSquare02, UserEdit, CalendarDate, ClipboardCheck, Inbox01, Minus,
  SearchLg, RefreshCw01, Bold01, Italic01, Underline01, Strikethrough01, List, Dotpoints02,
  Link01, Heading02, Heading01, Eraser, XCircle, Star01, StickerSquare, MagicWand01,
  FolderSearch, Lightbulb01, Tool01, TrendDown01, Eye, Sun, Moon01, Briefcase01, Camera01,
  MarkerPin01, ChevronDown, AlertCircle, VolumeMax, VolumeX, Trash01, Edit05,
  Send01, FaceHappy, Microphone01, Image01, CornerUpLeft, CheckDone01, Check,
  Play, PauseCircle, Download01, XClose,
} from "@untitledui/icons";

// Iconos de la app con el set de Untitled UI (@untitledui/icons, MIT). Un único punto: cambiar
// aquí un mapeo cambia el ícono en toda la app. Los componentes aceptan size/strokeWidth/color/
// className igual que antes, así que el resto de la app no cambia.
const ICON_MAP = {
  dashboard: LayoutAlt01,
  ai: Stars01,
  users: Users01,
  settings: Settings01,
  folder: Folder,
  award: Award01,
  cake: Gift01,
  clipboard: Clipboard,
  trending: TrendUp01,
  lock: Lock01,
  home: Home01,
  file: File01,
  history: ClockRewind,
  vacation: Umbrella01,
  message: MessageSquare01,
  target: Target01,
  calendar: Calendar,
  dollar: CurrencyDollar,
  chart: BarChart01,
  sparkles: Stars01,
  user: User01,
  heart: Heart,
  pin: Pin01,
  paperclip: Paperclip,
  shield: Shield01,
  bell: Bell01,
  alert: AlertTriangle,
  gift: Gift01,
  clock: Clock,
  plus: Plus,
  spreadsheet: Grid01,
  building: Building02,
  check: CheckCircle,
  circle: Circle,
  key: Key01,
  logout: LogOut01,
  activity: Activity,
  brain: Zap,
  report: BarChartSquare02,
  userCog: UserEdit,
  calendarDays: CalendarDate,
  clipboardCheck: ClipboardCheck,
  shieldAlert: Shield01,
  inbox: Inbox01,
  stable: Circle,
  warning: AlertTriangle,
  critical: AlertCircle,
  minus: Minus,
  search: SearchLg,
  party: Gift01,
  partyPopper: Gift01,
  repeat: RefreshCw01,
  bold: Bold01,
  italic: Italic01,
  underline: Underline01,
  strike: Strikethrough01,
  listBullet: List,
  listOrdered: Dotpoints02,
  link: Link01,
  h2: Heading02,
  h3: Heading01,
  clearFormat: Eraser,
  xCircle: XCircle,
  star: Star01,
  note: StickerSquare,
  wand: MagicWand01,
  folderSearch: FolderSearch,
  lightbulb: Lightbulb01,
  wrench: Tool01,
  trendingDown: TrendDown01,
  eye: Eye,
  sun: Sun,
  moon: Moon01,
  briefcase: Briefcase01,
  camera: Camera01,
  mapPin: MarkerPin01,
  chevronDown: ChevronDown,
  refresh: RefreshCw01,
  volumen: VolumeMax,
  volumenOff: VolumeX,
  trash: Trash01,
  edit: Edit05,

  // Chat (mensajes empleado ↔ psicóloga).
  send: Send01,
  smile: FaceHappy,
  mic: Microphone01,
  image: Image01,
  reply: CornerUpLeft,
  // Acuse de recibo: 'check' del mapa es un círculo con palomita y aquí hace falta la palomita
  // sola (enviado) frente a la doble (leído), como en cualquier mensajería.
  checkSimple: Check,
  checkDoble: CheckDone01,
  play: Play,
  pause: PauseCircle,
  download: Download01,
  close: XClose,
};

const Icon = ({ name, size = 18, className = "", strokeWidth = 1.75, color }) => {
  const SvgIcon = ICON_MAP[name];
  if (!SvgIcon) return null;
  return (
    <SvgIcon
      size={size}
      className={`mc-icon ${className}`.trim()}
      strokeWidth={strokeWidth}
      color={color}
      aria-hidden="true"
    />
  );
};

export default Icon;
