import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "moments"
  | "create"
  | "chat"
  | "user"
  | "search"
  | "bell"
  | "settings"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "more"
  | "heart"
  | "comment"
  | "share"
  | "send"
  | "image"
  | "video"
  | "mic"
  | "lock"
  | "globe"
  | "users"
  | "user-plus"
  | "check"
  | "check-double"
  | "x"
  | "plus"
  | "trash"
  | "flag"
  | "ban"
  | "mute"
  | "logout"
  | "help"
  | "shield"
  | "shield-check"
  | "info"
  | "alert"
  | "clock"
  | "eye"
  | "eye-off"
  | "edit"
  | "reply"
  | "arrow-right"
  | "menu"
  | "install"
  | "offline"
  | "refresh"
  | "link"
  | "camera"
  | "sparkle"
  | "mail"
  | "key"
  | "at"
  | "sliders"
  | "grid"
  | "play"
  | "pause"
  | "pin"
  | "request"
  | "file";

const PATHS: Record<IconName, string> = {
  file: "M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M9.6 12.5h4.8M9.6 15.5h4.8",
  home: "M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.4v-5.4H9.4V20H5a1 1 0 0 1-1-1z",
  moments: "M4 5.5h16v13H4zM4 15l4.6-4 3.4 3 2.6-2.6L20 17M15.6 10.6a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
  create: "M12 5v14M5 12h14",
  chat: "M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v6.8A2.6 2.6 0 0 1 17.4 16H10l-4.6 4v-4H6.6A2.6 2.6 0 0 1 4 13.4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.6 20c1.6-3.4 4.1-5 7.4-5s5.8 1.6 7.4 5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM20 20l-4.3-4.3",
  bell: "M18 16.5V11a6 6 0 0 0-12 0v5.5L4.8 19h14.4zM9.6 19.6a2.4 2.4 0 0 0 4.8 0",
  settings: "M4 7h16M4 12h16M4 17h16",
  "chevron-left": "M14.5 6 8.5 12l6 6",
  "chevron-right": "M9.5 6l6 6-6 6",
  "chevron-down": "M6 9.5l6 6 6-6",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  heart: "M12 20s-7.6-4.7-7.6-9.7A4.4 4.4 0 0 1 12 7.5a4.4 4.4 0 0 1 7.6 2.8c0 5-7.6 9.7-7.6 9.7z",
  comment: "M5 6.6A2.6 2.6 0 0 1 7.6 4h8.8A2.6 2.6 0 0 1 19 6.6v6A2.6 2.6 0 0 1 16.4 15H11l-4.4 3.6V15H7.6A2.6 2.6 0 0 1 5 12.4z",
  share: "M12 15.5V4M8.4 7.6 12 4l3.6 3.6M6 13.5V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-5.5",
  send: "M5 12.4 20 4.6l-6.9 15.4-1.9-6.4z",
  image: "M4 6.5h16v11H4zM4 15.2l4.6-4 3.4 3 2.6-2.6L20 17M15.6 10.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z",
  video: "M4 7.5h10.5v9H4zM14.5 12l5.5-3.6v11.2z",
  mic: "M12 4.6a2.5 2.5 0 0 1 2.5 2.5v4.8a2.5 2.5 0 0 1-5 0V7.1A2.5 2.5 0 0 1 12 4.6zM6.6 11.4a5.4 5.4 0 0 0 10.8 0M12 16.8V20M9.2 20h5.6",
  lock: "M6.5 11h11v8.5h-11zM8.8 11V8.3a3.2 3.2 0 0 1 6.4 0V11",
  globe: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM3.9 9.4h16.2M3.9 14.6h16.2M12 3.6c2.1 2.4 3.2 5.2 3.2 8.4s-1.1 6-3.2 8.4c-2.1-2.4-3.2-5.2-3.2-8.4S9.9 6 12 3.6z",
  users: "M9.6 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.2 20c1.3-2.9 3.4-4.4 6.4-4.4s5.1 1.5 6.4 4.4M16.6 10.5a3 3 0 1 0 0-6M17.6 15.9c1.8.4 3.1 1.7 3.8 4.1",
  "user-plus": "M10 12a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM3.4 20c1.3-2.8 3.5-4.2 6.6-4.2 1.2 0 2.3.2 3.2.6M18 13.6v6M15 16.6h6",
  check: "M5 12.6l4.5 4.5L19 7.4",
  "check-double": "M3.5 12.6l3.8 3.8 6.2-6.2M11.6 16.4l.9.9L22 7.4",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  trash: "M5.5 7h13M9.6 7V4.8h4.8V7M7.4 7l.9 13h7.4l.9-13M10.4 10.4v6.4M13.6 10.4v6.4",
  flag: "M6 4v16M6 4.8h11.6l-2.2 3.6 2.2 3.6H6",
  ban: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM6.3 6.3l11.4 11.4",
  mute: "M4 9.6h3l4-3.6v12l-4-3.6H4zM15 9.9l5 4.4M20 9.9l-5 4.4",
  logout: "M9.5 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19h2.7M15 8.2l3.8 3.8-3.8 3.8M18.6 12H9.6",
  help: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1 1-1.1 1.8M12 17h.01",
  shield: "M12 3.6 5.8 6v5.8c0 3.6 2.5 6.8 6.2 8.4 3.7-1.6 6.2-4.8 6.2-8.4V6z",
  "shield-check": "M12 3.6 5.8 6v5.8c0 3.6 2.5 6.8 6.2 8.4 3.7-1.6 6.2-4.8 6.2-8.4V6zM9 12.2l2.2 2.2 4.1-4.3",
  info: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM12 11v6M12 8h.01",
  alert: "M12 4.4 20.6 19.6H3.4zM12 10v4.2M12 17h.01",
  clock: "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zM12 7.6V12l3.2 2",
  eye: "M2.8 12S6.2 6.6 12 6.6 21.2 12 21.2 12 17.8 17.4 12 17.4 2.8 12 2.8 12zM12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
  "eye-off": "M4 4l16 16M9.6 6a9.4 9.4 0 0 1 2.4-.3c5.8 0 9.2 5.4 9.2 5.4a16.6 16.6 0 0 1-2.3 3M6.3 8.3C4 9.9 2.8 11.9 2.8 11.9S6.2 17.4 12 17.4c.9 0 1.7-.1 2.5-.4",
  reply: "M9.5 6.5L4 12l5.5 5.5M4 12h10.5a5.5 5.5 0 0 1 5.5 5.5V19",
  edit: "M5 19h3.2L19 8.2 15.8 5 5 15.8zM14.6 6.2l3.2 3.2",
  "arrow-right": "M5 12h13.5M13 6.2l5.8 5.8-5.8 5.8",
  menu: "M4 7h16M4 12h16M4 17h16",
  install: "M12 4v10.6M8.2 11l3.8 3.8L15.8 11M5 19.6h14",
  offline: "M4 4l16 16M4.6 9.4C6.7 7.7 9.2 6.8 12 6.8c1.2 0 2.4.2 3.5.5M2.6 6.4C5.5 4.3 8.7 3.2 12 3.2c3.3 0 6.5 1.1 9.4 3.2M8.2 13.2c1.1-.9 2.4-1.4 3.8-1.4s2.7.5 3.8 1.4M12 17.6h.01",
  refresh: "M20 12a8 8 0 1 1-2.4-5.7M20.4 4.6V10h-5.4",
  link: "M10.4 13.6a3.4 3.4 0 0 0 4.8 0l2.6-2.6a3.4 3.4 0 0 0-4.8-4.8l-1 1M13.6 10.4a3.4 3.4 0 0 0-4.8 0l-2.6 2.6a3.4 3.4 0 0 0 4.8 4.8l1-1",
  camera: "M4 8.6h3l1.4-2h7.2l1.4 2h3v9.8H4zM12 16.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z",
  sparkle: "M12 3.6l1.8 5.1 5.1 1.8-5.1 1.8L12 17.4l-1.8-5.1L5.1 10.5l5.1-1.8z",
  mail: "M3.6 6.4h16.8v11.2H3.6zM4.2 7l7.8 6 7.8-6",
  key: "M14.4 4.6a4.8 4.8 0 1 0 3.2 8.4H20V10h-2.2a4.8 4.8 0 0 0-3.4-5.4zM14.6 10h.01",
  at: "M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8zM16.4 12v1.6a2.1 2.1 0 0 0 4.2 0V12a8.6 8.6 0 1 0-3.5 6.9",
  sliders: "M4 7.4h16M4 12h16M4 16.6h16M9 5.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM15 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 14.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  grid: "M4 4.6h6.4V11H4zM13.6 4.6H20V11h-6.4zM4 13.2h6.4v6.2H4zM13.6 13.2H20v6.2h-6.4z",
  play: "M8.4 5.6 18.6 12 8.4 18.4z",
  pause: "M9 5.6v12.8M15 5.6v12.8",
  pin: "M12 3.6a5.4 5.4 0 0 1 5.4 5.4c0 3.6-5.4 11.4-5.4 11.4S6.6 12.6 6.6 9A5.4 5.4 0 0 1 12 3.6zM12 11.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z",
  request: "M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v6.8A2.6 2.6 0 0 1 17.4 16H10l-4.6 4v-4H6.6A2.6 2.6 0 0 1 4 13.4zM12 8v4M10 10h4",
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
  filled?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, filled = false, strokeWidth = 1.75, className, ...rest }: IconProps) {
  const isFillable = name === "heart" || name === "play";
  const useFill = filled && isFillable;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill={useFill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={useFill ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function BrandMark({ size = 32, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="brandmark">
      <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="BlueBelly">
        <defs>
          <linearGradient id="bemblo-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF2FA0" />
            <stop offset="60%" stopColor="#B02CE0" />
            <stop offset="100%" stopColor="#5B21D6" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill="url(#bemblo-mark)" />
        <path fillRule="evenodd" d="M12 9h9.2c3.7 0 6.3 2.2 6.3 5.5 0 2.1-1.1 3.7-2.9 4.5 2.4.7 3.9 2.6 3.9 5.2 0 3.7-2.9 6.3-7.2 6.3H12zM16 12.4v4.6h4.4c1.6 0 2.6-.9 2.6-2.3s-1-2.3-2.6-2.3zM16 20.4v5.2h4.9c1.8 0 2.9-1 2.9-2.6s-1.1-2.6-2.9-2.6z" fill="#fff" />
      </svg>
      {showWord ? <span className="brandmark__text">BlueBelly</span> : null}
    </span>
  );
}
