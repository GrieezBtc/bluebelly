import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationMembers,
  conversations,
  follows,
  messageViews,
  messages,
  momentComments,
  momentLikes,
  moments,
  notifications,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { MESSAGE_EXPIRY } from "@/lib/privacy";

export const DEMO_USERNAME = "ava.rivera";
export const DEMO_PASSWORD = "bemblo1234";

const IMG = {
  avatarBemblo:
    "https://images.pexels.com/photos/33799456/pexels-photo-33799456.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarAva: "https://images.pexels.com/photos/6497112/pexels-photo-6497112.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarMaya: "https://images.pexels.com/photos/7717254/pexels-photo-7717254.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarLiam: "https://images.pexels.com/photos/6102841/pexels-photo-6102841.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarNoor: "https://images.pexels.com/photos/6497114/pexels-photo-6497114.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarTomas: "https://images.pexels.com/photos/14950779/pexels-photo-14950779.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  avatarDiego: "https://images.pexels.com/photos/10426587/pexels-photo-10426587.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  streetSunset:
    "https://images.pexels.com/photos/13089531/pexels-photo-13089531.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  crossing: "https://images.pexels.com/photos/8225525/pexels-photo-8225525.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  windowLight:
    "https://images.pexels.com/photos/11618231/pexels-photo-11618231.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  grocery: "https://images.pexels.com/photos/37607956/pexels-photo-37607956.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  storefront:
    "https://images.pexels.com/photos/32779494/pexels-photo-32779494.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  cablecar:
    "https://images.pexels.com/photos/39438190/pexels-photo-39438190.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  silhouette:
    "https://images.pexels.com/photos/35258850/pexels-photo-35258850.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  sunsetMan:
    "https://images.pexels.com/photos/26752395/pexels-photo-26752395.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  video: "https://videos.pexels.com/video-files/13931568/13931568-uhd_2160_3840_24fps.mp4",
  videoPoster:
    "https://images.pexels.com/videos/13931568/adolescent-adult-affection-bag-13931568.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
};

const minutes = (n: number) => new Date(Date.now() - n * 60_000);
const hours = (n: number) => new Date(Date.now() - n * 60 * 60_000);
const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60_000);

export async function demoSeeded() {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, "bemblo")).limit(1);
  return rows.length > 0;
}

/** Seeds a realistic BlueBelly world so the product can be explored immediately. */
export async function seedDemoData() {
  if (await demoSeeded()) return { seeded: false };
  const password = hashPassword(DEMO_PASSWORD);
  const base = { passwordHash: password, emailVerifiedAt: hours(48), onboardedAt: hours(48) };

  const inserted = await db
    .insert(users)
    .values([
      {
        ...base,
        username: "bemblo",
        name: "BlueBelly Team",
        email: "team@bemblo.app",
        bio: "Official BlueBelly account. Talk. Share. Connect. We reply to every support message.",
        avatarUrl: IMG.avatarBemblo,
        accent: "violet",
        verified: true,
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(400),
      },
      {
        ...base,
        username: "ava.rivera",
        name: "Ava Rivera",
        email: "ava@bemblo.app",
        bio: "Product designer. Cycling, film photography and very strong coffee.",
        avatarUrl: IMG.avatarAva,
        accent: "violet",
        profilePrivacy: "private",
        messagePermission: "followers",
        createdAt: days(120),
      },
      {
        ...base,
        username: "maya.lens",
        name: "Maya Petrov",
        email: "maya@bemblo.app",
        bio: "Street photographer. I chase light in cities.",
        avatarUrl: IMG.avatarMaya,
        accent: "amber",
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(310),
      },
      {
        ...base,
        username: "liam.brooks",
        name: "Liam Brooks",
        email: "liam@bemblo.app",
        bio: "Trail runner. Weekends outside, always.",
        avatarUrl: IMG.avatarLiam,
        accent: "mint",
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(280),
      },
      {
        ...base,
        username: "noor.hassan",
        name: "Noor Hassan",
        email: "noor@bemblo.app",
        bio: "Ceramics, plants, slow mornings. Private account.",
        avatarUrl: IMG.avatarNoor,
        accent: "coral",
        profilePrivacy: "private",
        messagePermission: "nobody",
        createdAt: days(200),
      },
      {
        ...base,
        username: "tomas.k",
        name: "Tomas Keller",
        email: "tomas@bemblo.app",
        bio: "Sound engineer. Ask me about microphones.",
        avatarUrl: IMG.avatarTomas,
        accent: "sky",
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(90),
      },
      {
        ...base,
        username: "diego.m",
        name: "Diego Martins",
        email: "diego@bemblo.app",
        bio: "Football, food, family.",
        avatarUrl: IMG.avatarDiego,
        accent: "rose",
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(40),
      },
      {
        ...base,
        username: "priya.s",
        name: "Priya Sharma",
        email: "priya@bemblo.app",
        bio: "Bookseller. Currently reading three things at once.",
        avatarUrl: null,
        accent: "mint",
        profilePrivacy: "public",
        messagePermission: "everyone",
        createdAt: days(20),
      },
    ])
    .returning();

  const byUsername = new Map(inserted.map((u) => [u.username, u]));
  const id = (username: string) => byUsername.get(username)!.id;

  await db.insert(follows).values([
    { followerId: id("ava.rivera"), followingId: id("maya.lens"), state: "accepted" },
    { followerId: id("maya.lens"), followingId: id("ava.rivera"), state: "accepted" },
    { followerId: id("ava.rivera"), followingId: id("liam.brooks"), state: "accepted" },
    { followerId: id("liam.brooks"), followingId: id("ava.rivera"), state: "accepted" },
    { followerId: id("ava.rivera"), followingId: id("bemblo"), state: "accepted" },
    { followerId: id("bemblo"), followingId: id("ava.rivera"), state: "accepted" },
    { followerId: id("ava.rivera"), followingId: id("noor.hassan"), state: "pending" },
    // Pending follower requests waiting for Ava's approval (she is Private).
    { followerId: id("tomas.k"), followingId: id("ava.rivera"), state: "pending" },
    { followerId: id("diego.m"), followingId: id("ava.rivera"), state: "pending" },
    { followerId: id("priya.s"), followingId: id("ava.rivera"), state: "pending" },
    { followerId: id("maya.lens"), followingId: id("liam.brooks"), state: "accepted" },
    { followerId: id("liam.brooks"), followingId: id("maya.lens"), state: "accepted" },
    { followerId: id("maya.lens"), followingId: id("bemblo"), state: "accepted" },
    { followerId: id("liam.brooks"), followingId: id("bemblo"), state: "accepted" },
    { followerId: id("maya.lens"), followingId: id("tomas.k"), state: "accepted" },
    { followerId: id("tomas.k"), followingId: id("maya.lens"), state: "accepted" },
  ]);

  const momentRows = await db
    .insert(moments)
    .values([
      {
        authorId: id("bemblo"),
        kind: "photo",
        body: "BlueBelly 1.0 is here. Conversations stay temporary, Moments stay yours. Talk. Share. Connect.",
        mediaUrl: IMG.crossing,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "public",
        createdAt: days(3),
      },
      {
        authorId: id("maya.lens"),
        kind: "photo",
        body: "Golden hour on the way home. No filter, just the city doing its thing.",
        mediaUrl: IMG.streetSunset,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "public",
        createdAt: hours(9),
      },
      {
        authorId: id("maya.lens"),
        kind: "photo",
        body: "Quiet corner I keep coming back to. Sharing this one with followers only.",
        mediaUrl: IMG.windowLight,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "followers",
        createdAt: hours(20),
      },
      {
        authorId: id("liam.brooks"),
        kind: "video",
        body: "Ten seconds of exactly why I run. Sound on for the street noise.",
        mediaUrl: IMG.video,
        posterUrl: IMG.videoPoster,
        mediaWidth: 1080,
        mediaHeight: 1920,
        audience: "public",
        createdAt: hours(5),
      },
      {
        authorId: id("liam.brooks"),
        kind: "photo",
        body: "Post-run groceries. The best kind of tired.",
        mediaUrl: IMG.grocery,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "public",
        createdAt: days(2),
      },
      {
        authorId: id("noor.hassan"),
        kind: "photo",
        body: "Two hours in the kiln and everything survived. A good day.",
        mediaUrl: IMG.cablecar,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "public",
        createdAt: hours(30),
      },
      {
        authorId: id("noor.hassan"),
        kind: "photo",
        body: "Only for my followers: the shelf of misfit pots I secretly love.",
        mediaUrl: IMG.storefront,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "followers",
        createdAt: hours(31),
      },
      {
        authorId: id("ava.rivera"),
        kind: "photo",
        body: "Sunday ride through the old quarter. Slowing down suits me.",
        mediaUrl: IMG.silhouette,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "public",
        createdAt: hours(7),
      },
      {
        authorId: id("ava.rivera"),
        kind: "photo",
        body: "Studio corner, for followers. Prototype three finally looks right.",
        mediaUrl: IMG.sunsetMan,
        mediaWidth: 1200,
        mediaHeight: 627,
        audience: "followers",
        createdAt: days(1),
      },
      {
        authorId: id("ava.rivera"),
        kind: "text",
        body: "Only Me: things I want to remember about this year. Nothing to prove, nobody watching.",
        audience: "only_me",
        audienceLocked: true,
        createdAt: hours(12),
      },
      {
        authorId: id("tomas.k"),
        kind: "text",
        body: "Recorded drums in a stairwell today. Reverb for days — sending snippets to anyone curious.",
        audience: "public",
        createdAt: hours(3),
      },
    ])
    .returning();

  const momentByBody = (needle: string) => momentRows.find((m) => m.body.includes(needle))!.id;

  await db.insert(momentLikes).values([
    { momentId: momentByBody("Sunday ride"), userId: id("maya.lens"), createdAt: hours(6) },
    { momentId: momentByBody("Sunday ride"), userId: id("liam.brooks"), createdAt: hours(5) },
    { momentId: momentByBody("Sunday ride"), userId: id("bemblo"), createdAt: hours(4) },
    { momentId: momentByBody("Golden hour"), userId: id("ava.rivera"), createdAt: hours(8) },
    { momentId: momentByBody("Ten seconds"), userId: id("ava.rivera"), createdAt: hours(4) },
    { momentId: momentByBody("Two hours in the kiln"), userId: id("ava.rivera"), createdAt: hours(29) },
    { momentId: momentByBody("BlueBelly 1.0"), userId: id("ava.rivera"), createdAt: days(3) },
    { momentId: momentByBody("BlueBelly 1.0"), userId: id("maya.lens"), createdAt: days(3) },
  ]);

  await db.insert(momentComments).values([
    { momentId: momentByBody("Sunday ride"), userId: id("maya.lens"), body: "That light! Which street is this?", createdAt: hours(6) },
    { momentId: momentByBody("Sunday ride"), userId: id("ava.rivera"), body: "Rua do Norte, right before the square closes.", createdAt: hours(5) },
    { momentId: momentByBody("Ten seconds"), userId: id("ava.rivera"), body: "The street noise makes it. Adding this route to my list.", createdAt: hours(3) },
    { momentId: momentByBody("Golden hour"), userId: id("liam.brooks"), body: "Framing on point.", createdAt: hours(8) },
  ]);

  // ---- Conversations -------------------------------------------------
  const now = Date.now();
  const [direct] = await db
    .insert(conversations)
    .values({
      kind: "direct",
      createdById: id("maya.lens"),
      directKey: [id("ava.rivera"), id("maya.lens")].sort((a, b) => a - b).join(":"),
      createdAt: hours(26),
      lastMessageAt: minutes(6),
    })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: direct.id, userId: id("ava.rivera"), state: "active", lastReadAt: minutes(90) },
    { conversationId: direct.id, userId: id("maya.lens"), state: "active", lastReadAt: minutes(5) },
  ]);

  const [group] = await db
    .insert(conversations)
    .values({
      kind: "group",
      title: "Sunday ride",
      createdById: id("liam.brooks"),
      createdAt: days(2),
      lastMessageAt: hours(4),
    })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: group.id, userId: id("liam.brooks"), role: "admin", state: "active", lastReadAt: hours(4) },
    { conversationId: group.id, userId: id("ava.rivera"), state: "active", lastReadAt: hours(6) },
    { conversationId: group.id, userId: id("maya.lens"), state: "active", lastReadAt: hours(5) },
  ]);

  const [request] = await db
    .insert(conversations)
    .values({
      kind: "direct",
      createdById: id("tomas.k"),
      directKey: [id("ava.rivera"), id("tomas.k")].sort((a, b) => a - b).join(":"),
      createdAt: hours(2),
      lastMessageAt: minutes(25),
    })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: request.id, userId: id("tomas.k"), state: "active", lastReadAt: minutes(25) },
    { conversationId: request.id, userId: id("ava.rivera"), state: "requested" },
  ]);

  const insertedMessages = await db
    .insert(messages)
    .values([
      {
        conversationId: direct.id,
        senderId: id("maya.lens"),
        kind: "text",
        body: "Did you see the light on Rua do Norte yesterday? I got three frames I actually like.",
        createdAt: hours(2),
        firstViewedAt: minutes(90),
        expiresAt: new Date(minutes(90).getTime() + MESSAGE_EXPIRY.directViewedTtlMs),
      },
      {
        conversationId: direct.id,
        senderId: id("ava.rivera"),
        kind: "text",
        body: "Yes! Send them when you are back at a screen. I want the second one for my wall.",
        createdAt: minutes(80),
        firstViewedAt: minutes(88),
        expiresAt: new Date(minutes(88).getTime() + MESSAGE_EXPIRY.directViewedTtlMs),
      },
      {
        conversationId: direct.id,
        senderId: id("maya.lens"),
        kind: "text",
        body: "Deal. Are you still up for the print swap on the weekend?",
        createdAt: minutes(12),
      },
      {
        conversationId: direct.id,
        senderId: id("maya.lens"),
        kind: "text",
        body: "Also — these messages will vanish 24h after you open them, so read them while they last :)",
        createdAt: minutes(6),
      },
      {
        conversationId: group.id,
        senderId: id("liam.brooks"),
        kind: "system",
        isSystem: true,
        body: "Liam Brooks created this group. Messages here disappear 7 days after sending.",
        createdAt: days(2),
      },
      {
        conversationId: group.id,
        senderId: id("liam.brooks"),
        kind: "text",
        body: "Sunday route: north gate, the long climb, coffee at kilometre 40. 8am start?",
        createdAt: hours(20),
        expiresAt: new Date(Date.now() - 20 * 60 * 60_000 + MESSAGE_EXPIRY.groupTtlMs),
        firstViewedAt: hours(19),
        maxRetentionAt: new Date(Date.now() + 10 * 24 * 60 * 60_000),
      },
      {
        conversationId: group.id,
        senderId: id("maya.lens"),
        kind: "voice",
        body: "",
        durationSec: 27,
        createdAt: hours(5),
        expiresAt: new Date(Date.now() - 5 * 60 * 60_000 + MESSAGE_EXPIRY.groupTtlMs),
        firstViewedAt: hours(5),
        maxRetentionAt: new Date(Date.now() + 25 * 24 * 60 * 60_000),
      },
      {
        conversationId: group.id,
        senderId: id("ava.rivera"),
        kind: "text",
        body: "8am works. I will bring the good flask.",
        createdAt: hours(4),
        expiresAt: new Date(Date.now() - 4 * 60 * 60_000 + MESSAGE_EXPIRY.groupTtlMs),
        firstViewedAt: hours(4),
        maxRetentionAt: new Date(Date.now() + 26 * 24 * 60 * 60_000),
      },
      {
        conversationId: request.id,
        senderId: id("tomas.k"),
        kind: "text",
        body: "Hi Ava — Maya gave me your name. I am building a small sound library for cyclists and would love your thoughts.",
        createdAt: hours(2),
        maxRetentionAt: new Date(now + MESSAGE_EXPIRY.maxUnviewedRetentionMs),
      },
      {
        conversationId: request.id,
        senderId: id("tomas.k"),
        kind: "text",
        body: "No rush at all. Happy to share what I have so far.",
        createdAt: minutes(25),
        maxRetentionAt: new Date(now + MESSAGE_EXPIRY.maxUnviewedRetentionMs),
      },
    ])
    .returning();

  const messageViewsSeed = insertedMessages
    .filter((m) => m.firstViewedAt !== null && m.senderId !== id("ava.rivera"))
    .map((m) => ({ messageId: m.id, userId: m.senderId === id("maya.lens") ? id("ava.rivera") : id("liam.brooks") }));
  if (messageViewsSeed.length) await db.insert(messageViews).values(messageViewsSeed).onConflictDoNothing();

  await db.insert(notifications).values([
    { userId: id("ava.rivera"), type: "like", actorId: id("maya.lens"), entityType: "moment", entityId: momentByBody("Sunday ride"), preview: "Liked your Moment", createdAt: hours(6) },
    { userId: id("ava.rivera"), type: "like", actorId: id("liam.brooks"), entityType: "moment", entityId: momentByBody("Sunday ride"), preview: "Liked your Moment", createdAt: hours(5) },
    { userId: id("ava.rivera"), type: "comment", actorId: id("maya.lens"), entityType: "moment", entityId: momentByBody("Sunday ride"), preview: "That light! Which street is this?", createdAt: hours(5) },
    { userId: id("ava.rivera"), type: "follow_request", actorId: id("tomas.k"), entityType: "user", entityId: id("tomas.k"), preview: "Requested to follow you", createdAt: hours(2) },
    { userId: id("ava.rivera"), type: "follow_request", actorId: id("diego.m"), entityType: "user", entityId: id("diego.m"), preview: "Requested to follow you", createdAt: hours(20) },
    { userId: id("ava.rivera"), type: "follow", actorId: id("priya.s"), entityType: "user", entityId: id("priya.s"), preview: "Started following you", createdAt: days(2) },
    { userId: id("ava.rivera"), type: "message", actorId: id("maya.lens"), entityType: "conversation", entityId: direct.id, preview: "Are you still up for the print swap on the weekend?", createdAt: minutes(12) },
    { userId: id("ava.rivera"), type: "message_request", actorId: id("tomas.k"), entityType: "conversation", entityId: request.id, preview: "Sent you a message request", createdAt: hours(2) },
    { userId: id("ava.rivera"), type: "system", preview: "Welcome to your BlueBelly demo. Switch profile privacy in Settings to see audience rules in action.", createdAt: minutes(1) },
  ]);

  return { seeded: true };
}
