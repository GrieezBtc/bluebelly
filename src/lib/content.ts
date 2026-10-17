export type SupportTopic = { id: string; label: string; blurb: string };

export const SUPPORT_TOPICS: SupportTopic[] = [
  { id: "account_recovery", label: "Account recovery", blurb: "Locked out, lost email access, or 2-step login trouble." },
  { id: "report_problem", label: "Report a problem", blurb: "Something is broken or not working as described." },
  { id: "privacy_security", label: "Privacy & security", blurb: "Privacy settings, blocked accounts, suspicious activity." },
  { id: "messaging", label: "Messaging & expiry", blurb: "Messages, requests, groups, disappearing content." },
  { id: "moments", label: "Moments & audiences", blurb: "Audience selection, visibility, comments, likes." },
  { id: "safety", label: "Safety & abuse", blurb: "Harassment, spam, impersonation, harmful content." },
  { id: "accessibility", label: "Accessibility", blurb: "Screen readers, contrast, motion, text size." },
  { id: "other", label: "Something else", blurb: "Anything not covered above." },
];

export const HELP_CATEGORIES = [
  { id: "start", title: "Getting started", blurb: "Create an account, set a username, install Bemblo on your phone.", count: 6 },
  { id: "messaging", title: "Messaging", blurb: "Conversations, message requests, groups, voice notes, expiring messages.", count: 9 },
  { id: "moments", title: "Moments", blurb: "Post photos, videos and text. Understand audiences in 30 seconds.", count: 7 },
  { id: "privacy", title: "Privacy & safety", blurb: "Public vs Private, who can message you, blocking, reporting.", count: 8 },
  { id: "account", title: "Account & security", blurb: "Password, verification, sessions, deleting your account.", count: 6 },
  { id: "support", title: "Bemblo Support", blurb: "How we help, response times, escalation for urgent safety issues.", count: 4 },
];

export const FAQS: { q: string; a: string; topic: string }[] = [
  {
    topic: "messaging",
    q: "When do my messages disappear?",
    a: "In a 1-to-1 chat, a message disappears 24 hours after the other person first views it. The countdown starts on that first view — not when you send it. In a group, every message disappears 7 days after it was sent, whether or not everyone has read it. Expiration is enforced by Bemblo's servers, so the message is gone for everyone.",
  },
  {
    topic: "messaging",
    q: "Do disappearing messages stop screenshots?",
    a: "No. Expiring messages remove content from Bemblo, but they cannot prevent someone from taking a screenshot, recording their screen, or photographing their phone. Please share only what you are comfortable with.",
  },
  {
    topic: "messaging",
    q: "What happens to photos and voice notes in messages?",
    a: "Temporary attachments are deleted from storage together with the message. You will never see a broken media placeholder — once the message expires it is simply not part of the conversation any more.",
  },
  {
    topic: "moments",
    q: "Do Moments disappear?",
    a: "No. Moments are lasting social content, not temporary messages. Public, Followers and Only Me Moments all stay until you delete them yourself. You can delete any Moment at any time from the Moment menu.",
  },
  {
    topic: "moments",
    q: "What is the difference between Public, Followers and Only Me?",
    a: "Public: anyone on Bemblo can see it. Followers: only people whose follow request you approved. Only Me: only you, forever, unless you explicitly change that Moment's audience. If your account is Private, your Public and Followers Moments are shown to approved followers only.",
  },
  {
    topic: "moments",
    q: "I switched my account to Private. Did my Moments change?",
    a: "Nothing is deleted. Switching your profile to Private means only approved followers can view your Public and Followers Moments. Switching back to Public makes those Moments public again. Any Moment you set to Only Me stays Only Me in both directions — it is an explicit override we never change for you.",
  },
  {
    topic: "privacy",
    q: "Is my profile privacy the same as who can message me?",
    a: "They are two separate settings. Profile privacy controls who can see your profile and Moments. Messaging permissions control who can start a chat with you: Everyone, Followers, People I follow, or Nobody. Changing one never changes the other.",
  },
  {
    topic: "privacy",
    q: "What is a Message Request?",
    a: "If someone you do not follow back messages you, the conversation arrives as a Message Request instead of your inbox. You can accept, decline, block or report before replying. The other person is never told that you declined.",
  },
  {
    topic: "privacy",
    q: "How do I block or mute someone?",
    a: "Open their profile or a conversation, tap the options menu, and choose Block or Mute. Blocking stops them from finding you, following you or messaging you. Muting keeps the conversation but silences notifications.",
  },
  {
    topic: "account",
    q: "How do I recover my account?",
    a: "Use Forgot password on the login screen for a reset link, or contact Bemblo Support with your username and the email you signed up with. You can also choose Account recovery as a support topic, and our team will verify you.",
  },
  {
    topic: "account",
    q: "How do I delete my account?",
    a: "Settings → Account → Delete account. Type your username to confirm. Your profile, Moments, messages and conversations are removed, and temporary media is cleaned from storage.",
  },
  {
    topic: "start",
    q: "Can I install Bemblo on my phone?",
    a: "Yes. Open Bemblo in your mobile browser and choose Add to Home screen (Install app on Android/Chrome, Share → Add to Home Screen on iOS Safari). Bemblo runs full screen with an offline shell and can send notifications where your browser supports it.",
  },
  {
    topic: "support",
    q: "How fast does Bemblo Support reply?",
    a: "Average first reply is under 4 hours, and safety reports are reviewed within 24 hours. Urgent threats to safety are escalated immediately.",
  },
];

export const REPORT_REASONS = [
  { id: "spam", label: "Spam or unwanted advertising" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate_speech", label: "Hate speech" },
  { id: "scam_or_fraud", label: "Scam or fraud" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "nudity_or_sexual_content", label: "Nudity or sexual content" },
  { id: "violence", label: "Violence or dangerous behaviour" },
  { id: "self_harm", label: "Self-harm or suicide content" },
  { id: "intellectual_property", label: "Intellectual property" },
  { id: "other", label: "Something else" },
];

export const LEGAL_DOCS = {
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated today",
    sections: [
      {
        heading: "What Bemblo collects",
        body: "Account details you provide (name, username, email or phone, password hash), the Moments and messages you create, your privacy and messaging settings, and limited technical data needed to keep the service reliable and safe.",
      },
      {
        heading: "How visibility works",
        body: "Profile privacy, Moment audience and messaging permissions are three separate systems, and they are enforced on Bemblo's servers — not in the app you are using. If you set a Moment to Only Me, only you can read it, even if you later make your profile public.",
      },
      {
        heading: "Temporary messaging data",
        body: "1-to-1 messages are deleted 24 hours after they are first viewed. Group messages are deleted 7 days after they are sent. Attachments are deleted from storage with the message. Deletion is permanent.",
      },
      {
        heading: "Your controls",
        body: "You can export-request, correct or delete your account and its content at any time from Settings. Support can help with account recovery and privacy questions.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "Last updated today",
    sections: [
      {
        heading: "Using Bemblo",
        body: "You need an accurate account to use Bemblo. You are responsible for what you post and send, and for keeping your password safe. You must be old enough to use social services in your country.",
      },
      {
        heading: "Your content",
        body: "You own your Moments and messages. You grant Bemblo the limited licence needed to store, deliver and display that content to the audience you selected. We do not sell your content.",
      },
      {
        heading: "Unacceptable use",
        body: "No harassment, hate, impersonation, scams, spam, sexual content involving minors, or content that endangers others. We may remove content and suspend accounts to protect people.",
      },
      {
        heading: "Service changes",
        body: "Bemblo evolves. We will explain material changes to privacy or messaging behaviour inside the app before they take effect.",
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    updated: "Last updated today",
    sections: [
      { heading: "Be real", body: "Use your own identity. Do not impersonate people, brands or Bemblo staff." },
      { heading: "Be respectful", body: "Disagree freely, but do not target, threaten or degrade people." },
      { heading: "Respect privacy", body: "Do not screenshot, save or reshare someone's content in ways they did not intend." },
      { heading: "Keep it safe", body: "No content that encourages self-harm, violence, or harm to minors." },
      { heading: "Report, do not retaliate", body: "Use the report and block tools. Our safety team reviews every report." },
    ],
  },
} as const;

export const NOTIFICATION_PREF_COPY = [
  { id: "push", label: "Push notifications", blurb: "Alerts on this device while Bemblo runs in the background." },
  { id: "email", label: "Email notifications", blurb: "Emails for new messages, comments and follows when you are away (at most one every 15 minutes), plus account and security emails." },
  { id: "messages", label: "Message notifications", blurb: "New messages, message requests and views." },
  { id: "social", label: "Social notifications", blurb: "Likes, comments and mentions on your Moments." },
  { id: "requests", label: "Follow activity", blurb: "New followers, follow requests and approvals." },
] as const;
