export type SupportTopic = { id: string; label: string; blurb: string };

export const SUPPORT_TOPICS: SupportTopic[] = [
  { id: "account_recovery", label: "Account recovery", blurb: "Locked out, lost email access, or 2-step login trouble." },
  { id: "report_problem", label: "Report a problem", blurb: "Something is broken or not working as described." },
  { id: "privacy_security", label: "Privacy & security", blurb: "Privacy settings, blocked accounts, suspicious activity." },
  { id: "messaging", label: "Messaging & disappearing messages", blurb: "Messages, requests, groups, replies, edit and delete, disappearing-message settings." },
  { id: "moments", label: "Moments & audiences", blurb: "Audience selection, visibility, comments, likes." },
  { id: "safety", label: "Safety & abuse", blurb: "Harassment, spam, impersonation, harmful content." },
  { id: "accessibility", label: "Accessibility", blurb: "Screen readers, contrast, motion, text size." },
  { id: "other", label: "Something else", blurb: "Anything not covered above." },
];

export const HELP_CATEGORIES = [
  { id: "start", title: "Getting started", blurb: "Create an account, set a username, install Bemblo on your phone.", count: 2 },
  { id: "messaging", title: "Messaging", blurb: "Conversations, message requests, groups, replies, voice notes, disappearing messages.", count: 8 },
  { id: "moments", title: "Moments", blurb: "Post photos, videos and text. Understand audiences in 30 seconds.", count: 3 },
  { id: "privacy", title: "Privacy & safety", blurb: "Public vs Private, who can message you, blocking, reporting.", count: 4 },
  { id: "account", title: "Account & security", blurb: "Password, verification, sessions, deleting your account.", count: 2 },
  { id: "support", title: "Bemblo Support", blurb: "How we help, response times, escalation for urgent safety issues.", count: 1 },
];

export const FAQS: { q: string; a: string; topic: string }[] = [
  {
    topic: "messaging",
    q: "How do disappearing messages work?",
    a: "Every chat has its own disappearing-messages setting, and you stay in control of it. In a 1-to-1 chat, either person can choose Instant, 24 hours, 7 days or 30 days, or turn the feature off. The timer starts when the other person views a message. In a group chat, admins choose 24 hours, 7 days or 30 days, or turn it off, and the timer starts when the message is sent. New chats start at 24 hours (1-to-1) and 7 days (groups). Expiry is enforced by Bemblo's servers, so a message that has expired is gone for everyone.",
  },
  {
    topic: "messaging",
    q: "Where do I change the disappearing-messages setting?",
    a: "Open the chat and tap its name at the top to open the info panel. Use the Disappearing messages switch to turn it on or off, then pick a duration. In a group only admins can change it. Each change is announced in the chat so everyone knows the current rule. A new setting applies to messages sent after the change; messages that were already sent keep the timer they were sent with.",
  },
  {
    topic: "messaging",
    q: "Do disappearing messages stop screenshots?",
    a: "No. Disappearing messages remove content from Bemblo on the schedule you choose, but they cannot prevent someone from taking a screenshot, recording their screen or photographing a device. In Instant mode Bemblo also hides the chat whenever the app is not in front of you and turns off copying and saving, but no website can block screenshots or screen recording, so please share only what you are comfortable with.",
  },
  {
    topic: "messaging",
    q: "What happens to photos and voice notes in messages?",
    a: "Attachments are stored privately and are only available to people in the conversation. When a message expires or is deleted, its attachment is deleted from storage with it. If disappearing messages are off, attachments stay until the message is deleted.",
  },
  {
    topic: "messaging",
    q: "Can I edit or delete a message I sent?",
    a: "Yes. In any chat, open the message options and choose Edit (text messages only) or Delete. Edited messages show an edited label. Deleting removes the message for everyone in the conversation, and its photo, video or voice note is deleted too. This cannot be undone.",
  },
  {
    topic: "messaging",
    q: "What can group admins do with messages?",
    a: "Admins can delete any message in their group, for example to remove something harmful. Nobody, admins included, can edit another person's message. Everyone sees when an admin removed a message.",
  },
  {
    topic: "messaging",
    q: "How do replies work?",
    a: "Open a message's options and choose Reply. Your message is sent with a short quote of the original so the conversation stays easy to follow. In a group, the person you replied to gets a notification. You can also reply to comments on a Moment, and the person you replied to is notified.",
  },
  {
    topic: "messaging",
    q: "How do I leave a group, or remove someone from it?",
    a: "Anyone can leave a group from the group options. If you are the only admin, make someone else an admin first. Admins can remove any member from the group info panel; regular members cannot remove other people. A removed member can no longer see the chat and the old invite link will not bring them back, but an admin can add them again.",
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
    a: "Open your profile, tap the menu button, then Settings → Account & app → Delete account. Type your username to confirm. Your profile, Moments, messages and conversations are removed, and attachments are deleted from storage.",
  },
  {
    topic: "start",
    q: "Can I install Bemblo on my phone?",
    a: "Yes. Open Bemblo in your mobile browser and choose Add to Home screen (Install app on Android/Chrome, Share → Add to Home Screen on iOS Safari). Bemblo runs full screen with an offline shell and can send notifications where your browser supports it.",
  },
  {
    topic: "start",
    q: "What is the official Bemblo account?",
    a: "The official Bemblo account shares announcements and upcoming updates. You can follow it, but it does not accept messages. For help with your account, use Help & Support so a real person can see your request. Bemblo staff will never ask for your password.",
  },
  {
    topic: "privacy",
    q: "What happens when I report something?",
    a: "Your report goes to the Bemblo team, who review it and take action under our Community Guidelines. The person you reported is not told who reported them. When we finish reviewing, you receive a notification with the outcome. You can also block or mute the account straight away.",
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
    updated: "Last updated: 20 October 2026",
    sections: [
      {
        heading: "1. About this policy",
        body: "This Privacy Policy explains what personal information Bemblo collects, why we collect it, who can see it, how long we keep it, and the choices you have. It applies to Bemblo on the web (bemblo.name.ng) and any installed version of the app. By creating an account you confirm you have read it. If you disagree with it, please do not use Bemblo.",
      },
      {
        heading: "2. Information we collect",
        body: "Account information: your name, username, email address, an optional phone number, and your password, which we store only as a one-way hash.\n\nProfile information: your bio, profile photo and accent colour, and your profile privacy choice (Public or Private).\n\nContent you create: Moments (text, photos and videos), comments and replies, likes, and messages, including voice notes, photos and videos you send in conversations.\n\nSocial connections: who you follow and who follows you, follow requests, accounts you block or mute, and the groups you belong to.\n\nSettings and preferences: your messaging permission, sensitive-content preference, notification preferences, and the disappearing-message setting of each chat.\n\nDevice and technical data: your session, the type of browser or device, request logs needed to run and secure the service, and, only if you turn on push notifications, a push subscription issued by your browser.\n\nCommunications with us: support requests you send and reports you submit.",
      },
      {
        heading: "3. How we use your information",
        body: "We use your information to:\n• create and secure your account and verify your email;\n• store and deliver your Moments, messages and notifications to the people you choose;\n• enforce your privacy, audience and messaging settings;\n• keep Bemblo safe, including reviewing reports, preventing spam and abuse, and enforcing our Terms and Community Guidelines;\n• answer support requests and send service, security and account emails;\n• maintain, troubleshoot and improve the reliability of the service; and\n• meet our legal obligations.\n\nWe do not sell your personal information.",
      },
      {
        heading: "4. Who can see your content",
        body: "Profile privacy, Moment audience and messaging permissions are three separate controls, and they are enforced on Bemblo's servers rather than only in the app you are using.\n\nA Public profile and Public Moments can be seen by anyone on Bemblo. A Private profile, and Moments set to Followers, are visible only to followers you have approved. A Moment set to Only Me is visible only to you, even if you later change your profile to Public. Messages are visible only to the people in that conversation. Blocking someone stops them from finding you, following you or messaging you.",
      },
      {
        heading: "5. Messages and disappearing messages",
        body: "You control how long messages stay in each conversation.\n\n1-to-1 chats: either person can choose Instant, 24 hours, 7 days or 30 days, or turn disappearing messages off. The timer for a message starts when the other person first views it. Instant removes a message 10 seconds after it has been viewed, and in Instant mode the chat is hidden whenever Bemblo is not in front of you and copying and saving are turned off.\n\nGroup chats: group admins can choose 24 hours, 7 days or 30 days, or turn disappearing messages off. The timer starts when a message is sent, whether or not everyone has read it.\n\nNew chats start at 24 hours (1-to-1) and 7 days (groups). A change applies to messages sent after it; messages already sent keep the timer they were sent with, and every change is announced in the chat. When a message expires, Bemblo permanently deletes the message and its attachments from active storage. If disappearing messages are off, messages stay until someone deletes them. Messages that are never viewed are removed after 30 days when a timer is on.\n\nYou can edit your own text messages (they then show an edited label) and delete your own messages at any time. Deleting removes the message and its attachment for everyone in the conversation. In a group, an admin can delete any member's message but cannot edit it.\n\nDisappearing messages cannot prevent another person from taking a screenshot, recording their screen or photographing their device, and content may remain briefly in routine system backups or logs before it is overwritten.",
      },
      {
        heading: "6. Notifications",
        body: "Bemblo sends in-app notifications for activity such as messages, replies, comments, likes and follows. If you allow it, we also send push notifications to your device; you can withdraw permission at any time in your browser or device settings, or in Bemblo's notification settings. We may send email notifications when you are away (at most one every 15 minutes) as well as account, verification and security emails. You can change these preferences in Settings, but we may still email you about your account's security.",
      },
      {
        heading: "7. Who we share information with",
        body: "We share information only as described here:\n• with other users, according to the audience, privacy and messaging settings you choose;\n• with service providers that help us run Bemblo under appropriate confidentiality and security terms, such as our hosting provider, database provider, file storage provider, email delivery provider, and the push-notification services run by browser and device makers;\n• when required by law, legal process or a valid request from a public authority;\n• to protect the safety of people, to investigate abuse or fraud, or to protect Bemblo's rights; and\n• in connection with a merger, acquisition or sale of assets, in which case we will tell you and any new owner will remain bound by this policy.\n\nPhotos, videos and voice notes are stored privately, and access is checked on our servers against who is allowed to see them.",
      },
      {
        heading: "8. Reports, moderation and support",
        body: "When you report a user, Moment, comment or message, we store your report, the reason you chose, any details you add, and your account so we can review it and tell you the outcome. The person you report is not told who reported them. Our team may look at the reported content and related account information to decide what action to take. Support requests are handled in the same way: they are visible to Bemblo's support team and used only to help you.",
      },
      {
        heading: "9. How long we keep information",
        body: "We keep account and profile information while your account is active. Moments, comments and likes stay until you delete them or delete your account. Messages follow the disappearing-message setting described above. Push subscriptions are removed when you turn notifications off or they stop working. Reports, support records and security logs are kept for as long as reasonably needed to protect people, resolve disputes and meet legal obligations. When you delete your account, we remove your profile, Moments, messages and attachments from active systems.",
      },
      {
        heading: "10. Your choices and rights",
        body: "You can update your profile, privacy, messaging, content and notification settings at any time from your profile menu. You can delete your account in Settings under Account & app. Depending on where you live, including under the Nigeria Data Protection Act 2023 and similar laws, you may also have the right to ask us for access to, a copy of, correction of, or deletion of your personal information, and to object to or restrict certain processing. To make a request, contact Bemblo Support and choose Privacy & security. We may need to verify your identity first.",
      },
      {
        heading: "11. Security",
        body: "We protect your information with measures such as encrypted connections, hashed passwords, private file storage and server-side access checks. No online service can be completely secure, so please choose a strong, unique password and tell us straight away if you suspect your account has been accessed by someone else.",
      },
      {
        heading: "12. Children",
        body: "Bemblo is for people who are old enough to use online social services in their country, and in any case not under 13. We do not knowingly collect information from anyone below the minimum age. If you believe a child has created an account, contact Support and we will take action, including deleting the account.",
      },
      {
        heading: "13. International processing",
        body: "Our service providers may process information on servers located outside your country. Where we do this, we take steps to make sure your information remains protected in line with this policy and applicable law.",
      },
      {
        heading: "14. Changes to this policy",
        body: "We may update this policy as Bemblo changes. If a change is material, especially to how messages or your data are handled, we will tell you in the app or by email before it takes effect. The date at the top shows when this policy was last updated.",
      },
      {
        heading: "15. Contact us",
        body: "Questions or requests about this policy or your information? Open Help & Support in the app and choose Privacy & security. A member of the Bemblo team will reply.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "Last updated: 20 October 2026",
    sections: [
      {
        heading: "1. Agreement",
        body: "These Terms of Service form a binding agreement between you and Bemblo. By creating an account or using Bemblo you agree to these Terms, our Privacy Policy and our Community Guidelines. If you do not agree, please do not use Bemblo.",
      },
      {
        heading: "2. Eligibility and your account",
        body: "You must be old enough to use online social services in your country, and in any case at least 13. You must give accurate information, verify your email address, and keep your password confidential. You are responsible for activity on your account. Tell us promptly if you think someone else has accessed it. You may not sell, transfer or share your account.",
      },
      {
        heading: "3. How Bemblo works",
        body: "Moments are posts you share with an audience you choose: Public, Followers or Only Me. They stay until you delete them. Messages are private conversations, either 1-to-1 or in groups. People you do not follow back reach you as message requests, and you decide who can start a chat with you. You control how long messages stay in each chat using disappearing messages (see section 5). Notifications keep you up to date, and you can adjust them in Settings.",
      },
      {
        heading: "4. Your content",
        body: "You own the Moments, messages and other content you create. You grant Bemblo a limited, non-exclusive licence to store, process, deliver and display that content to the audience you select, and only so we can operate and secure the service. We do not sell your content. You are responsible for your content and confirm that you have the rights needed to share it. Do not post content that infringes someone else's rights.",
      },
      {
        heading: "5. Messaging and disappearing messages",
        body: "Disappearing messages are controlled by users. In 1-to-1 chats either person can set or turn off the timer; in group chats only admins can. Settings apply to messages sent after a change, and Bemblo announces every change in the chat. Expired and deleted messages are permanently removed from Bemblo and cannot be recovered, so Bemblo is not a backup of your conversations.\n\nDisappearing messages remove content from Bemblo only. They cannot prevent other people from taking screenshots, recording a screen or photographing a device, and we do not promise that they can. Do not share anything you are not comfortable having others keep.\n\nYou can edit your own text messages and delete your own messages. In groups, admins can add and remove members, change the group timer, and delete any member's message, but they cannot edit anyone else's message. Members can leave a group at any time. Admins must use these powers fairly and in line with our Community Guidelines.",
      },
      {
        heading: "6. Acceptable use",
        body: "You agree not to:\n• harass, threaten, bully or abuse anyone, or share hateful content;\n• pretend to be another person, brand or Bemblo staff;\n• post spam, scams, malware or misleading content;\n• share sexual content involving minors, or content that encourages self-harm, violence or harm to others;\n• share someone's private information or private messages without permission;\n• try to access accounts, data or systems you are not allowed to, or interfere with the service;\n• use automated tools to collect data from Bemblo; or\n• use Bemblo for anything unlawful.",
      },
      {
        heading: "7. Reports, moderation and enforcement",
        body: "You can report accounts, Moments, comments and messages. Our team reviews reports and may remove content, limit features, suspend or permanently close accounts, and notify authorities where the law requires or someone's safety is at risk. We aim to apply these rules consistently. If you think we made a mistake, contact Support and we will take another look.",
      },
      {
        heading: "8. The official Bemblo account and support",
        body: "Bemblo's official account shares announcements and updates. You can follow it but it does not accept messages. For help, use Help & Support so that a real person can see your request. Bemblo will never ask for your password.",
      },
      {
        heading: "9. Third-party services",
        body: "Bemblo relies on third-party services for hosting, storage, email and push notifications. Your browser, device or network provider may also affect how Bemblo works. We are not responsible for services we do not control.",
      },
      {
        heading: "10. Bemblo's rights",
        body: "Bemblo, including its name, logo, design and software, belongs to us or our licensors and is protected by law. These Terms do not give you any right to use them except to use the service as intended. If you send us feedback or ideas, we may use them without obligation to you.",
      },
      {
        heading: "11. Ending your account",
        body: "You can delete your account at any time in Settings under Account & app. We may suspend or close accounts that break these Terms or put others at risk. When an account is deleted, its profile, Moments, messages and attachments are removed as described in the Privacy Policy. Sections that by their nature should continue, such as those on liability and disputes, continue after your account ends.",
      },
      {
        heading: "12. Availability and changes",
        body: "We work to keep Bemblo available and reliable, but we cannot promise it will always be uninterrupted or error-free. We may add, change or remove features. If we make a material change to how privacy or messaging works, we will tell you in the app or by email before it takes effect.",
      },
      {
        heading: "13. Disclaimers and liability",
        body: "Bemblo is provided as is and as available. To the fullest extent permitted by law, we do not give any warranty that the service will meet your needs or be uninterrupted, secure or error-free, and we are not liable for indirect or consequential losses, for content posted by users, or for the actions of other people. Nothing in these Terms limits any right or liability that cannot be limited by law.",
      },
      {
        heading: "14. Governing law",
        body: "These Terms are governed by the laws of the Federal Republic of Nigeria, without affecting any consumer rights you have under the mandatory laws of the place where you live. We will first try to resolve any dispute informally through Support.",
      },
      {
        heading: "15. Changes to these Terms",
        body: "We may update these Terms. If a change is material we will notify you before it takes effect. If you keep using Bemblo after the change, you accept the updated Terms. The date above shows when they were last updated.",
      },
      {
        heading: "16. Contact",
        body: "Questions about these Terms? Open Help & Support in the app, choose Something else, and the Bemblo team will reply.",
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    updated: "Last updated: 20 October 2026",
    sections: [
      { heading: "Be real", body: "Use your own identity. Do not impersonate people, brands or Bemblo staff. The only official Bemblo account is the one marked Official." },
      { heading: "Be respectful", body: "Disagree freely, but do not target, threaten, bully or degrade people. Hateful content has no place here." },
      { heading: "Respect privacy", body: "Do not screenshot, save or reshare someone's private messages or content in ways they did not intend. Disappearing messages are a courtesy that depends on everyone respecting them." },
      { heading: "Keep it safe", body: "No content that encourages self-harm, violence, or harm to minors. If you are worried about someone's safety, report it so our team can act quickly." },
      { heading: "Use groups responsibly", body: "Group admins set the rules for their group, including the disappearing-messages timer, and may remove members or delete messages that break these Guidelines. Admins should act fairly and members should respect the admins' decisions. You can leave a group at any time." },
      { heading: "No spam or scams", body: "Do not post repetitive, deceptive or unsolicited promotional content, or ask people for money, passwords or codes. Bemblo staff will never ask for your password." },
      { heading: "Report, do not retaliate", body: "Use the report, block and mute tools. Our team reviews every report, and the person you report is never told it was you." },
      { heading: "Consequences", body: "Depending on the seriousness, we may remove content, limit features, suspend or close accounts, and involve the authorities where someone's safety is at risk. If you think we got it wrong, contact Support." },
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
